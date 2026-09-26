import { mountListeningPlayer } from "./player.ts";
import { applyListeningPreset, createListeningDraft, listeningPreset, listeningTime, type ListeningMode, type ListeningSession } from "./session.ts";
import { listeningPreferences, publicListeningSession, rememberListening, savePublicListeningSession } from "./storage.ts";
import type { WordPanel } from "./word-panel.ts";

let disposePrevious: (() => void) | undefined;
export function initCwListening(): void {
  disposePrevious?.();
  const host = document.getElementById("cw-listening-player");
  if (!host) return;
  let preferences = listeningPreferences();
  const preset = listeningPreset(location.search);
  let session = publicListeningSession();
  function fresh(mode: ListeningMode): ListeningSession {
    return { version: 1, id: crypto.randomUUID(), startedAt: new Date().toISOString(),
      activeSeconds: 0, draft: createListeningDraft(mode, preferences), ended: false, preset: preset.key };
  }
  if (!session || (preset.key && session.preset !== preset.key)) {
    session = fresh(preset.mode ?? preferences.mode);
    applyListeningPreset(session.draft, preset.selection);
  }
  let current: ListeningSession = session;
  let panel: WordPanel | undefined;
  let lastSaved = 0;
  let disposed = false;
  function persist() { savePublicListeningSession(current); }
  function changed() { rememberListening(current.draft, preferences.revealed); persist(); }
  function mount() {
    panel?.dispose();
    panel = undefined;
    if (current.ended) {
      host!.innerHTML = '<div class="listening-body"><h2>Session complete</h2><p data-session-total></p><button type="button">Start another session</button></div>';
      host!.querySelector("[data-session-total]")!.textContent = `${listeningTime(current.activeSeconds)} listened. Your settings are saved on this device.`;
      host!.querySelector("button")!.addEventListener("click", () => {
        preferences = listeningPreferences();
        current = fresh(current.draft.mode);
        mount(); persist();
      });
      return;
    }
    panel = mountListeningPlayer(host!, current.draft, {
      initialSeconds: current.activeSeconds, revealed: preferences.revealed,
      canPlay: () => !disposed && !current.ended,
      changed,
      revealChanged(revealed) { preferences.revealed = revealed; changed(); },
      progress(total) {
        current.activeSeconds = Math.max(current.activeSeconds, total);
        if (Date.now() - lastSaved > 3000) { lastSaved = Date.now(); persist(); }
      },
      changeMode(mode) {
        // Dispose before replacing the session draft so late media events cannot
        // change a new activity's counters or preferences.
        panel?.dispose(); panel = undefined;
        preferences = listeningPreferences();
        current.draft = createListeningDraft(mode, preferences);
        changed(); mount();
      },
      done() { current.ended = true; changed(); mount(); },
    });
    changed();
  }
  function checkpoint() { panel?.checkpoint(); persist(); }
  function hide() { panel?.pause(); persist(); }
  function dispose() {
    if (disposed) return;
    panel?.dispose(); panel = undefined; persist(); disposed = true;
    document.removeEventListener("visibilitychange", checkpoint);
    window.removeEventListener("pagehide", hide);
    document.removeEventListener("astro:before-swap", dispose);
  }
  document.addEventListener("visibilitychange", checkpoint);
  window.addEventListener("pagehide", hide);
  document.addEventListener("astro:before-swap", dispose);
  disposePrevious = dispose;
  mount();
}
