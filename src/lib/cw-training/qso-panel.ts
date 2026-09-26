import { PRACTICE_QSOS, practiceQso, recordQsoSettings, type QsoPracticeDraft } from "./qso-practice.ts";
import { createQsoRound, qsoPosition, type QsoRound } from "./qso-round.ts";
import { createWordPlayer } from "./word-player.ts";
import type { WordPanel } from "./word-panel.ts";

export function mountQsoPanel(host: HTMLElement, draft: QsoPracticeDraft, options: {
  canPlay: () => boolean;
  changed: () => void;
  progress: (seconds: number) => void;
  done: () => void;
}): WordPanel {
  host.innerHTML = `
    <div class="training-word-controls">
      <label>QSO or story<select data-qso="selection"></select></label>
      <label>Speed (WPM)<input data-qso="wpm" type="number" min="10" max="40" step="1" required /></label>
    </div>
    <p data-qso="description" class="training-small"></p>
    <div data-qso="audio"></div>
    <div class="training-actions"><button type="button" data-qso="reveal" aria-pressed="false">Show text</button><button type="button" data-qso="done">Done</button></div>
    <p data-qso="status" role="status"></p>
    <p data-qso="position" class="training-small"></p>
    <div data-qso="display" class="training-qso-display" hidden>
      <p data-qso="station" class="eyebrow"></p>
      <p data-qso="line" class="training-word-answer"></p>
    </div>
    <p class="training-small">Show text to follow the current line and highlighted word. Use the audio controls to pause, seek, or replay. Changing the selection or speed restarts from the beginning.</p>
    <p class="training-small">Original practice stories and example contacts. Listening time saves when you choose Done or start another activity.</p>`;
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => host.querySelector<T>(`[data-qso="${name}"]`)!;
  const selection = $<HTMLSelectElement>("selection");
  for (const [kind, label] of [["qso", "Two-station QSOs"], ["story", "Short stories"]]) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const item of PRACTICE_QSOS.filter(item => (item.kind ?? "qso") === kind)) group.append(new Option(item.title, item.id));
    selection.append(group);
  }
  selection.value = draft.qsoId;
  const speed = $<HTMLInputElement>("wpm");
  speed.value = String(draft.wpm);
  let round: QsoRound | undefined;
  let at = 0;
  let revealed = false;
  let disposed = false;
  let displayedLine = -1;
  let displayedWord = -1;
  let wordSpans: HTMLElement[] = [];
  function showPosition() {
    if (!round) return;
    const position = qsoPosition(round, at);
    const line = round.lines[position.line];
    const story = practiceQso(draft.qsoId).kind === "story";
    $("position").textContent = `${story ? "Line" : "Transmission"} ${position.line + 1} of ${round.lines.length}${at >= round.duration ? " · Complete" : at >= line.end ? " · Pause" : ""}`;
    $("display").hidden = !revealed;
    if (displayedLine !== position.line) {
      displayedLine = position.line;
      displayedWord = -1;
      $("station").textContent = `${line.station} · ${line.pitch} Hz`;
      $("line").replaceChildren();
      wordSpans = round.words.slice(line.firstWord, line.firstWord + line.wordCount).map((word, index) => {
        const span = document.createElement("span");
        span.textContent = word;
        if (index) $("line").append(" ");
        $("line").append(span);
        return span;
      });
    }
    const word = position.word < 0 ? -1 : position.word - line.firstWord;
    if (displayedWord !== word) {
      wordSpans[displayedWord]?.removeAttribute("aria-current");
      wordSpans[word]?.setAttribute("aria-current", "true");
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
      if (typeof MediaMetadata !== "undefined") navigator.mediaSession.metadata = new MediaMetadata({ title: practiceQso(draft.qsoId).title, artist: "CW QSO and story listening" });
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
  function prepare() {
    player.pause();
    player.clearRound();
    round = undefined;
    at = 0;
    displayedLine = -1;
    $("display").hidden = true;
    $("position").textContent = "";
    try {
      const item = practiceQso(draft.qsoId);
      round = createQsoRound(item, draft.wpm);
      player.prepare(round, 450);
      const duration = Math.floor(round.duration);
      const minutes = Math.floor(duration / 60);
      const seconds = String(duration % 60).padStart(2, "0");
      $("description").textContent = `${item.kind === "story" ? "Narrator: 450 Hz" : `${item.stations[0]}: 450 Hz · ${item.stations[1]}: 500 Hz`} · ${minutes}:${seconds} at ${draft.wpm} WPM`;
      showPosition();
      mediaInfo();
      mediaPosition();
      $("status").textContent = "Ready. Press Play to listen.";
    } catch (error) {
      $("status").textContent = error instanceof Error ? error.message : "Unable to prepare audio.";
    }
  }
  selection.addEventListener("change", () => {
    player.pause();
    draft.qsoId = selection.value;
    prepare();
    options.changed();
  });
  speed.addEventListener("change", () => {
    if (!speed.checkValidity()) { speed.reportValidity(); speed.value = String(draft.wpm); return; }
    player.pause();
    draft.wpm = Number(speed.value);
    prepare();
    options.changed();
  });
  $("reveal").addEventListener("click", () => {
    revealed = !revealed;
    $("reveal").textContent = revealed ? "Hide text" : "Show text";
    $("reveal").setAttribute("aria-pressed", String(revealed));
    showPosition();
  });
  $("done").addEventListener("click", options.done);
  prepare();
  return {
    pause: () => player.pause(), checkpoint: () => { player.checkpoint(); },
    play: () => { if (round && !disposed && options.canPlay()) void player.play(round, 450).catch(() => {}); },
    dispose() { player.pause(); disposed = true; player.dispose(); round = undefined; mediaPosition(); host.replaceChildren(); },
  };
}
