import { mountWordPanel, type WordPanel } from "./word-panel.ts";
import { mountQsoPanel } from "./qso-panel.ts";
import { listeningSeconds, listeningTime, type ListeningDraft, type ListeningMode } from "./session.ts";

export interface ListeningPlayerOptions {
  initialSeconds: number;
  tracking?: boolean;
  revealed: boolean;
  canPlay: () => boolean;
  changed: () => void;
  revealChanged: (revealed: boolean) => void;
  /** Cumulative listened seconds, including the restored initial total. */
  progress: (total: number) => void;
  changeMode: (mode: ListeningMode) => void;
  done: () => void;
}

/** The public page and trainer mount this same interface and native audio player. */
export function mountListeningPlayer(host: HTMLElement, draft: ListeningDraft, options: ListeningPlayerOptions): WordPanel {
  host.classList.add("cw-listening");
  host.innerHTML = `${options.tracking ? '<p class="listening-tracking"><strong>Tracking toward today\'s practice</strong> &middot; Saves when you finish or change activities.</p>' : ''}
    <div class="listening-tabs" role="group" aria-label="Listening mode"></div>
    <section class="listening-body" aria-label="Listening player"></section>`;
  let total = listeningSeconds(options.initialSeconds, 0);
  let disposed = false;
  const tabs = host.querySelector<HTMLElement>(".listening-tabs")!;
  const body = host.querySelector<HTMLElement>(".listening-body")!;
  const counter = document.createElement("span");
  counter.className = "listening-counter";
  counter.dataset.listeningCounter = "";
  counter.textContent = `${listeningTime(total)} listened`;
  const callbacks = {
    canPlay: () => !disposed && options.canPlay(),
    changed: options.changed,
    revealed: options.revealed,
    revealChanged: options.revealChanged,
    doneLabel: options.tracking ? "Done and save" : "End session",
    progress(delta: number) {
      const next = listeningSeconds(total, delta);
      if (next === total) return;
      total = next;
      counter.textContent = `${listeningTime(total)} listened`;
      options.progress(total);
    },
    done() { panel.pause(); options.done(); },
  };
  const panel = draft.mode === "words" ? mountWordPanel(body, draft.word, callbacks)
    : mountQsoPanel(body, draft.qso, { ...callbacks, mode: draft.mode });
  body.querySelector("[data-transport-actions]")!.append(counter);
  for (const [mode, label] of [["words", "Words"], ["qsos", "QSOs"], ["stories", "Stories"]] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.listeningMode = mode;
    button.setAttribute("aria-pressed", String(mode === draft.mode));
    button.addEventListener("click", () => {
      if (disposed || mode === draft.mode) return;
      panel.pause();
      options.changeMode(mode);
    });
    tabs.append(button);
  }
  return { play: () => panel.play(), pause: () => panel.pause(), checkpoint: () => panel.checkpoint(),
    dispose() { if (disposed) return; panel.dispose(); disposed = true; host.replaceChildren(); } };
}
