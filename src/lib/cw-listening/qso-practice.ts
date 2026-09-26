import { generateQso, QSO_TEMPLATES, type QsoTemplate } from "./qso-generator.ts";
import { PRACTICE_STORIES } from "../../data/cw-listening/stories.ts";
import type { PracticeQso } from "./qso-types.ts";
export type { PracticeQso } from "./qso-types.ts";
export const PRACTICE_QSOS: readonly (PracticeQso | QsoTemplate)[] = [...QSO_TEMPLATES, ...PRACTICE_STORIES];
export const QSO_PITCHES = [450, 500] as const;
export interface QsoPracticeDraft {
  qsoId: string;
  wpm: number;
  used: string[];
  /** Persist the complete exchange so replay, speed edits and reloads agree. */
  generated?: PracticeQso;
}
export function practiceSelection(id: string): PracticeQso | QsoTemplate {
  const selection = PRACTICE_QSOS.find(item => item.id === id);
  if (!selection) throw new Error("Choose a QSO or story from the list.");
  return selection;
}
export function practiceQso(draft: QsoPracticeDraft, random = Math.random): PracticeQso {
  const selection = practiceSelection(draft.qsoId);
  if (selection.kind !== "qso") return selection;
  if (draft.generated?.id !== selection.id) draft.generated = generateQso(selection.id, random);
  return draft.generated!;
}
export function newPracticeQso(draft: QsoPracticeDraft, random = Math.random): void {
  if (practiceSelection(draft.qsoId).kind !== "qso") return;
  draft.generated = generateQso(draft.qsoId, random, draft.generated?.stations);
}
export function checkQsoSpeed(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < 10 || wpm > 40) throw new Error("Use a speed between 10 and 40 WPM.");
}
export function recordQsoSettings(draft: QsoPracticeDraft): void {
  const item = practiceQso(draft);
  const note = `${item.title}: ${draft.wpm} WPM, ${item.kind === "story" ? "narrator 450 Hz" : `station tones 450 / 500 Hz, ${item.stations.join(" / ")}`}`;
  if (!draft.used.includes(note) && draft.used.length < 15) draft.used.push(note);
  else if (!draft.used.includes(note) && draft.used.length === 15) draft.used.push("Additional selections or speeds were played during this block.");
}
export function qsoPracticeNote(draft: QsoPracticeDraft): string {
  return `Browser QSO and story listening (original practice material, not on-air contacts).\n${draft.used.join("\n") || "No audio played."}`;
}
