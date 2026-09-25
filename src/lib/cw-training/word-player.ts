import { renderWordSamples, retimeWordRound, type WordRound } from "./word-round.ts";
import { wordPlaybackPosition } from "./word-practice.ts";

export interface WordPlayerCallbacks {
  progress: (seconds: number, position: number) => void;
  status: (status: "playing" | "paused" | "interrupted" | "ended") => void;
}

/** Owns its context; never suspends the recording or sending players' contexts. */
export function createWordPlayer(callbacks: WordPlayerCallbacks) {
  let context: AudioContext | undefined;
  let output: HTMLAudioElement | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let source: AudioBufferSourceNode | undefined;
  const sources = new Set<AudioBufferSourceNode>();
  let pitch = 450;
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
    for (const node of sources) {
      node.onended = null;
      node.stop();
      node.disconnect();
    }
    sources.clear();
    source = undefined;
    // Keep the element and its stream loaded while paused. Disconnecting the
    // final Web Audio output makes WebKit discard its Now Playing candidate.
    output?.pause();
    callbacks.status(status);
  }
  function releaseOutput() {
    if (output) {
      output.onpause = null;
      output.onerror = null;
      output.pause();
      output.srcObject = null;
      output.remove();
      output = undefined;
    }
    destination?.stream.getTracks().forEach(track => track.stop());
    destination?.disconnect();
    destination = undefined;
  }
  function makeBuffer(nextRound: WordRound) {
    const samples = renderWordSamples(nextRound, pitch);
    const next = context!.createBuffer(1, samples.length, 22050);
    next.getChannelData(0).set(samples);
    return next;
  }
  function schedule(when: number, at: number) {
    const node = context!.createBufferSource();
    const run = generation;
    node.buffer = buffer!;
    node.connect(destination!);
    sources.add(node);
    node.onended = () => {
      sources.delete(node);
      node.disconnect();
      if (node !== source || !playing || generation !== run) return;
      checkpoint();
      playing = false;
      clearInterval(ticker);
      source = undefined;
      offset = round!.duration;
      output?.pause();
      callbacks.status("ended");
    };
    node.start(when, at);
    return node;
  }
  return {
    checkpoint,
    pause,
    setSpeed(wpm: number) {
      if (!round || !context || !buffer) return round;
      // Buffer rendering may cross a boundary. Recheck the audio clock before
      // scheduling, leaving the currently sounding word completely intact.
      for (let index = 0; index < round.words.length; index++) {
        const position = playing ? wordPlaybackPosition(offset, started, context.currentTime, round.duration) : offset;
        const boundary = round.starts[index];
        if (boundary < position + (playing ? 0.05 : 0)) continue;
        const next = retimeWordRound(round, wpm, index);
        const nextBuffer = makeBuffer(next);
        const when = started + boundary - offset;
        if (playing && when < context.currentTime + 0.02) continue;
        round = next;
        buffer = nextBuffer;
        if (playing) {
          const previous = source;
          source = schedule(when, boundary);
          previous?.stop(when);
        }
        return round;
      }
      return round; // Last word: the next round will use the new setting.
    },
    async play(nextRound: WordRound, nextPitch: number, restart = false) {
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
        releaseOutput();
        context = new AudioContextClass();
        destination = context.createMediaStreamDestination();
        output = document.createElement("audio");
        output.hidden = true;
        output.setAttribute("playsinline", "");
        output.srcObject = destination.stream;
        output.onpause = () => {
          if (playing && output?.paused) pause("interrupted");
        };
        output.onerror = () => { if (playing) pause("interrupted"); };
        document.body.append(output);
        context.onstatechange = () => {
          if (playing && context?.state !== "running") pause("interrupted");
        };
      }
      if (round !== nextRound || !buffer || restart) {
        round = nextRound;
        offset = 0;
        pitch = nextPitch;
        buffer = makeBuffer(round);
      }
      // Both calls run in the Play/Media Session gesture. The native element
      // carries the generated sound and owns the paused lock-screen transport;
      // no silent recording, microphone, or second audible path is involved.
      try {
        await Promise.all([context.resume(), output!.play()]);
      } catch (error) {
        if (disposed || generation !== run) return;
        pause();
        throw error;
      }
      if (disposed || generation !== run) return;
      if (context.state !== "running") throw new Error("Audio is interrupted. Return to this page and press Play.");
      if (offset >= round.duration) offset = 0;
      accounted = offset;
      started = context.currentTime;
      playing = true;
      source = schedule(0, offset);
      ticker = setInterval(checkpoint, 250);
      callbacks.status("playing");
    },
    dispose() {
      pause();
      disposed = true;
      releaseOutput();
      if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
      if (session && previousSessionType && session.type === "playback") {
        try { session.type = previousSessionType; } catch { /* Optional platform hint. */ }
      }
      buffer = undefined;
      round = undefined;
    },
  };
}
