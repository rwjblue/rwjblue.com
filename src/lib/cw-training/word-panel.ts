import { createWordRound, type WordRound } from "./word-round.ts";
import { COMMON_WORDS, wordSettingsNote, type WordPracticeDraft } from "./word-practice.ts";
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
}): WordPanel {
  host.innerHTML = `
    <div class="training-actions"><button type="button" data-word="play" class="primary">Play words</button><button type="button" data-word="pause" disabled>Pause words</button><button type="button" data-word="new">New round</button></div>
    <p data-word="status" role="status">Ready. Press Play to listen.</p>
    <p data-word="position" class="training-small"></p>
    <p data-word="answer" class="training-word-answer" hidden></p>
    <div class="training-word-controls">
      <label>Word list<select data-word="list"><option value="common">30 common words</option>${options.bobText ? '<option value="bob">Bob\'s 77-word reference</option>' : ""}<option value="custom">Custom words</option></select></label>
      <label>Word speed (WPM)<input data-word="wpm" type="number" min="10" max="60" step="1" /></label>
      <label>Extra pause between words (seconds)<input data-word="gapSeconds" type="number" min="0" max="5" step="0.1" /></label>
      <label>Pitch (Hz)<input data-word="pitch" type="number" min="300" max="1000" step="10" /></label>
    </div>
    <p class="training-small">Each word keeps normal Morse spacing at the chosen speed. The extra pause comes after each word. Changes start a fresh round when you press Play.</p>
    <details class="training-panel"><summary>View or edit words</summary><div class="training-panel-body">
      <label>Words<textarea data-word="text" rows="5" maxlength="10000" spellcheck="false"></textarea></label>
      <p class="training-small">Separate entries with spaces or newlines. Duplicates are preserved. Edits become a custom list on this device. Bob's reference is his supplied text, not a verified transcript of the recording.</p>
    </div></details>
    <div class="training-actions">
      <label class="training-check"><input data-word="shuffle" type="checkbox" /> Shuffle each round</label>
      <label class="training-check"><input data-word="repeat" type="checkbox" /> Repeat rounds</label>
      <label class="training-check"><input data-word="reveal" type="checkbox" /> Show words while listening</label>
    </div>
    <p class="training-small">Listening time saves with this block. After reloading, the round starts again; saved listening time is retained. If your phone interrupts audio, return here and press Play.</p>`;
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => host.querySelector<T>(`[data-word="${name}"]`)!;
  const input = (name: string) => $<HTMLInputElement>(name);
  const text = $<HTMLTextAreaElement>("text");
  const list = $<HTMLSelectElement>("list");
  list.value = draft.title === "30 common words" ? "common" : draft.title === "Bob's 77-word reference" && options.bobText ? "bob" : "custom";
  text.value = draft.text;
  for (const key of ["wpm", "gapSeconds", "pitch"] as const) input(key).value = String(draft.settings[key]);
  for (const key of ["shuffle", "repeat"] as const) input(key).checked = draft.settings[key];
  let round: WordRound | undefined;
  let position = 0;
  let disposed = false;
  let busy = false;
  let playing = false;
  let generation = 0;
  function showPosition() {
    const index = round ? Math.max(0, round.starts.filter(start => start <= position).length - 1) : 0;
    $("position").textContent = round ? `Word ${index + 1} of ${round.words.length}` : "";
    $("answer").hidden = !input("reveal").checked || !round;
    $("answer").textContent = round?.words[index] ?? "";
  }
  const player = createWordPlayer({
    progress(seconds, at) {
      position = at;
      options.progress(seconds);
      showPosition();
    },
    status(status) {
      playing = status === "playing";
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      $<HTMLButtonElement>("pause").disabled = !playing;
      $<HTMLButtonElement>("play").disabled = playing || busy;
      $("status").textContent = status === "playing" ? "Listening. Pause whenever you need a break."
        : status === "interrupted" ? "Audio interrupted. Listening time is paused. Press Play to resume."
        : status === "ended" ? "Round complete." : "Paused. Press Play to continue.";
      if (status === "ended") {
        round = undefined;
        options.changed();
        if (draft.settings.repeat && !disposed) void play();
      }
    },
  });
  function pause() { generation++; busy = false; player.pause(); options.changed(); }
  async function play() {
    if (busy || playing || disposed || !options.canPlay()) return;
    busy = true;
    const run = ++generation;
    try {
      if (!round) round = createWordRound(draft.text, draft.settings);
      const summary = wordSettingsNote(draft);
      if (!draft.used.includes(summary) && draft.used.length >= 16) throw new Error("Save this block before trying more settings.");
      await player.play(round, draft.settings.pitch);
      if (disposed || generation !== run) return;
      if (!draft.used.includes(summary)) draft.used.push(summary);
      options.changed();
    } catch (error) {
      if (disposed || generation !== run) return;
      player.pause();
      $("status").textContent = error instanceof Error ? error.message : "Audio unavailable. Try Play again.";
    } finally {
      if (generation === run) { busy = false; $<HTMLButtonElement>("play").disabled = playing; }
    }
  }
  function reset() {
    pause(); round = undefined; position = 0; showPosition();
    $("status").textContent = "Ready for a new round. Press Play.";
  }
  for (const key of ["wpm", "gapSeconds", "pitch", "shuffle", "repeat"] as const) {
    input(key).addEventListener("change", () => {
      reset();
      if (key === "shuffle" || key === "repeat") draft.settings[key] = input(key).checked;
      else draft.settings[key] = Number(input(key).value);
      options.changed();
    });
  }
  list.addEventListener("change", () => {
    reset();
    draft.title = list.value === "common" ? "30 common words" : list.value === "bob" ? "Bob's 77-word reference" : "Custom words";
    if (list.value !== "custom") draft.text = list.value === "common" ? COMMON_WORDS : options.bobText!;
    text.value = draft.text;
    options.changed();
  });
  text.addEventListener("input", () => {
    reset(); draft.text = text.value; draft.title = "Custom words"; list.value = "custom"; options.changed();
  });
  input("reveal").addEventListener("change", showPosition);
  $("play").addEventListener("click", () => void play());
  $("pause").addEventListener("click", pause);
  $("new").addEventListener("click", reset);
  return { play: () => void play(), pause, checkpoint: () => { player.checkpoint(); }, dispose() { disposed = true; pause(); player.dispose(); host.replaceChildren(); } };
}
