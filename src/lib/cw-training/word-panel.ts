import { createWordRound, type WordRound, type WordSpeechClips } from "./word-round.ts";
import { checkWordSettings, COMMON_WORDS, recordWordSettings, restoreWordSettings, type WordPracticeDraft } from "./word-practice.ts";
import { loadWordRecording, loadWordSpeech } from "./word-assets.ts";
import { createWordPlayer } from "./word-player.ts";

export interface WordPanel {
  pause(): void;
  play(): void;
  checkpoint(): void;
  dispose(): void;
}

export function mountWordPanel(host: HTMLElement, draft: WordPracticeDraft, options: {
  bobText?: string;
  canPlay: () => boolean;
  changed: () => void;
  progress: (seconds: number) => void;
  done: () => void;
}): WordPanel {
  restoreWordSettings(draft.settings);
  host.innerHTML = `
    <div class="training-actions"><button type="button" data-word="play" class="primary">Play words</button><button type="button" data-word="reveal" aria-pressed="false">Show words</button><button type="button" data-word="done">Done</button></div>
    <p data-word="status" role="status">Ready. Press Play to listen.</p>
    <p data-word="position" class="training-small"></p>
    <p data-word="answer" class="training-word-answer" hidden></p>
    <div class="training-actions"><label class="training-check"><input data-word="spokenAnswers" type="checkbox" /> Three repeats + spoken answer</label></div>
    <div class="training-word-controls">
      <label>Word list<select data-word="list"><option value="common">30 common words</option>${options.bobText ? '<option value="bob">Bob\'s 77-word reference</option>' : ""}<option value="custom">Custom words</option></select></label>
      <label>Word speed (WPM)<input data-word="wpm" type="number" min="10" max="60" step="1" /></label>
      <label>Extra pause between words (seconds)<input data-word="gapSeconds" type="number" min="0" max="5" step="0.1" /></label>
      <label>Pitch (Hz)<input data-word="pitch" type="number" min="300" max="1000" step="10" /></label>
    </div>
    <p class="training-small" data-word="help"></p>
    <details class="training-panel"><summary>View or edit words</summary><div class="training-panel-body">
      <label>Words<textarea data-word="text" rows="5" maxlength="10000" spellcheck="false"></textarea></label>
      <p class="training-small">Separate entries with spaces or newlines. Duplicates are preserved. Edits become a custom list on this device. Bob's reference is his supplied text, not a verified transcript of the recording.</p>
    </div></details>
    <div class="training-actions">
      <label class="training-check"><input data-word="shuffle" type="checkbox" /> Shuffle each round</label>
      <label class="training-check"><input data-word="repeat" type="checkbox" /> Repeat rounds</label>
    </div>
    <p class="training-small">Listening time saves automatically when you choose Done or start another activity. Your progress is also saved on this device while you listen. If your phone interrupts audio, return here and press Play.</p>`;
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => host.querySelector<T>(`[data-word="${name}"]`)!;
  const input = (name: string) => $<HTMLInputElement>(name);
  const text = $<HTMLTextAreaElement>("text");
  const list = $<HTMLSelectElement>("list");
  list.value = draft.title === "30 common words" ? "common" : draft.title === "Bob's 77-word reference" && options.bobText ? "bob" : "custom";
  text.value = draft.text;
  for (const key of ["wpm", "gapSeconds", "pitch"] as const) input(key).value = String(draft.settings[key]);
  for (const key of ["shuffle", "repeat", "spokenAnswers"] as const) input(key).checked = !!draft.settings[key];
  let round: WordRound | undefined;
  let speechClips: WordSpeechClips | undefined;
  let recording: WordRound | undefined;
  let preparing = false;
  let preparationFailed = false;
  let preparation = 0;
  let speedChange = 0;
  let continueRound = false;
  let position = 0;
  let disposed = false;
  let busy = false;
  let playing = false;
  let generation = 0;
  let revealed = false;
  function playbackButton() {
    $("play").textContent = playing ? "Pause words" : preparing ? "Loading audio..." : busy ? "Starting..." : "Play words";
    $<HTMLButtonElement>("play").disabled = preparing || (busy && !playing);
  }
  function mediaInfo() {
    if (!("mediaSession" in navigator)) return;
    try {
      if (typeof MediaMetadata !== "undefined" && navigator.mediaSession.metadata?.title !== draft.title) navigator.mediaSession.metadata = new MediaMetadata({
        title: draft.title, artist: "CW word practice", album: "Word recognition",
      });
      if (round) navigator.mediaSession.setPositionState?.({ duration: round.duration, position: Math.min(position, round.duration), playbackRate: 1 });
      else navigator.mediaSession.setPositionState?.();
    } catch { /* Lock-screen integration is optional on this browser. */ }
  }
  function showPosition() {
    const index = round ? Math.max(0, round.starts.filter(start => start <= position).length - 1) : 0;
    $("position").textContent = round ? `Word ${index + 1} of ${round.words.length}` : "";
    $("answer").hidden = !revealed || !round;
    $("answer").textContent = round?.words[index] ?? "";
  }
  const player = createWordPlayer({
    progress(seconds, at) {
      position = at;
      options.progress(seconds);
      showPosition();
      mediaInfo();
    },
    status(status) {
      playing = status === "playing";
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      mediaInfo();
      playbackButton();
      $("status").textContent = status === "playing" ? "Listening. Pause whenever you need a break."
        : status === "interrupted" ? "Audio interrupted. Listening time is paused. Press Play to resume."
        : status === "ended" ? "Round complete." : "Paused. Press Play to continue.";
      if (status === "ended") {
        round = undefined;
        options.changed();
        continueRound = draft.settings.repeat;
        void prepare();
      }
    },
  });
  function pause() { continueRound = false; generation++; busy = false; player.pause(); options.changed(); }
  async function play() {
    if (disposed || !options.canPlay()) return;
    if (preparing) return;
    if (preparationFailed) { await prepare(); return; }
    if (busy || playing || disposed || !options.canPlay()) return;
    busy = true;
    playbackButton();
    const run = ++generation;
    try {
      if (!round) {
        round = recording ?? createWordRound(draft.text, draft.settings, Math.random, speechClips);
        position = 0;
        showPosition();
      }
      await player.play(round, draft.settings.pitch);
      if (disposed || generation !== run) return;
      recordWordSettings(draft);
      options.changed();
    } catch (error) {
      if (disposed || generation !== run) return;
      player.pause();
      $("status").textContent = error instanceof Error ? error.message : "Audio unavailable. Try Play again.";
    } finally {
      if (generation === run) { busy = false; playbackButton(); }
    }
  }
  function reset() {
    speedChange++;
    pause(); round = undefined; position = 0; showPosition();
    mediaInfo();
    $("status").textContent = "Ready for a new round. Press Play.";
  }
  function controls() {
    $("help").textContent = "Change speed while listening; the current item finishes at its original speed. Changing the list, pitch, spacing, or spoken answers starts a fresh round. Show or hide words at any time.";
    if (draft.settings.spokenAnswers) $("help").textContent += " Each word plays three times with normal Morse word spacing, then its spoken answer. The extra pause is between items, never between repeats.";
  }
  async function prepare() {
    const run = ++preparation;
    const settings = { ...draft.settings };
    const words = draft.text;
    let ready = false;
    preparing = true;
    preparationFailed = false;
    speechClips = undefined;
    recording = undefined;
    playbackButton();
    $("status").textContent = "Loading audio for this list...";
    try {
      checkWordSettings(settings);
      const nextRecording = await loadWordRecording(words, settings);
      if (disposed || run !== preparation) return false;
      const nextClips = !nextRecording && settings.spokenAnswers ? await loadWordSpeech(words) : undefined;
      if (disposed || run !== preparation) return false;
      recording = nextRecording;
      speechClips = nextClips;
      $("status").textContent = "Ready. Press Play to listen.";
      ready = true;
      return true;
    } catch (error) {
      if (disposed || run !== preparation) return false;
      preparationFailed = true;
      $("status").textContent = error instanceof Error ? error.message : "Audio unavailable. Press Play to retry.";
      return false;
    } finally {
      if (!disposed && run === preparation) {
        preparing = false;
        playbackButton();
        const resume = ready && continueRound && draft.settings.repeat;
        continueRound = false;
        if (resume) void play();
      }
    }
  }
  input("spokenAnswers").addEventListener("change", () => {
    reset();
    draft.settings.spokenAnswers = input("spokenAnswers").checked;
    controls();
    options.changed();
    void prepare();
  });
  for (const key of ["wpm", "gapSeconds", "pitch", "shuffle", "repeat"] as const) {
    input(key).addEventListener("change", async () => {
      if (key === "wpm") {
        const previous = draft.settings.wpm;
        const run = ++speedChange;
        const currentRound = round;
        try {
          const wpm = Number(input(key).value);
          checkWordSettings({ ...draft.settings, wpm });
          draft.settings.wpm = wpm;
          options.changed();
          if (currentRound && currentRound.settings.wpm !== wpm) {
            // Keep playing the MP3 while the clips needed for a live edit load.
            // The player converts at its current media position, preserving the
            // current item. Later rounds can use an MP3 again if settings match.
            const clips = currentRound.recordingUrl && currentRound.settings.spokenAnswers
              ? await loadWordSpeech(currentRound.words.join(" ")) : undefined;
            if (disposed || run !== speedChange || round !== currentRound) return;
            round = player.setSpeed(wpm, clips) ?? round;
            recording = undefined;
          }
          if (playing) recordWordSettings(draft);
          $("status").textContent = playing ? `${wpm} WPM from the next word; the current item finishes at its original speed.` : `Speed set to ${wpm} WPM.`;
          mediaInfo();
          options.changed();
          if (!round) void prepare();
        } catch (error) {
          if (disposed || run !== speedChange) return;
          draft.settings.wpm = previous;
          input(key).value = String(previous);
          options.changed();
          $("status").textContent = error instanceof Error ? error.message : "Unable to change speed.";
        }
        return;
      }
      if (key === "gapSeconds" || key === "pitch") reset();
      if (key === "shuffle" || key === "repeat") draft.settings[key] = input(key).checked;
      else draft.settings[key] = Number(input(key).value);
      if (playing) recordWordSettings(draft);
      options.changed();
      if (!round && key !== "repeat") void prepare();
    });
  }
  list.addEventListener("change", () => {
    reset();
    draft.title = list.value === "common" ? "30 common words" : list.value === "bob" ? "Bob's 77-word reference" : "Custom words";
    if (list.value !== "custom") draft.text = list.value === "common" ? COMMON_WORDS : options.bobText!;
    text.value = draft.text;
    options.changed();
    void prepare();
  });
  text.addEventListener("input", () => {
    reset(); draft.text = text.value; draft.title = "Custom words"; list.value = "custom";
    options.changed();
    void prepare();
  });
  $("reveal").addEventListener("click", () => {
    revealed = !revealed;
    $("reveal").textContent = revealed ? "Hide words" : "Show words";
    $("reveal").setAttribute("aria-pressed", String(revealed));
    showPosition();
  });
  $("play").addEventListener("click", () => { if (playing) pause(); else void play(); });
  $("done").addEventListener("click", options.done);
  controls();
  void prepare();
  return { play: () => void play(), pause, checkpoint: () => { player.checkpoint(); }, dispose() { disposed = true; preparation++; pause(); player.dispose(); round = undefined; mediaInfo(); host.replaceChildren(); } };
}
