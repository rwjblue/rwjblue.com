import { createWordDraft, checkWordSettings, restoreWordPractice, WORD_LISTS, type WordPracticeDraft } from "./word-practice.ts";
import { checkQsoSpeed, practiceQso, practiceSelection, PRACTICE_QSOS, type QsoPracticeDraft } from "./qso-practice.ts";

export type ListeningMode = "words" | "qsos" | "stories";
export type ListeningDraft = { mode: "words"; word: WordPracticeDraft }
  | { mode: "qsos" | "stories"; qso: QsoPracticeDraft };
export interface ListeningPreferences {
  version: 1;
  mode: ListeningMode;
  revealed: boolean;
  words?: WordPracticeDraft;
  qsos?: QsoPracticeDraft;
  stories?: QsoPracticeDraft;
}
export interface ListeningSession {
  version: 1;
  id: string;
  startedAt: string;
  activeSeconds: number;
  draft: ListeningDraft;
  ended: boolean;
  preset: string;
}
export function isListeningMode(value: unknown): value is ListeningMode {
  return value === "words" || value === "qsos" || value === "stories";
}
export function listeningSeconds(total: number, delta: number): number {
  return Math.min(14400, Math.max(0, Number.isFinite(total) ? total : 0)
    + Math.max(0, Number.isFinite(delta) ? delta : 0));
}
export function listeningTime(seconds: number): string {
  const rounded = Math.floor(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
export function createListeningDraft(mode: ListeningMode, preferences?: ListeningPreferences): ListeningDraft {
  if (mode === "words") return { mode, word: createWordDraft(preferences?.words) };
  const previous = preferences?.[mode];
  const qsoId = previous?.qsoId ?? PRACTICE_QSOS.find(item => (item.kind === "story") === (mode === "stories"))!.id;
  const qso: QsoPracticeDraft = { qsoId, wpm: previous?.wpm ?? 20, used: [] };
  practiceQso(qso);
  return { mode, qso };
}

/** Validate device-local drafts before generating audio; preserve existing scripts. */
export function restoreListeningDraft(value: unknown): ListeningDraft | undefined {
  try {
    const draft = structuredClone(value) as ListeningDraft;
    if (!draft || !isListeningMode(draft.mode)) return;
    if (draft.mode === "words") {
      const word = draft.word;
      if (!word || typeof word.title !== "string" || word.title.length > 100
        || typeof word.text !== "string" || word.text.length > 10000) return;
      checkWordSettings(word.settings);
      word.used = cleanNotes(word.used);
      restoreWordPractice(word);
      return { mode: "words", word };
    }
    const qso = draft.qso;
    if (!qso) return;
    checkQsoSpeed(qso.wpm);
    const selection = practiceSelection(qso.qsoId);
    if ((selection.kind === "story") !== (draft.mode === "stories")) return;
    qso.used = cleanNotes(qso.used);
    const generated = qso.generated;
    if (generated && (generated.id !== selection.id || generated.kind === "story"
      || typeof generated.title !== "string" || generated.title.length > 150
      || !Array.isArray(generated.stations) || generated.stations.length !== 2
      || !generated.stations.every(station => typeof station === "string" && station.length <= 40)
      || !Array.isArray(generated.lines) || !generated.lines.length || generated.lines.length > 30
      || !generated.lines.every(line => typeof line === "string" && line.length <= 1000))) return;
    return { mode: draft.mode, qso };
  } catch { return; }
}
function cleanNotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((note): note is string => typeof note === "string").slice(0, 16).map(note => note.slice(0, 1000)) : [];
}
export function restoreListeningPreferences(value: unknown): ListeningPreferences {
  const input = value as Partial<ListeningPreferences> | undefined;
  const result: ListeningPreferences = { version: 1, mode: "words", revealed: false };
  if (input?.version !== 1) return result;
  if (isListeningMode(input.mode)) result.mode = input.mode;
  result.revealed = input.revealed === true;
  const words = restoreListeningDraft({ mode: "words", word: input.words });
  if (words?.mode === "words") result.words = words.word;
  for (const mode of ["qsos", "stories"] as const) {
    const draft = restoreListeningDraft({ mode, qso: input[mode] });
    if (draft && draft.mode !== "words") result[mode] = draft.qso;
  }
  return result;
}
export function restoreListeningSession(value: unknown): ListeningSession | undefined {
  const input = value as ListeningSession | undefined;
  if (input?.version !== 1 || typeof input.id !== "string" || input.id.length > 100
    || !Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(input.activeSeconds)) return;
  const draft = restoreListeningDraft(input.draft);
  if (!draft) return;
  return { version: 1, id: input.id, startedAt: input.startedAt, activeSeconds: listeningSeconds(input.activeSeconds, 0),
    draft, ended: input.ended === true, preset: typeof input.preset === "string" ? input.preset.slice(0, 150) : "" };
}

/** Only catalog IDs can enter shareable links; never include custom text. */
export function listeningPreset(search: string): { key: string; mode?: ListeningMode; selection?: string } {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  if (!isListeningMode(mode)) return { key: "" };
  const selection = mode === "words" ? WORD_LISTS.find(item => item.id === params.get("list"))?.id
    : PRACTICE_QSOS.find(item => item.id === params.get(mode === "qsos" ? "scenario" : "story")
      && (item.kind === "story") === (mode === "stories"))?.id;
  return { key: `${mode}:${selection ?? ""}`, mode, selection };
}
export function applyListeningPreset(draft: ListeningDraft, selection?: string): void {
  if (!selection) return;
  if (draft.mode === "words") {
    const item = WORD_LISTS.find(item => item.id === selection);
    if (item) Object.assign(draft.word, { title: item.title, text: item.text });
  } else {
    const item = practiceSelection(selection);
    if ((item.kind === "story") !== (draft.mode === "stories")) return;
    draft.qso.qsoId = item.id;
    delete draft.qso.generated;
    practiceQso(draft.qso);
  }
}
