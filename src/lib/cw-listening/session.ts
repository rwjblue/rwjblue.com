import { createWordDraft, checkWordSettings, restoreWordPractice, WORD_LISTS, type WordPracticeDraft } from "./word-practice.ts";
import { checkQsoSpeed, practiceQso, practiceSelection, PRACTICE_QSOS, type QsoPracticeDraft } from "./qso-practice.ts";
import { qsoFromRecipe, shareableQsoRecipe } from "./qso-generator.ts";
import type { PracticeQso } from "./qso-types.ts";

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

export interface ListeningPreset {
  key: string;
  mode?: ListeningMode;
  selection?: string;
  wpm?: number;
  revealed?: boolean;
  generated?: PracticeQso;
  error?: string;
}

/** Public links contain catalog IDs and bounded pool indexes, never arbitrary text. */
export function listeningPreset(search: string): ListeningPreset {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const result: ListeningPreset = { key: "" };
  const wpm = Number(params.get("wpm"));
  if (Number.isFinite(wpm) && wpm >= 10 && wpm <= 60) result.wpm = wpm;
  if (params.get("text") === "show") result.revealed = true;
  if (params.get("text") === "hide") result.revealed = false;
  if (params.has("qso")) {
    try {
      const generated = qsoFromRecipe(params.get("qso")!);
      if ((mode && mode !== "qsos") || (params.has("scenario") && params.get("scenario") !== generated.id)) {
        throw new Error("This QSO link has conflicting selections.");
      }
      return { ...result, key: `qsos:${generated.id}:${generated.recipe}`, mode: "qsos", selection: generated.id, generated };
    } catch (error) {
      return { ...result, error: error instanceof Error ? error.message : "Unable to open this QSO link." };
    }
  }
  if (!isListeningMode(mode)) return result;
  const selection = mode === "words" ? WORD_LISTS.find(item => item.id === params.get("list"))?.id
    : PRACTICE_QSOS.find(item => item.id === params.get(mode === "qsos" ? "scenario" : "story")
      && (item.kind === "story") === (mode === "stories"))?.id;
  return { ...result, key: `${mode}:${selection ?? ""}`, mode, selection };
}
export function applyListeningPreset(draft: ListeningDraft, preset: ListeningPreset): void {
  if (preset.mode && draft.mode !== preset.mode) return;
  if (draft.mode === "words") {
    const item = WORD_LISTS.find(item => item.id === preset.selection);
    if (item) Object.assign(draft.word, { title: item.title, text: item.text });
    if (preset.wpm !== undefined) draft.word.settings.wpm = preset.wpm;
  } else {
    if (preset.selection) {
      const item = practiceSelection(preset.selection);
      if ((item.kind === "story") !== (draft.mode === "stories")) return;
      draft.qso.qsoId = item.id;
    }
    if (preset.generated) draft.qso.generated = structuredClone(preset.generated);
    if (preset.wpm !== undefined) draft.qso.wpm = preset.wpm;
    practiceQso(draft.qso);
  }
}

export function listeningLinkSettings(draft: ListeningDraft, revealed: boolean): { search: string; shareable: boolean } {
  const params = new URLSearchParams({ mode: draft.mode });
  let shareable = true;
  if (draft.mode === "words") {
    const list = WORD_LISTS.find(item => item.title === draft.word.title && item.text === draft.word.text);
    params.set("list", list?.id ?? "custom");
    shareable = !!list;
    params.set("wpm", String(draft.word.settings.wpm));
  } else {
    params.set(draft.mode === "qsos" ? "scenario" : "story", draft.qso.qsoId);
    params.set("wpm", String(draft.qso.wpm));
    if (draft.mode === "qsos") {
      const recipe = shareableQsoRecipe(practiceQso(draft.qso));
      if (recipe) params.set("qso", recipe);
      shareable = !!recipe;
    }
  }
  params.set("text", revealed ? "show" : "hide");
  return { search: `?${params}`, shareable };
}
