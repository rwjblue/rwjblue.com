import { renderWordSamples, type WordRound } from "./word-round.ts";
import { wordPlaybackPosition } from "./word-practice.ts";

export interface WordPlayerCallbacks {
  progress: (seconds: number, position: number) => void;
  status: (status: "playing" | "paused" | "interrupted" | "ended") => void;
}

/** Owns its context; never suspends the recording or sending players' contexts. */
export function createWordPlayer(callbacks: WordPlayerCallbacks) {
  let context: AudioContext | undefined;
  let source: AudioBufferSourceNode | undefined;
  let buffer: AudioBuffer | undefined;
  let round: WordRound | undefined;
  let offset = 0;
  let started = 0;
  let accounted = 0;
  let generation = 0;
  let playing = false;
  let disposed = false;
  let session: { type: string } | undefined;
  let previousSessionType: string | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;

  function checkpoint() {
    if (!playing || !context || !round) return offset;
    const position = wordPlaybackPosition(offset, started, context.currentTime, round.duration);
    const delta = Math.max(0, position - accounted);
    accounted = position;
    callbacks.progress(delta, position);
    return position;
  }
  function pause(status: "paused" | "interrupted" = "paused") {
    generation++;
    offset = checkpoint();
    playing = false;
    clearInterval(ticker);
    if (source) {
      source.onended = null;
      source.stop();
      source.disconnect();
      source = undefined;
    }
    callbacks.status(status);
  }
  return {
    checkpoint,
    pause,
    async play(nextRound: WordRound, pitch: number, restart = false) {
      if (disposed) throw new Error("Word player has been disposed.");
      pause();
      const run = generation;
      const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser does not support Web Audio.");
      if (!session) {
        session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) {
          previousSessionType = session.type;
          try { session.type = "playback"; } catch { /* Optional platform hint. */ }
        }
      }
      if (!context || context.state === "closed") {
        context = new AudioContextClass();
        context.onstatechange = () => {
          if (playing && context?.state !== "running") pause("interrupted");
        };
      }
      // Invoke resume in the button's gesture, before rendering or awaiting.
      const resumed = context.resume();
      if (round !== nextRound || !buffer || restart) {
        round = nextRound;
        offset = 0;
        const samples = renderWordSamples(round, pitch);
        buffer = context.createBuffer(1, samples.length, 22050);
        buffer.getChannelData(0).set(samples);
      }
      await resumed;
      if (disposed || generation !== run) return;
      if (context.state !== "running") throw new Error("Audio is interrupted. Return to this page and press Play.");
      if (offset >= round.duration) offset = 0;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      accounted = offset;
      started = context.currentTime;
      playing = true;
      source.onended = () => {
        if (!playing || generation !== run) return;
        checkpoint();
        playing = false;
        clearInterval(ticker);
        source?.disconnect();
        source = undefined;
        offset = round!.duration;
        callbacks.status("ended");
      };
      source.start(0, offset);
      ticker = setInterval(checkpoint, 250);
      callbacks.status("playing");
    },
    dispose() {
      pause();
      disposed = true;
      if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
      if (session && previousSessionType && session.type === "playback") {
        try { session.type = previousSessionType; } catch { /* Optional platform hint. */ }
      }
      buffer = undefined;
      round = undefined;
    },
  };
}
