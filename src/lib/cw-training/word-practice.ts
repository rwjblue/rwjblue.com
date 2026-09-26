import type { ActiveBlock } from "./storage.ts";
import type { TrainingAttempt } from "./types.ts";
import { createWordDraft, wordPracticeNote, type WordPracticeDraft } from "../cw-listening/word-practice.ts";
export * from "../cw-listening/word-practice.ts";

/** Finish a quick listening visit without an editable time or completion claim. */
export function wordPracticeAttempt(active: ActiveBlock, endedAt: string): TrainingAttempt | undefined {
  if (!active.wordPractice || !Number.isFinite(active.activeSeconds)) return;
  const activeSeconds = Math.min(14400, Math.floor(active.activeSeconds));
  if (activeSeconds < 1) return;
  return {
    id: active.id, assignmentId: "other-practice", taskId: "other:word-recognition",
    startedAt: new Date(Math.min(Date.parse(active.startedAt), Date.parse(endedAt) - activeSeconds * 1000)).toISOString(),
    endedAt, activeSeconds, completed: false, context: "practice", review: true,
    note: wordPracticeNote(active.wordPractice),
  };
}

export function createWordPracticeBlock(now: string, id: string, previous?: WordPracticeDraft): ActiveBlock {
  const draft = createWordDraft(previous);
  return {
    id, assignmentId: "other-practice", task: {
      id: "other:word-recognition", kind: "review", title: "Word recognition",
      instructions: "Listen for whole words. Adjust the speed and pause between words, or shuffle the list for a new round.",
      sourceUrl: "", optional: true,
    },
    startedAt: now, targetMinutes: 10, activeSeconds: 0, completedPasses: 0,
    previousPasses: 0, targetPasses: 0, position: 0, coverage: [], bookmarks: [],
    context: "practice", review: true,
    wordPractice: draft,
  };
}
