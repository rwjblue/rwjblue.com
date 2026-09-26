import { PRACTICE_QSOS, practiceQso, practiceSelection, newPracticeQso, recordQsoSettings, type QsoPracticeDraft } from "./qso-practice.ts";
import { createQsoRound, qsoPosition, retimedQsoPosition, type QsoRound } from "./qso-round.ts";
import { createWordPlayer } from "./word-player.ts";
import { mountSpeedControl } from "./speed-control.ts";
import type { WordPanel } from "./word-panel.ts";

export function mountQsoPanel(host: HTMLElement, draft: QsoPracticeDraft, options: {
  mode?: "qsos" | "stories";
  revealed?: boolean;
  revealChanged?: (revealed: boolean) => void;
  doneLabel?: string;
  canPlay: () => boolean;
  changed: () => void;
  progress: (seconds: number) => void;
  done: () => void;
}): WordPanel {
  host.innerHTML = `
    <div class="listening-controls">
      <label><span data-qso="selection-label"></span><select data-qso="selection"></select></label>
      <div data-qso="speed"></div>
    </div>
    <p data-qso="description" class="listening-small"></p>
    <div data-qso="audio"></div>
    <div class="listening-actions" data-transport-actions><button type="button" data-qso="reveal" aria-pressed="false">Show text</button><button type="button" data-qso="new">New QSO</button><button type="button" data-qso="done">Done</button></div>
    <p data-qso="status" class="listening-small" role="status"></p>
    <p data-qso="position" class="listening-small"></p>
    <div data-qso="display" class="listening-display" hidden>
      <p data-qso="station" class="eyebrow"></p>
      <p data-qso="line" class="listening-line"></p>
    </div>
    <p class="listening-small">Show text to follow the current line and highlighted word. Tap any word to jump to its beginning. A speed change restarts the current word and keeps playing if it was already playing. Changing the selection starts from the beginning.</p>
    <p class="listening-small" data-qso="help"></p>`;
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => host.querySelector<T>(`[data-qso="${name}"]`)!;
  const selection = $<HTMLSelectElement>("selection");
  $("done").textContent = options.doneLabel ?? "End session";
  $("selection-label").textContent = options.mode === "stories" ? "Story" : "QSO scenario";
  for (const [kind, label] of [["qso", "Two-station QSOs"], ["story", "Short stories"]]) {
    if (options.mode && (options.mode === "stories" ? "story" : "qso") !== kind) continue;
    const group = document.createElement("optgroup");
    group.label = label;
    for (const item of PRACTICE_QSOS.filter(item => (item.kind ?? "qso") === kind)) group.append(new Option(item.title, item.id));
    selection.append(group);
  }
  selection.value = draft.qsoId;
  mountSpeedControl($("speed"), draft.wpm, wpm => {
    if (wpm === draft.wpm) return;
    draft.wpm = wpm;
    prepare(true);
  });
  let round: QsoRound | undefined;
  let at = 0;
  let revealed = options.revealed ?? false;
  let disposed = false;
  let displayedLine = -1;
  let displayedWord = -1;
  let wordButtons: HTMLButtonElement[] = [];
  function showPosition() {
    $("reveal").textContent = revealed ? "Hide text" : "Show text";
    $("reveal").setAttribute("aria-pressed", String(revealed));
    if (!round) return;
    const position = qsoPosition(round, at);
    const line = round.lines[position.line];
    const story = practiceSelection(draft.qsoId).kind === "story";
    $("position").textContent = `${story ? "Sentence" : "Transmission"} ${position.line + 1} of ${round.lines.length}${at >= round.duration ? " · Complete" : at >= line.end ? " · Pause" : ""}`;
    $("display").hidden = !revealed;
    if (displayedLine !== position.line) {
      displayedLine = position.line;
      displayedWord = -1;
      $("station").textContent = `${line.station} · ${line.pitch} Hz`;
      $("line").replaceChildren();
      wordButtons = round.words.slice(line.firstWord, line.firstWord + line.wordCount).map((word, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "listening-seek-word";
        button.textContent = word;
        button.setAttribute("aria-label", `Jump to start of ${word}`);
        button.addEventListener("click", () => player.seekWord(line.firstWord + index));
        if (index) $("line").append(" ");
        $("line").append(button);
        return button;
      });
    }
    const word = position.word < 0 ? -1 : position.word - line.firstWord;
    if (displayedWord !== word) {
      wordButtons[displayedWord]?.removeAttribute("aria-current");
      wordButtons[word]?.setAttribute("aria-current", "true");
      displayedWord = word;
    }
  }
  function mediaPosition() {
    if (!("mediaSession" in navigator)) return;
    try {
      if (round) navigator.mediaSession.setPositionState?.({ duration: round.duration, position: Math.min(at, round.duration), playbackRate: player.playbackRate });
      else navigator.mediaSession.setPositionState?.();
    } catch { /* Optional lock-screen position. */ }
  }
  function mediaInfo(playing = false) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      if (typeof MediaMetadata !== "undefined") navigator.mediaSession.metadata = new MediaMetadata({ title: practiceSelection(draft.qsoId).title, artist: "CW QSO and story listening" });
    } catch { /* Optional lock-screen metadata. */ }
  }
  const player = createWordPlayer({
    positionIntervalMs: 50,
    canPlay: () => !disposed && options.canPlay(),
    progress(seconds, position) { at = position; options.progress(seconds); showPosition(); mediaPosition(); },
    status(status) {
      if (disposed) return;
      $("status").textContent = status === "playing" ? "Listening. Pause whenever you need a break."
        : status === "ended" ? "Complete. Press Play to listen again or choose another selection."
        : status === "interrupted" ? "Audio interrupted. Press Play to retry."
        : "Paused. Press Play to continue.";
      if (status === "playing") recordQsoSettings(draft);
      mediaInfo(status === "playing");
      options.changed();
    },
  }, $("audio"), "QSO and story audio");
  function prepare(preservePosition = false) {
    const previous = round;
    const previousAt = player.checkpoint();
    const resume = preservePosition && !player.paused;
    player.pause();
    player.clearRound();
    round = undefined;
    at = 0;
    displayedLine = -1;
    $("display").hidden = true;
    $("position").textContent = "";
    try {
      const item = practiceQso(draft);
      $("new").hidden = item.kind === "story";
      $("help").textContent = item.kind === "story"
        ? "Original stories for sentence-by-sentence listening. Replay keeps the same story."
        : "Generated practice contacts. New QSO changes the station details; replay keeps this exchange.";
      round = createQsoRound(item, draft.wpm);
      player.prepare(round, 450);
      if (preservePosition && previous) player.seek(retimedQsoPosition(previous, round, previousAt));
      const duration = Math.floor(round.duration);
      const minutes = Math.floor(duration / 60);
      const seconds = String(duration % 60).padStart(2, "0");
      $("description").textContent = `${item.kind === "story" ? "Narrator: 450 Hz" : `${item.stations[0]}: 450 Hz · ${item.stations[1]}: 500 Hz`} · ${minutes}:${seconds} at ${draft.wpm} WPM`;
      showPosition();
      mediaInfo();
      mediaPosition();
      $("status").textContent = preservePosition ? "Speed updated. Press Play to continue." : "Ready. Press Play to listen.";
      options.changed();
      if (resume && options.canPlay()) void player.play(round, 450).catch(() => { /* Player reports interruptions. */ });
    } catch (error) {
      $("status").textContent = error instanceof Error ? error.message : "Unable to prepare audio.";
    }
  }
  selection.addEventListener("change", () => {
    player.pause();
    draft.qsoId = selection.value;
    delete draft.generated;
    prepare();
    options.changed();
  });
  $("new").addEventListener("click", () => {
    player.pause();
    newPracticeQso(draft);
    prepare();
  });
  $("reveal").addEventListener("click", () => {
    revealed = !revealed;
    options.revealChanged?.(revealed);
    $("reveal").textContent = revealed ? "Hide text" : "Show text";
    $("reveal").setAttribute("aria-pressed", String(revealed));
    showPosition();
  });
  $("done").addEventListener("click", options.done);
  prepare();
  return {
    pause: () => player.pause(), checkpoint: () => { player.checkpoint(); },
    seekBy: seconds => player.seekBy(seconds),
    play: () => { if (round && !disposed && options.canPlay()) void player.play(round, 450).catch(() => {}); },
    dispose() { player.pause(); disposed = true; player.dispose(); round = undefined; mediaPosition(); host.replaceChildren(); },
  };
}
