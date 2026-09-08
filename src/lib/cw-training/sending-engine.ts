import MorseCW from "morse-pro/src/morse-pro-cw.js";
import MorseDecoder from "morse-pro/src/morse-pro-decoder.js";
import type MorsePlayer from "morse-pro/src/morse-pro-player-waa.js";

export const SENDING_ENGINE_VERSION = "92bf6ec02092d45c159216c61e241ada3f146989";

export interface SendingPlayer {
  /** Resolves when playback finishes or is stopped; rejects when audio fails. */
  play(timings: number[]): Promise<void>;
  stop(): void;
  dispose(): void;
}

function checkedSpeed(wpm: number): number {
  if (!Number.isFinite(wpm) || wpm <= 0) throw new RangeError("Sending speed must be a positive number.");
  return wpm;
}

function copyTimings(timings: number[]): number[] {
  if (!timings.every(Number.isFinite)) throw new RangeError("Sending timings must contain finite millisecond durations.");
  return [...timings];
}

/** Decode a separate copy; the original recorded edges remain the evidence. */
export function decodeSendingTimings(timings: number[], wpm: number): { text: string; morse: string } {
  const speed = checkedSpeed(wpm);
  const durations = copyTimings(timings);
  if (!durations.some(duration => duration > 0)) return { text: "", morse: "" };
  const decoder = new MorseDecoder({ wpm: speed, fwpm: speed, dictionaryOptions: ["prosigns"] });
  decoder.addTimings(durations);
  decoder.flush();
  return {
    text: decoder.message.trim(),
    morse: decoder.displayMorse(decoder.loadMorse(decoder.morse)).trim(),
  };
}

/** Generate the reference with the same upstream dictionary and timing model. */
export function sendingTextTimings(text: string, wpm: number): number[] {
  const speed = checkedSpeed(wpm);
  if (!text.trim()) return [];
  const cw = new MorseCW({ wpm: speed, fwpm: speed, dictionaryOptions: ["prosigns"] });
  const tokens = cw.loadText(text);
  if (tokens === null || tokens.error) throw new Error("This prompt contains characters that cannot be sent as Morse.");
  return [...cw.getTimings(tokens)];
}

/**
 * Playback owns a separate audio context so stopping optional sending audio
 * cannot suspend the main training player. Importing this module is Node-safe.
 */
export function createSendingPlayer(): SendingPlayer {
  let disposed = false;
  let cancelCurrent: (() => void) | undefined;

  const stop = () => {
    const cancel = cancelCurrent;
    cancelCurrent = undefined;
    cancel?.();
  };

  return {
    play(timings) {
      if (disposed) return Promise.reject(new Error("The sending player has been disposed."));
      let durations: number[];
      try {
        durations = copyTimings(timings);
      } catch (error) {
        return Promise.reject(error);
      }
      stop();
      if (!durations.length) return Promise.resolve();
      const AudioContextClass = typeof window === "undefined" ? undefined
        : window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return Promise.reject(new Error("This browser does not support Web Audio playback."));

      return new Promise<void>((resolve, reject) => {
        let finished = false;
        let context: AudioContext | undefined;
        let player: MorsePlayer | undefined;
        const finish = (error?: unknown) => {
          if (finished) return;
          finished = true;
          if (cancelCurrent === cancel) cancelCurrent = undefined;
          player?.stop();
          player?.outputNode?.disconnect();
          if (context && context.state !== "closed") void context.close().catch(() => {});
          if (error === undefined) resolve();
          else reject(error);
        };
        const cancel = () => finish();
        cancelCurrent = cancel;

        // Unlock synchronously during the user's gesture, before importing the
        // browser-only upstream player. A later stop also cancels this wait.
        let running: Promise<void>;
        try {
          context = new AudioContextClass();
          running = context.resume();
        } catch (error) {
          finish(error);
          return;
        }
        const audioContext = context;
        void (async () => {
          try {
            const [{ default: Player }] = await Promise.all([
              import("morse-pro/src/morse-pro-player-waa.js"),
              running,
            ]);
            if (finished) return;
            player = new Player({
              defaultFrequency: 550,
              volume: 0.65,
              // Allow the upstream 5 ms release envelope to finish before
              // disposing the context; recording intervals stay untouched.
              endPadding: 10,
              sequenceEndCallback: () => finish(),
              allStoppedCallback: () => finish(),
              _audioContextModule: {
                get: () => audioContext,
                ensureRunning: async () => {
                  if (audioContext.state === "suspended") await audioContext.resume();
                  if (finished) throw new Error("Sending playback was stopped.");
                  return audioContext;
                },
              },
            });
            // Play the recorded intervals, never re-encode the decoded text.
            await player.play({ timings: [...durations] });
            if (finished) player.stop();
          } catch (error) {
            finish(error);
          }
        })();
      });
    },
    stop,
    dispose() {
      disposed = true;
      stop();
    },
  };
}
