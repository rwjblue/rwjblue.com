import { createSendingPlayer, decodeSendingTimings, sendingTextTimings, SENDING_ENGINE_VERSION } from "./sending-engine.ts";
import { connectSendingKeyboard, requestSendingMidi } from "./sending-input.ts";
import type { SendingInputConnection, SendingMidiSession, SendingInputHandlers } from "./sending-input.ts";
import { appendSendingTake, beginSendingTake, createSendingDraft, discardSendingTake, recordSendingEdge, restoreSendingDraft, restoreSendingTakes, setSendingTranscript, stopSendingTake, SENDING_MAX_TAKE_MS } from "./sending-session.ts";
import type { SendingDraft, SendingTake, SendingStopReason } from "./sending-session.ts";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const duration = (milliseconds: number) => `${Math.floor(milliseconds / 60000).toString().padStart(2, "0")}:${Math.floor(milliseconds / 1000 % 60).toString().padStart(2, "0")}`;
const decoder = { name: "morse-pro", version: SENDING_ENGINE_VERSION };
const reasons: Partial<Record<SendingStopReason, string>> = {
  paused: "Capture paused. Your practice timer keeps its existing state.", disconnected: "Capture stopped after the adapter disconnected.",
  hidden: "Capture stopped when the page was hidden.", navigation: "Capture stopped when you left Focus.",
  reload: "Capture was restored paused. Reconnect to record another take.",
  "duration-limit": "This take reached its ten-minute limit.", "event-limit": "This take reached its recording limit.",
  "input-error": "Input was interrupted. An unfinished mark was discarded.",
};

function reviewMarkup(take: SendingTake): string {
  const comparison = take.comparison === "matches" ? "Decoded text matches after normalizing spaces and case."
    : take.comparison === "possible-mismatch" ? "Possible mismatch. Listen to the recording before treating the decoded text as a sending mistake."
      : take.targetText ? "No reliable text comparison is available. Review the captured timing by ear."
        : "Free sending: use the replay to review your rhythm and spacing.";
  return `<p class="training-small">${duration(take.elapsedMs)} captured · ${take.input === "midi" ? "MIDI" : "keyboard"} · ${take.wpm} WPM decode/reference speed</p>
    ${take.reason && reasons[take.reason] ? `<p class="training-notice">${escape(reasons[take.reason])}</p>` : ""}
    ${take.targetText ? `<p class="training-sending-label">Expected</p><pre class="training-sending-transcript">${escape(take.targetText)}</pre>` : ""}
    <p class="training-sending-label">Decoder read</p><pre class="training-sending-transcript">${escape(take.decodedText || "No recognizable text yet.")}</pre>
    <p>${escape(comparison)}</p>
    <div class="training-actions"><button type="button" data-sending-play="actual">Play my sending</button>${take.targetText ? '<button type="button" data-sending-play="reference">Play reference</button>' : ""}<button type="button" data-sending-play="stop">Stop playback</button></div>
    <p class="training-small">Replay preserves received timing. Dits and dahs formed by a keyer are not a measure of your hand timing. Nothing here changes practice credit or completion.</p>`;
}

export interface SendingPanel {
  suspend(reason: SendingStopReason): void;
  dispose(): void;
}

export interface SendingPanelOptions {
  container: HTMLElement;
  draft?: SendingDraft;
  takes?: SendingTake[];
  initialWpm?: number;
  selectedText(): string;
  /** Capture never starts or pauses the host's timer. */
  onChange(draft: SendingDraft, takes: SendingTake[], checkpoint: boolean): void;
  onClose(): void;
}

/** Loaded only after the user asks to record; ordinary Focus never imports the engine. */
export function createSendingPanel(options: SendingPanelOptions): SendingPanel {
  const root = options.container;
  let draft = restoreSendingDraft(options.draft) ?? createSendingDraft({ wpm: options.initialWpm });
  let takes = restoreSendingTakes(options.takes);
  let connection: SendingInputConnection | undefined;
  let midi: SendingMidiSession | undefined;
  let tested = false;
  let testDown = false;
  let captureStart = 0;
  let busy = false;
  let closed = false;
  let generation = 0;
  let ignoringInput = false;
  let stuckTimeout: ReturnType<typeof setTimeout> | undefined;
  let liveTimeout: ReturnType<typeof setTimeout> | undefined;
  let playbackGeneration = 0;
  const player = createSendingPlayer();
  const abort = new AbortController();

  root.innerHTML = `<div class="training-sending-heading"><h3>Record my sending <span class="training-small">optional</span></h3><button type="button" data-sending-action="close">Continue without capture</button></div>
    <p class="training-small">Your practice timer works independently. Use the Vail's onboard keyer or already-keyed straight-key output, and listen to its sidetone.</p>
    <fieldset data-sending-settings><legend>Set up capture</legend>
      <div class="training-sending-fields"><label>Connection<select data-sending-input><option value="midi">Vail MIDI</option><option value="keyboard">Adapter keyboard mode</option></select></label>
      <label>Decode/reference speed (WPM)<input data-sending-wpm type="number" min="5" max="60" step="1" required /></label></div>
      <p class="training-small">Match the speed on your keyer. This control does not change the adapter's speed or settings.</p>
      <label>What are you sending?<select data-sending-mode><option value="free">Free sending / warm-up</option><option value="target">Compare with selected text</option></select></label>
      <div data-sending-target-box hidden><label>Text to send<textarea data-sending-target maxlength="2000" rows="3" spellcheck="false" autocapitalize="characters"></textarea></label><button type="button" data-sending-action="selection">Use highlighted sending text</button><p class="training-small">Highlight only the letters or words you intend to send, or paste them here. Instructions are never compared automatically.</p></div>
      <label class="training-check"><input type="checkbox" data-sending-live /> Show live decoded text during capture</label>
    </fieldset>
    <p data-sending-support class="training-small"></p>
    <div class="training-actions"><button type="button" data-sending-action="connect">Connect and test</button><button type="button" data-sending-action="disconnect" hidden>Disconnect</button></div>
    <div data-sending-midi-box hidden><label>Choose your Vail adapter<select data-sending-midi-port></select></label><button type="button" data-sending-action="choose-midi">Use this adapter</button></div>
    <div data-sending-key-area tabindex="0" role="region" aria-label="Sending input test and keyboard capture area" class="training-sending-key-area"><span data-sending-light aria-hidden="true"></span><span data-sending-input-status>Connect your adapter, then send a few dits and dahs.</span></div>
    <p data-sending-message class="training-small" role="status" aria-live="polite"></p>
    <div class="training-actions"><button type="button" class="primary" data-sending-action="start">Start capture</button><button type="button" data-sending-action="stop" hidden>Stop and review</button><span data-sending-clock class="training-small"></span></div>
    <div data-sending-live-box hidden><pre data-sending-live-text class="training-sending-transcript" hidden></pre><p class="training-small">Keep your attention on the sound. Feedback is available after the take.</p></div>
    <section data-sending-review hidden><h4>Review this take</h4><div data-sending-review-content></div><div class="training-actions"><button type="button" class="primary" data-sending-action="keep">Keep take</button><button type="button" data-sending-action="discard">Discard take</button></div></section>
    <div data-sending-kept></div>
    <p class="training-small">Takes are limited to ten minutes. Up to ten takes are retained per block. Finish and save practice to keep replay on this device and optionally sync a text summary.</p>
    <p class="training-small">Powered by <a href="https://gitlab.com/scphillips/morse-pro" target="_blank" rel="noreferrer">morse-pro</a> · <a href="/vendor/morse-pro/README.md" target="_blank" rel="noreferrer">Source and license</a></p>`;

  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const input = $<HTMLSelectElement>("[data-sending-input]");
  const wpm = $<HTMLInputElement>("[data-sending-wpm]");
  const mode = $<HTMLSelectElement>("[data-sending-mode]");
  const target = $<HTMLTextAreaElement>("[data-sending-target]");
  const keyArea = $("[data-sending-key-area]");
  const live = $<HTMLInputElement>("[data-sending-live]");
  input.value = draft.input;
  wpm.value = String(draft.wpm);
  mode.value = draft.mode;
  target.value = draft.targetText ?? "";
  const message = (text: string) => { if (!closed) $("[data-sending-message]").textContent = text; };
  const emit = (checkpoint = true) => options.onChange(draft, takes, checkpoint);
  const hasTake = () => !!draft.take && draft.status !== "capturing";

  function stopPlayback() { playbackGeneration++; player.stop(); }
  function closeInput() {
    generation++;
    ignoringInput = true;
    const previous = connection;
    connection = undefined;
    previous?.disconnect();
    midi?.dispose();
    midi = undefined;
    ignoringInput = false;
    busy = false;
    tested = false;
    testDown = false;
    clearTimeout(stuckTimeout);
    $("[data-sending-midi-box]").hidden = true;
    $("[data-sending-light]").classList.remove("is-keyed");
  }

  function decode() {
    if (!draft.take?.timings.length) return;
    try {
      const result = decodeSendingTimings(draft.take.timings, draft.take.wpm);
      draft = setSendingTranscript(draft, { decodedText: result.text.slice(0, 4000), decoder });
    } catch {
      draft = setSendingTranscript(draft, { decodedText: "", decoder });
      message("The decoder could not read this take. Your raw recording is preserved for replay; practice time is unaffected.");
    }
  }

  function stop(reason: SendingStopReason = "stopped") {
    stopPlayback();
    clearTimeout(stuckTimeout);
    clearTimeout(liveTimeout);
    const wasCapturing = draft.status === "capturing";
    if (wasCapturing) {
      draft = stopSendingTake(draft, { atMs: Math.max(0, performance.now() - captureStart), endedAt: new Date().toISOString(), reason });
      decode();
      emit();
    }
    render();
    if (wasCapturing && reason === "stopped") message("Capture stopped. Review your sending below.");
  }

  function renderClock() {
    const elapsed = draft.status === "capturing" ? Math.max(0, performance.now() - captureStart) : draft.take?.elapsedMs ?? 0;
    $("[data-sending-clock]").textContent = draft.take ? `${duration(elapsed)} capture duration` : "";
  }

  function render() {
    if (closed) return;
    const capturing = draft.status === "capturing";
    $<HTMLFieldSetElement>("[data-sending-settings]").disabled = capturing || hasTake();
    $("[data-sending-target-box]").hidden = mode.value !== "target";
    $("[data-sending-support]").textContent = input.value === "midi"
      ? ("requestMIDIAccess" in navigator ? "Brave desktop is the first target. Connect explicitly and verify the input before recording." : "MIDI capture is unavailable here, including Safari on iOS. Continue ordinary practice, or try keyboard mode if your device supports it.")
      : "Keep the capture area focused. Keyboard adapters on iPhone/iPad need a compatibility check. Only already-keyed Control signals are supported.";
    const start = $<HTMLButtonElement>('[data-sending-action="start"]');
    start.disabled = !connection || !tested || capturing || hasTake() || busy;
    start.hidden = capturing || hasTake();
    $("[data-sending-action=stop]").hidden = !capturing;
    const connect = $<HTMLButtonElement>('[data-sending-action="connect"]');
    connect.hidden = !!connection;
    connect.disabled = busy || capturing;
    $<HTMLButtonElement>('[data-sending-action="choose-midi"]').disabled = busy;
    $("[data-sending-action=disconnect]").hidden = !connection;
    keyArea.hidden = !connection || hasTake();
    $("[data-sending-live-box]").hidden = !capturing;
    $("[data-sending-live-text]").hidden = !live.checked;
    $("[data-sending-live-text]").textContent = draft.take?.decodedText || "Waiting for a complete group...";
    $("[data-sending-review]").hidden = !hasTake();
    if (hasTake()) $("[data-sending-review-content]").innerHTML = reviewMarkup(draft.take!);
    const kept = $("[data-sending-kept]");
    kept.innerHTML = takes.length ? `<details><summary>${takes.length} kept take${takes.length === 1 ? "" : "s"} in this block</summary><ul class="training-sending-takes">${takes.map((take, index) => `<li><span>Take ${index + 1} · ${duration(take.elapsedMs)} · ${escape(take.decodedText?.slice(0, 65) || "No decoded text")}</span><button type="button" data-sending-kept-play="${escape(take.id)}">Replay</button><button type="button" data-sending-remove="${escape(take.id)}">Remove</button></li>`).join("")}</ul></details>` : "";
    renderClock();
  }

  const handlers: SendingInputHandlers = {
    onEdge(down, at) {
      if (closed || ignoringInput || !connection) return;
      $("[data-sending-light]").classList.toggle("is-keyed", down);
      $("[data-sending-input-status]").textContent = down ? "Key down" : "Key up";
      if (down) testDown = true;
      else if (testDown && !tested) { tested = true; message("Input received. Start capture when ready."); render(); }
      if (draft.status !== "capturing") return;
      const next = recordSendingEdge(draft, { down, atMs: Math.max(0, at - captureStart) });
      draft = next;
      clearTimeout(stuckTimeout);
      if (draft.status !== "capturing") { decode(); emit(); render(); return; }
      if (down) stuckTimeout = setTimeout(() => { stop("input-error"); closeInput(); render(); message("The key stayed down for five seconds. The unfinished mark was discarded. Reconnect and test the release signal."); }, 5000);
      emit(false);
      clearTimeout(liveTimeout);
      if (!down && live.checked) liveTimeout = setTimeout(() => {
        if (draft.status !== "capturing" || closed) return;
        decode();
        $("[data-sending-live-text]").textContent = draft.take?.decodedText || "No recognizable text yet.";
        emit(false);
      }, 500);
    },
    onInterrupted(reason) {
      if (closed || ignoringInput) return;
      // Leaving the key area to use a control must not invalidate a successful
      // keyboard test. The input listener remains scoped to that exact area.
      // Window blur/navigation independently suspend and disconnect the input.
      if (input.value === "keyboard") {
        // Hiding the capture area for an already-stopped take also blurs it.
        if (hasTake()) return;
        stop("paused");
        testDown = false;
        $("[data-sending-light]").classList.remove("is-keyed");
        message(reason);
        return;
      }
      stop("input-error");
      closeInput();
      render();
      message(`${reason} Your practice timer keeps its existing state.`);
    },
    onUnsupported(reason) {
      if (closed || ignoringInput) return;
      stop("input-error");
      closeInput();
      render();
      message(reason);
    },
  };

  async function connectMidiPort() {
    if (!midi || closed || busy) return;
    const current = generation;
    busy = true;
    render();
    try {
      const connected = await midi.connect($<HTMLSelectElement>("[data-sending-midi-port]").value, handlers);
      if (current !== generation || closed) { connected.disconnect(); return; }
      connection = connected;
      $("[data-sending-midi-box]").hidden = true;
      message("Connected. Send a few dits and dahs to check both press and release.");
    } catch (error) {
      if (current === generation && !closed) message(error instanceof Error ? error.message : "The adapter could not connect. Continue practice or try again.");
    } finally {
      if (current === generation && !closed) { busy = false; render(); }
    }
  }

  async function connect() {
    stopPlayback();
    closeInput();
    if (input.value === "keyboard") {
      connection = connectSendingKeyboard(keyArea, handlers);
      render();
      keyArea.focus({ preventScroll: true });
      message("Send a few dits and dahs with this area focused. Your adapter should already form the Morse timing.");
      return;
    }
    const current = generation;
    busy = true;
    render();
    message("Waiting for MIDI permission...");
    try {
      const access = await requestSendingMidi();
      if (current !== generation || closed) { access.dispose(); return; }
      midi = access;
      const ports = access.inputs;
      $<HTMLSelectElement>("[data-sending-midi-port]").innerHTML = ports.map(port => `<option value="${escape(port.id)}">${escape(port.name)}</option>`).join("");
      $("[data-sending-midi-box]").hidden = !ports.length;
      message(ports.length ? "Choose your Vail adapter. Other MIDI devices will not be changed." : "MIDI access is available, but no input device was found. Plug in your Vail and choose Connect and test again.");
    } catch (error) {
      if (current === generation && !closed) message(error instanceof Error && error.name !== "NotAllowedError" ? error.message : "MIDI permission was not granted. You can try again, use keyboard mode, or continue without capture.");
    } finally {
      if (current === generation && !closed) { busy = false; render(); }
    }
  }

  function start() {
    if (!connection || !tested || busy || hasTake() || closed) return;
    if (!wpm.reportValidity()) return;
    const selected = target.value.trim();
    if (mode.value === "target" && !selected) { message("Choose or paste the text you intend to send before starting."); target.focus(); return; }
    if (selected.includes("\0")) { message("Remove null characters from the selected text."); return; }
    if (mode.value === "target") {
      try { if (!sendingTextTimings(selected, Number(wpm.value)).some(value => value > 0)) throw new Error(); }
      catch { message("This target could not be converted to Morse. Use ordinary Morse characters and supported prosigns, or choose free sending."); return; }
    }
    stopPlayback();
    draft = createSendingDraft({ input: input.value === "keyboard" ? "keyboard" : "midi", wpm: Number(wpm.value), mode: mode.value === "target" ? "target" : "free", targetText: selected });
    captureStart = performance.now();
    draft = beginSendingTake(draft, { id: crypto.randomUUID(), startedAt: new Date().toISOString() });
    emit();
    render();
    if (draft.input === "keyboard") keyArea.focus({ preventScroll: true });
    message("Capturing. Stop and review whenever you are ready; your practice timer is independent.");
  }

  async function playTake(take: SendingTake, reference = false) {
    if (draft.status === "capturing") return;
    const current = ++playbackGeneration;
    try {
      const timings = reference ? sendingTextTimings(take.targetText ?? "", take.wpm) : take.timings;
      if (!timings.some(value => value > 0)) { message("This take has no completed marks to replay."); return; }
      message(reference ? "Playing the target with reference timing." : "Playing your received timing.");
      await player.play(timings);
      if (current === playbackGeneration && !closed) message("Playback finished.");
    } catch { if (!closed && current === playbackGeneration) message("Playback could not start. Try the play button again; your recording is preserved."); }
  }

  root.addEventListener("change", event => {
    if (event.target === input) { stop("paused"); closeInput(); render(); }
    if (event.target === mode) render();
    if (event.target === live) render();
    if (!hasTake() && draft.status !== "capturing" && [input, mode, wpm, target].some(control => event.target === control)) {
      draft = createSendingDraft({ input: input.value === "keyboard" ? "keyboard" : "midi", wpm: Number(wpm.value), mode: mode.value === "target" ? "target" : "free", targetText: target.value });
      emit();
    }
  }, { signal: abort.signal });
  root.addEventListener("pointerdown", event => {
    // Stop before a pointer moves keyboard focus out of the capture area.
    if ((event.target as Element).closest('[data-sending-action="stop"]') && draft.status === "capturing") stop();
  }, { signal: abort.signal });
  root.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.sendingPlay) {
      if (button.dataset.sendingPlay === "stop") { stopPlayback(); message("Playback stopped."); }
      else if (draft.take) void playTake(draft.take, button.dataset.sendingPlay === "reference");
      return;
    }
    if (button.dataset.sendingKeptPlay) {
      const take = takes.find(take => take.id === button.dataset.sendingKeptPlay);
      if (take) void playTake(take);
      return;
    }
    if (button.dataset.sendingRemove) {
      takes = takes.filter(take => take.id !== button.dataset.sendingRemove);
      stopPlayback(); emit(); render(); return;
    }
    switch (button.dataset.sendingAction) {
      case "connect": void connect(); break;
      case "choose-midi": void connectMidiPort(); break;
      case "disconnect": stop("disconnected"); closeInput(); render(); message("Capture disconnected. Ordinary practice continues."); break;
      case "start": start(); break;
      case "stop": stop(); break;
      case "selection": {
        const selected = options.selectedText();
        if (!selected.trim()) { message("Highlight a group in the sending text above, or paste it into the target field."); return; }
        if (selected.length > 2000) { message("Choose a shorter group of up to 2,000 characters."); return; }
        target.value = selected; target.dispatchEvent(new Event("change", { bubbles: true })); break;
      }
      case "keep": {
        stopPlayback();
        takes = appendSendingTake(takes, draft.take);
        draft = discardSendingTake(draft);
        emit(); render();
        message("Take kept with this block. Start another capture whenever you are ready.");
        break;
      }
      case "discard": stopPlayback(); draft = discardSendingTake(draft); emit(); render(); message("Take discarded. Practice minutes are unchanged."); break;
      case "close": stop("paused"); closeInput(); options.onClose(); break;
    }
  }, { signal: abort.signal });

  const tick = setInterval(() => {
    if (closed || draft.status !== "capturing") return;
    if (performance.now() - captureStart >= SENDING_MAX_TAKE_MS) { stop("duration-limit"); return; }
    renderClock();
  }, 250);
  const suspend = (reason: SendingStopReason) => { if (!closed) { stop(reason); closeInput(); render(); } };
  const blur = () => suspend("input-error");
  window.addEventListener("blur", blur, { signal: abort.signal });
  render();
  if (draft.take) { decode(); render(); emit(); }
  return {
    suspend,
    dispose() {
      if (closed) return;
      suspend("navigation");
      closed = true;
      abort.abort();
      clearInterval(tick);
      clearTimeout(stuckTimeout);
      clearTimeout(liveTimeout);
      player.dispose();
    },
  };
}

/** History opens only retained local data; it never reconnects an input device. */
export function mountSendingReplay(container: HTMLElement, take: SendingTake, onRemove: () => void): () => void {
  const player = createSendingPlayer();
  let disposed = false;
  let generation = 0;
  const abort = new AbortController();
  container.innerHTML = `${reviewMarkup(take)}<p class="training-small">Replay is stored only on this device. Powered by <a href="https://gitlab.com/scphillips/morse-pro" target="_blank" rel="noopener noreferrer">morse-pro</a> · <a href="/vendor/morse-pro/README.md" target="_blank" rel="noopener noreferrer">Source and license</a>.</p><p data-sending-replay-message role="status" class="training-small"></p><button type="button" data-sending-remove-local>Remove this recording from this device</button>`;
  const message = (text: string) => { if (!disposed) container.querySelector<HTMLElement>("[data-sending-replay-message]")!.textContent = text; };
  container.addEventListener("click", async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.hasAttribute("data-sending-remove-local")) { player.stop(); onRemove(); return; }
    const action = button.dataset.sendingPlay;
    if (!action) return;
    const current = ++generation;
    player.stop();
    if (action === "stop") { message("Playback stopped."); return; }
    try {
      message("Playing...");
      await player.play(action === "reference" ? sendingTextTimings(take.targetText ?? "", take.wpm) : take.timings);
      if (current === generation) message("Playback finished.");
    } catch { message("Playback could not start. Your recording is preserved; try again."); }
  }, { signal: abort.signal });
  return () => { disposed = true; generation++; abort.abort(); player.dispose(); };
}
