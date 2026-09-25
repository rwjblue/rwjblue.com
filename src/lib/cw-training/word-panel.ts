import { createWordRound, type WordRound, type WordSpeechClips } from "./word-round.ts";
import { checkWordSettings, COMMON_WORDS, COMMON_77_WORDS_TITLE, recordWordSettings, restoreWordPractice, type WordPracticeDraft } from "./word-practice.ts";
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
  restoreWordPractice(draft);
  host.innerHTML = `
    <div data-word="audio"></div>
    <div class="training-actions"><button type="button" data-word="reveal" aria-pressed="false">Show words</button><button type="button" data-word="done">Done</button></div>
    <p data-word="status" role="status">Ready. Press Play to listen.</p>
    <button type="button" data-word="retry" hidden>Retry audio</button>
    <p data-word="position" class="training-small"></p>
    <p data-word="answer" class="training-word-answer" hidden></p>
    <div class="training-actions"><label class="training-check"><input data-word="spokenAnswers" type="checkbox" /> Three repeats + spoken answer</label></div>
    <div class="training-word-controls">
      <label>Word list<select data-word="list"><option value="common">30 common words</option>${options.bobText ? `<option value="bob">${COMMON_77_WORDS_TITLE}</option>` : ""}<option value="custom">Custom words</option></select></label>
      <label>Word speed (WPM)<input data-word="wpm" type="number" min="10" max="60" step="1" /></label>
      <label>Extra pause between words (seconds)<input data-word="gapSeconds" type="number" min="0" max="5" step="0.1" /></label>
      <label>Pitch (Hz)<input data-word="pitch" type="number" min="300" max="1000" step="10" /></label>
    </div>
    <p class="training-small" data-word="help"></p>
    <details class="training-panel"><summary>View or edit words</summary><div class="training-panel-body">
      <label>Words<textarea data-word="text" rows="5" maxlength="10000" spellcheck="false"></textarea></label>
      <p class="training-small">Separate entries with spaces or newlines. Duplicates are preserved. Edits become a custom list on this device.</p>
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
  list.value = draft.title === "30 common words" ? "common" : draft.title === COMMON_77_WORDS_TITLE && options.bobText ? "bob" : "custom";
  text.value = draft.text;
  for (const key of ["wpm", "gapSeconds", "pitch"] as const) input(key).value = String(draft.settings[key]);
  for (const key of ["shuffle", "repeat", "spokenAnswers"] as const) input(key).checked = !!draft.settings[key];
  let round: WordRound | undefined;
  let speechClips: WordSpeechClips | undefined;
  let preparing = false;
  let preparationFailed = false;
  let preparation = 0;
  let speedChange = 0;
  let continueRound = false;
  let position = 0;
  let disposed = false;
  let busy = false;
  let playing = false;
  let started = false;
  let generation = 0;
  let revealed = false;
  function mediaInfo() {
    if (!("mediaSession" in navigator)) return;
    try {
      if (typeof MediaMetadata !== "undefined" && navigator.mediaSession.metadata?.title !== draft.title) navigator.mediaSession.metadata = new MediaMetadata({
        title: draft.title, artist: "CW word practice", album: "Word recognition",
      });
      if (round) navigator.mediaSession.setPositionState?.({ duration: round.duration, position: Math.min(position, round.duration), playbackRate: player.playbackRate });
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
    canPlay: () => !disposed && !preparing && options.canPlay(),
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
      $("status").textContent = status === "playing" ? "Listening. Pause whenever you need a break."
        : status === "interrupted" ? "Audio interrupted. Listening time is paused. Press Play to resume."
        : status === "ended" ? "Round complete." : "Paused. Press Play to continue.";
      if (playing) {
        started = true;
        recordWordSettings(draft);
        options.changed();
      } else if (status !== "ended") {
        continueRound = false;
        options.changed();
      }
      $("retry").hidden = status !== "interrupted";
      if (status === "ended") {
        started = false;
        round = undefined;
        player.clearRound();
        options.changed();
        continueRound = draft.settings.repeat;
        void prepare();
      }
    },
  }, $("audio"));
  function pause() { continueRound = false; generation++; busy = false; player.pause(); options.changed(); }
  async function play() {
    if (disposed || !options.canPlay()) return;
    if (preparing) return;
    if (preparationFailed) { await prepare(); return; }
    if (busy || playing || disposed || !options.canPlay()) return;
    busy = true;
    const run = ++generation;
    try {
      if (!round) return;
      await player.play(round, draft.settings.pitch);
      if (disposed || generation !== run) return;
    } catch (error) {
      if (disposed || generation !== run) return;
      player.pause();
      $("status").textContent = error instanceof Error ? error.message : "Audio unavailable. Try Play again.";
    } finally {
      if (generation === run) busy = false;
    }
  }
  function reset() {
    speedChange++;
    started = false;
    pause(); player.clearRound(); round = undefined; position = 0; showPosition();
    mediaInfo();
    $("status").textContent = "Ready for a new round. Press Play.";
  }
  function controls() {
    $("help").textContent = "Use the audio controls to play, pause, seek, and adjust volume. Change speed while listening; the current item finishes at its original speed. Changing the list, pitch, spacing, or spoken answers starts a fresh round. Show or hide words at any time.";
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
    $("retry").hidden = true;
    $("audio").setAttribute("aria-busy", "true");
    player.clearRound();
    round = undefined;
    position = 0;
    showPosition();
    $("status").textContent = "Loading audio for this list...";
    try {
      checkWordSettings(settings);
      const nextRecording = await loadWordRecording(words, settings);
      if (disposed || run !== preparation) return false;
      const nextClips = !nextRecording && settings.spokenAnswers ? await loadWordSpeech(words) : undefined;
      if (disposed || run !== preparation) return false;
      speechClips = nextClips;
      round = nextRecording ?? createWordRound(words, settings, Math.random, speechClips);
      player.prepare(round, settings.pitch);
      showPosition();
      mediaInfo();
      $("status").textContent = "Ready. Press Play to listen.";
      ready = true;
      return true;
    } catch (error) {
      if (disposed || run !== preparation) return false;
      preparationFailed = true;
      $("retry").hidden = false;
      $("status").textContent = error instanceof Error ? error.message : "Audio unavailable. Choose Retry audio.";
      return false;
    } finally {
      if (!disposed && run === preparation) {
        preparing = false;
        $("audio").setAttribute("aria-busy", "false");
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
          if (!started) {
            reset();
            void prepare();
            return;
          }
          if (currentRound && currentRound.settings.wpm !== wpm) {
            // Keep playing the MP3 while the clips needed for a live edit load.
            // The player converts at its current media position, preserving the
            // current item. Later rounds can use an MP3 again if settings match.
            const clips = currentRound.recordingUrl && currentRound.settings.spokenAnswers
              ? speechClips ?? await loadWordSpeech(currentRound.words.join(" ")) : undefined;
            if (disposed || run !== speedChange || round !== currentRound) return;
            round = player.setSpeed(wpm, clips) ?? round;
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
      if (key === "gapSeconds" || key === "pitch" || (key === "shuffle" && !started)) reset();
      if (key === "shuffle" || key === "repeat") draft.settings[key] = input(key).checked;
      else draft.settings[key] = Number(input(key).value);
      if (playing) recordWordSettings(draft);
      options.changed();
      if (!round && key !== "repeat") void prepare();
    });
  }
  list.addEventListener("change", () => {
    reset();
    draft.title = list.value === "common" ? "30 common words" : list.value === "bob" ? COMMON_77_WORDS_TITLE : "Custom words";
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
  $("retry").addEventListener("click", () => { void prepare(); });
  $("done").addEventListener("click", options.done);
  controls();
  void prepare();
  return { play: () => void play(), pause, checkpoint: () => { player.checkpoint(); }, dispose() { disposed = true; preparation++; pause(); player.dispose(); round = undefined; mediaInfo(); host.replaceChildren(); } };
}
