import { renderWordWav, retimeWordRound, type WordRound } from "./word-round.ts";

export interface WordPlayerCallbacks {
  progress: (seconds: number, position: number) => void;
  status: (status: "playing" | "paused" | "interrupted" | "ended") => void;
}

/** Native playback of locally generated audio, independent of an AudioContext. */
export function createWordPlayer(callbacks: WordPlayerCallbacks) {
  let output: HTMLAudioElement | undefined;
  let url: string | undefined;
  let pitch = 450;
  let round: WordRound | undefined;
  let accounted = 0;
  let pendingSeek: number | undefined;
  let generation = 0;
  let playing = false;
  let disposed = false;
  let ticker: ReturnType<typeof setInterval> | undefined;

  function position() {
    return Math.min(round?.duration ?? 0, Math.max(0, pendingSeek ?? output?.currentTime ?? 0));
  }
  function checkpoint() {
    const at = position();
    if (!playing) return at;
    const delta = Math.max(0, at - accounted);
    accounted = at;
    callbacks.progress(delta, at);
    return at;
  }
  function pause(status: "paused" | "interrupted" = "paused") {
    generation++;
    checkpoint();
    playing = false;
    clearInterval(ticker);
    // Keep the recording loaded, including its native playback position.
    output?.pause();
    callbacks.status(status);
  }
  function markPlaying() {
    if (disposed || !output || output.paused || playing) return;
    playing = true;
    ticker = setInterval(checkpoint, 250);
    callbacks.status("playing");
  }
  function ensureOutput() {
    if (output) return;
    output = document.createElement("audio");
    output.hidden = true;
    output.preload = "auto";
    output.setAttribute("playsinline", "");
    output.onplaying = markPlaying;
    output.ontimeupdate = checkpoint;
    output.onloadedmetadata = () => {
      if (pendingSeek !== undefined) {
        output!.currentTime = pendingSeek;
        pendingSeek = undefined;
      }
    };
    output.onpause = () => {
      if (playing && output?.paused && !output.ended) pause("interrupted");
    };
    output.onerror = () => pause("interrupted");
    output.onended = () => {
      if (disposed || !output?.ended || !round) return;
      checkpoint();
      playing = false;
      clearInterval(ticker);
      callbacks.status("ended");
    };
    document.body.append(output);
  }
  function load(recording: Blob, at: number) {
    const nextUrl = URL.createObjectURL(recording);
    generation++;
    playing = false;
    clearInterval(ticker);
    const previousUrl = url;
    url = nextUrl;
    pendingSeek = at;
    accounted = at;
    output!.src = nextUrl;
    // The pre-metadata value is the media element's default start position.
    // Reapply on metadata for browsers that defer seeking until then.
    output!.currentTime = at;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }
  async function start() {
    const run = ++generation;
    try {
      // Invoke directly in the click or Media Session handler. There is no
      // suspended Web Audio context or live stream to restart in the background.
      await output!.play();
    } catch (error) {
      if (disposed || generation !== run) return;
      pause("interrupted");
      throw error;
    }
    if (disposed || generation !== run) return;
    markPlaying();
  }
  return {
    checkpoint,
    pause,
    setSpeed(wpm: number) {
      if (!round || !output) return round;
      for (let index = 0; index < round.words.length; index++) {
        const boundary = round.starts[index];
        if (boundary < position() + (playing ? 0.05 : 0)) continue;
        const next = retimeWordRound(round, wpm, index);
        const recording = renderWordWav(next, pitch);
        // Rendering can cross a word boundary while native playback continues.
        if (boundary < position() + (playing ? 0.02 : 0)) continue;
        const resume = !output.paused;
        const at = checkpoint();
        round = next;
        load(recording, at);
        if (resume) void start().catch(() => { /* start reports interruption. */ });
        return round;
      }
      return round; // Last word: the next round will use the new setting.
    },
    async play(nextRound: WordRound, nextPitch: number, restart = false) {
      if (disposed) throw new Error("Word player has been disposed.");
      ensureOutput();
      if (round !== nextRound || pitch !== nextPitch || restart) {
        const recording = renderWordWav(nextRound, nextPitch);
        checkpoint();
        round = nextRound;
        pitch = nextPitch;
        load(recording, 0);
      } else if (position() >= round.duration || output!.ended) {
        output!.currentTime = 0;
        accounted = 0;
      }
      await start();
    },
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      if (output) {
        output.onplaying = output.onpause = output.onerror = output.onended = null;
        output.ontimeupdate = output.onloadedmetadata = null;
        output.removeAttribute("src");
        output.load();
        output.remove();
        output = undefined;
      }
      if (url) URL.revokeObjectURL(url);
      url = undefined;
      round = undefined;
    },
  };
}
