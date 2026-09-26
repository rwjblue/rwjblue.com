import type { ActiveBlock } from "./storage.ts";
import type { TrainingAttempt } from "./types.ts";
import { PRACTICE_QSOS, practiceQso, qsoPracticeNote, type QsoPracticeDraft } from "../cw-listening/qso-practice.ts";
export * from "../cw-listening/qso-practice.ts";

export function qsoPracticeAttempt(active: ActiveBlock, endedAt: string): TrainingAttempt | undefined {
  if (!active.qsoPractice || !Number.isFinite(active.activeSeconds)) return;
  const activeSeconds = Math.min(14400, Math.floor(active.activeSeconds));
  if (activeSeconds < 1) return;
  return {
    id: active.id, assignmentId: "other-practice", taskId: "other:general",
    startedAt: new Date(Math.min(Date.parse(active.startedAt), Date.parse(endedAt) - activeSeconds * 1000)).toISOString(),
    endedAt, activeSeconds, completed: false, context: "practice", review: true,
    note: qsoPracticeNote(active.qsoPractice),
  };
}
export function createQsoPracticeBlock(now: string, id: string, previous?: QsoPracticeDraft): ActiveBlock {
  const draft: QsoPracticeDraft = { qsoId: previous?.qsoId ?? PRACTICE_QSOS[0].id, wpm: previous?.wpm ?? 20, used: [] };
  practiceQso(draft);
  return {
    id, assignmentId: "other-practice", task: {
      id: "other:general", kind: "review", title: "QSO and story listening",
      instructions: "Follow a complete contact or a short story. Listen for whole words and the details being shared.",
      sourceUrl: "", optional: true,
    },
    startedAt: now, targetMinutes: 10, activeSeconds: 0, completedPasses: 0,
    previousPasses: 0, targetPasses: 0, position: 0, coverage: [], bookmarks: [], context: "practice", review: true,
    qsoPractice: draft,
  };
}
