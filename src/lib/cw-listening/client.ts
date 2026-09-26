import { mountListeningPlayer } from "./player.ts";
import { applyListeningPreset, createListeningDraft, listeningPreset, listeningLinkSettings, listeningTime, type ListeningMode, type ListeningSession } from "./session.ts";
import { listeningPreferences, publicListeningSession, rememberListening, savePublicListeningSession } from "./storage.ts";
import type { WordPanel } from "./word-panel.ts";

let disposePrevious: (() => void) | undefined;
export function initCwListening(): void {
  disposePrevious?.();
  disposePrevious = undefined;
  const host = document.getElementById("cw-listening-player");
  if (!host) return;
  const share = document.getElementById("cw-listening-share")!;
  const copy = share.querySelector<HTMLButtonElement>("[data-copy-listening-link]")!;
  const shareStatus = share.querySelector<HTMLElement>("[data-listening-share-status]")!;
  const fallback = share.querySelector<HTMLElement>("[data-listening-link-fallback]")!;
  const linkInput = fallback.querySelector("input")!;
  share.hidden = true;
  let preferences = listeningPreferences();
  const preset = listeningPreset(location.search);
  if (preset.error) {
    host.innerHTML = '<div class="listening-body"><h2>Unable to open this QSO</h2><p role="alert"></p><button type="button">Start new practice</button></div>';
    host.querySelector("p")!.textContent = preset.error;
    host.querySelector("button")!.addEventListener("click", () => {
      history.replaceState(history.state, "", location.pathname);
      initCwListening();
    });
    return;
  }
  preferences.revealed = preset.revealed ?? preferences.revealed;
  let session = publicListeningSession();
  function fresh(mode: ListeningMode): ListeningSession {
    return { version: 1, id: crypto.randomUUID(), startedAt: new Date().toISOString(),
      activeSeconds: 0, draft: createListeningDraft(mode, preferences), ended: false, preset: preset.key };
  }
  if (!session || (preset.key && session.preset !== preset.key)) {
    session = fresh(preset.mode ?? preferences.mode);
  }
  applyListeningPreset(session.draft, preset);
  let current: ListeningSession = session;
  let panel: WordPanel | undefined;
  let lastSaved = 0;
  let disposed = false;
  let shareUrl = "";
  function persist() { savePublicListeningSession(current); }
  function updateLink() {
    const settings = listeningLinkSettings(current.draft, preferences.revealed);
    const url = new URL(location.href);
    url.search = settings.search;
    current.preset = listeningPreset(url.search).key;
    if (url.href !== location.href) history.replaceState(history.state, "", url);
    share.hidden = current.draft.mode === "words" && !settings.shareable;
    copy.disabled = !settings.shareable;
    if (url.href !== shareUrl) {
      shareUrl = url.href;
      fallback.hidden = true;
      shareStatus.textContent = settings.shareable ? "Share this selection, speed, and text setting."
        : "Choose New QSO to make this older exchange shareable.";
    }
  }
  function changed() {
    if (disposed) return;
    updateLink(); rememberListening(current.draft, preferences.revealed); persist();
  }
  async function copyLink() {
    const copiedUrl = shareUrl;
    try {
      await navigator.clipboard.writeText(copiedUrl);
      if (!disposed && shareUrl === copiedUrl) shareStatus.textContent = "Link copied.";
    } catch {
      if (disposed || shareUrl !== copiedUrl) return;
      shareStatus.textContent = "Select and copy the link below.";
      fallback.hidden = false;
      linkInput.value = shareUrl;
      linkInput.focus(); linkInput.select();
    }
  }
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
    // Settle audio time, but do not rewrite an incoming URL while disposing the
    // old player during navigation or another initialization.
    disposed = true;
    panel?.dispose(); panel = undefined; persist();
    document.removeEventListener("visibilitychange", checkpoint);
    window.removeEventListener("pagehide", hide);
    document.removeEventListener("astro:before-swap", dispose);
    copy.removeEventListener("click", copyLink);
  }
  document.addEventListener("visibilitychange", checkpoint);
  window.addEventListener("pagehide", hide);
  document.addEventListener("astro:before-swap", dispose);
  copy.addEventListener("click", copyLink);
  disposePrevious = dispose;
  mount();
  updateLink();
}
