import type { ActiveBlock, TrainingDeviceState } from "./storage.ts";
import { createWordPracticeBlock } from "./word-practice.ts";
import { createQsoPracticeBlock } from "./qso-practice.ts";
import { practiceSelection } from "../cw-listening/qso-practice.ts";
import { listeningSeconds, type ListeningDraft, type ListeningMode, type ListeningPreferences } from "../cw-listening/session.ts";

export function listeningDraftForBlock(active: ActiveBlock): ListeningDraft {
  if (active.wordPractice) return { mode: "words", word: active.wordPractice };
  if (active.qsoPractice) return { mode: practiceSelection(active.qsoPractice.qsoId).kind === "story" ? "stories" : "qsos", qso: active.qsoPractice };
  throw new Error("This block does not contain listening practice.");
}
export function applyListeningTotal(active: ActiveBlock, total: number): void {
  active.activeSeconds = Math.max(active.activeSeconds, listeningSeconds(total, 0));
}
export function createTrainingListeningBlock(mode: ListeningMode, now: string, id: string,
  previous: Pick<TrainingDeviceState, "wordPracticeDefaults" | "qsoPracticeDefaults">, preferences: ListeningPreferences): ActiveBlock {
  if (mode === "words") return createWordPracticeBlock(now, id, preferences.words ?? previous.wordPracticeDefaults);
  const legacy = previous.qsoPracticeDefaults;
  const matchingLegacy = legacy && (practiceSelection(legacy.qsoId).kind === "story") === (mode === "stories") ? legacy : undefined;
  const defaults = preferences[mode] ?? matchingLegacy ?? { qsoId: mode === "stories" ? "story-trail" : "short-contact", wpm: 20, used: [] };
  return createQsoPracticeBlock(now, id, defaults);
}
