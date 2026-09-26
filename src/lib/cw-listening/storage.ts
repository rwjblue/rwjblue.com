import { restoreListeningPreferences, restoreListeningSession, type ListeningDraft, type ListeningSession } from "./session.ts";

export const LISTENING_PREFERENCES_KEY = "cw-listening-preferences-v1";
export const LISTENING_SESSION_KEY = "cw-listening-session-v1";
function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return; }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Playback still works without storage. */ }
}
export function listeningPreferences() { return restoreListeningPreferences(read(LISTENING_PREFERENCES_KEY)); }
export function rememberListening(draft: ListeningDraft, revealed?: boolean): void {
  const preferences = listeningPreferences();
  preferences.mode = draft.mode;
  if (revealed !== undefined) preferences.revealed = revealed;
  if (draft.mode === "words") preferences.words = { ...structuredClone(draft.word), used: [] };
  else preferences[draft.mode] = { qsoId: draft.qso.qsoId, wpm: draft.qso.wpm, used: [] };
  write(LISTENING_PREFERENCES_KEY, preferences);
}
export function publicListeningSession() { return restoreListeningSession(read(LISTENING_SESSION_KEY)); }
export function savePublicListeningSession(session: ListeningSession) { write(LISTENING_SESSION_KEY, session); }
