export interface SendingInputHandlers {
  onEdge(down: boolean, at: number): void;
  /** Discard any unfinished mark; no artificial release edge is emitted. */
  onInterrupted(reason: string): void;
  onUnsupported(reason: string): void;
}

export interface SendingInputConnection {
  disconnect(): void;
}

// Small structural interfaces also let tests exercise the real adapter logic
// without permission prompts or a connected USB device.
export interface SendingMidiPort extends EventTarget {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state: string;
  open(): Promise<unknown>;
  close(): Promise<unknown>;
}

export interface SendingMidiOutput extends SendingMidiPort {
  send(data: number[]): void;
}

export interface SendingMidiAccess extends EventTarget {
  inputs: ReadonlyMap<string, SendingMidiPort>;
  outputs: ReadonlyMap<string, SendingMidiOutput>;
}

export type SendingMidiRequest = (options: { sysex: false }) => Promise<SendingMidiAccess>;

export interface SendingMidiSession {
  readonly inputs: { id: string; name: string }[];
  connect(inputId: string, handlers: SendingInputHandlers): Promise<SendingInputConnection>;
  dispose(): void;
}

function edgeState(handlers: SendingInputHandlers) {
  let held = false;
  let previousTime = -1;
  return {
    get held() { return held; },
    interrupt(reason: string) {
      held = false;
      previousTime = -1;
      handlers.onInterrupted(reason);
    },
    edge(down: boolean, at: number) {
      if (!Number.isFinite(at) || at < 0 || at < previousTime) {
        this.interrupt("Input timing was interrupted. The unfinished mark was discarded.");
        return;
      }
      if (held === down) return;
      held = down;
      previousTime = at;
      handlers.onEdge(down, at);
    },
  };
}

function closePort(port: SendingMidiPort) {
  // Port cleanup must not prevent practice from continuing after USB removal.
  try { void port.close().catch(() => {}); } catch { /* Already unavailable. */ }
}

function browserMidiRequest(options: { sysex: false }): Promise<SendingMidiAccess> {
  const browser = typeof navigator === "undefined" ? undefined : navigator as Navigator & {
    requestMIDIAccess?: SendingMidiRequest;
  };
  if (!browser?.requestMIDIAccess) {
    return Promise.reject(new Error("MIDI capture is unavailable in this browser. Use keyboard capture or practice independently."));
  }
  return browser.requestMIDIAccess(options);
}

/** Only calling this function requests permission; importing this module does not. */
export async function requestSendingMidi(requestAccess: SendingMidiRequest = browserMidiRequest): Promise<SendingMidiSession> {
  const access = await requestAccess({ sysex: false });
  let disposed = false;
  let connecting = false;
  let active: SendingInputConnection | undefined;
  const availableInputs = () => [...access.inputs.values()].filter(port => port.state === "connected");

  return {
    get inputs() {
      return disposed ? [] : availableInputs().map(port => ({ id: port.id, name: port.name || "Unnamed MIDI device" }));
    },
    async connect(inputId, handlers) {
      if (disposed) throw new Error("MIDI access was closed. Connect your adapter again.");
      if (connecting || active) throw new Error("Disconnect the current adapter before connecting another.");
      const input = availableInputs().find(port => port.id === inputId);
      if (!input) throw new Error("The selected MIDI input is no longer connected.");
      const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();
      const name = normalize(input.name);
      const outputs = [...access.outputs.values()].filter(port => port.state === "connected"
        && name && normalize(port.name) === name
        && normalize(port.manufacturer) === normalize(input.manufacturer));
      if (outputs.length !== 1) {
        throw new Error("A unique matching MIDI output was not found for this adapter. Reconnect it, or use keyboard capture.");
      }
      const output = outputs[0];
      const edges = edgeState(handlers);
      let closed = false;
      let enabled = false;
      let unsupported = false;
      const onMessage = (event: Event) => {
        if (closed || unsupported) return;
        const data = (event as Event & { data?: ArrayLike<number> }).data;
        if (!data || data.length < 3 || (data[0] !== 0x90 && data[0] !== 0x80)) return;
        const down = data[0] === 0x90 && data[2] > 0;
        if ((data[1] === 1 || data[1] === 2) && down) {
          unsupported = true;
          if (edges.held) edges.interrupt("Raw paddle input interrupted this recording.");
          handlers.onUnsupported("Your adapter is sending raw paddle presses. Select an onboard keyer in Vail setup, then reconnect. Capture does not change your keyer settings.");
          return;
        }
        // Channel 1, note 0 is the adapter's already-timed keyed output.
        if (data[1] === 0) edges.edge(down, event.timeStamp);
      };
      const onStateChange = () => {
        if (!closed && (input.state !== "connected" || output.state !== "connected")) {
          const wasHeld = edges.held;
          connection.disconnect();
          if (!wasHeld) edges.interrupt("The MIDI adapter disconnected. Continue practice or reconnect to record again.");
        }
      };
      const connection: SendingInputConnection = {
        disconnect() {
          if (closed) return;
          closed = true;
          input.removeEventListener("midimessage", onMessage);
          access.removeEventListener("statechange", onStateChange);
          if (edges.held) edges.interrupt("Capture disconnected before the key was released. The unfinished mark was discarded.");
          // Vail CC0 controls output mode only. Never write its persistent
          // speed, keyer, or tone settings. No command is sent to other ports.
          if (enabled) {
            try { output.send([0xB0, 0x00, 0x7F]); } catch { /* USB may already be gone. */ }
          }
          closePort(input);
          closePort(output);
          if (active === connection) active = undefined;
        },
      };
      connecting = true;
      try {
        await output.open();
        await input.open();
        if (disposed || input.state !== "connected" || output.state !== "connected") {
          throw new Error("The MIDI connection closed before capture could start.");
        }
        input.addEventListener("midimessage", onMessage);
        access.addEventListener("statechange", onStateChange);
        // https://github.com/Vail-CW/vail-adapter/blob/master/docs/MIDI_INTEGRATION_SPEC.md
        output.send([0xB0, 0x00, 0x00]);
        enabled = true;
        active = connection;
        return connection;
      } catch (error) {
        connection.disconnect();
        throw error;
      } finally {
        connecting = false;
      }
    },
    dispose() {
      disposed = true;
      active?.disconnect();
    },
  };
}

/** Capture already-keyed Control keys only while this exact area has focus. */
export function connectSendingKeyboard(target: HTMLElement, handlers: SendingInputHandlers): SendingInputConnection {
  const edges = edgeState(handlers);
  const keys = new Set<string>();
  const view = target.ownerDocument.defaultView;
  let closed = false;
  let focused = target.ownerDocument.activeElement === target;
  const interrupt = () => {
    if (closed || (!focused && keys.size === 0)) return;
    focused = false;
    keys.clear();
    edges.interrupt("Keyboard input lost focus. Any unfinished mark was discarded.");
  };
  const onFocus = () => { focused = target.ownerDocument.activeElement === target; };
  const onKey = (event: Event) => {
    const key = event as KeyboardEvent;
    if (closed || !focused || target.ownerDocument.hidden || target.ownerDocument.activeElement !== target || key.target !== target
      || !["ControlLeft", "ControlRight"].includes(key.code)) return;
    if (key.cancelable) key.preventDefault();
    if (key.type === "keydown") {
      if (key.repeat || keys.has(key.code)) return;
      keys.add(key.code);
    } else {
      if (!keys.delete(key.code)) return;
    }
    // Either control can carry already-keyed output. Overlap is one mark,
    // ending only after both physical controls are released.
    edges.edge(keys.size > 0, key.timeStamp);
  };
  const onVisibility = () => {
    if (target.ownerDocument.hidden) interrupt();
  };
  target.addEventListener("keydown", onKey);
  target.addEventListener("keyup", onKey);
  target.addEventListener("focus", onFocus);
  target.addEventListener("blur", interrupt);
  view?.addEventListener("focus", onFocus);
  view?.addEventListener("blur", interrupt);
  target.ownerDocument.addEventListener("visibilitychange", onVisibility);
  return {
    disconnect() {
      if (closed) return;
      closed = true;
      focused = false;
      target.removeEventListener("keydown", onKey);
      target.removeEventListener("keyup", onKey);
      target.removeEventListener("focus", onFocus);
      target.removeEventListener("blur", interrupt);
      view?.removeEventListener("focus", onFocus);
      view?.removeEventListener("blur", interrupt);
      target.ownerDocument.removeEventListener("visibilitychange", onVisibility);
      if (keys.size > 0) {
        keys.clear();
        edges.interrupt("Capture disconnected before the key was released. The unfinished mark was discarded.");
      }
    },
  };
}
