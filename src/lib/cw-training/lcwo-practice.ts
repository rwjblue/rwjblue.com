import type { LcwoRun } from "./lcwo-types.ts";
import type { TrainingAttempt, TrainingCourse } from "./types.ts";

/** One minute per completed code-group result, using the owner's practice setting.
 * Callers choose the date window; all saved attempts are checked for overlap,
 * including blocks that started before that window.
 */
export function lcwoPracticeMinutes(course: TrainingCourse, attempts: readonly TrainingAttempt[], imports: readonly LcwoRun[]) {
  const icrTasks = new Set(course.assignments.flatMap(assignment => assignment.tasks
    .filter(task => task.kind === "icr").map(task => task.id)));
  const blocks = [...new Map(attempts.map(attempt => [attempt.id, attempt])).values()]
    .filter(attempt => attempt.context === "practice" && attempt.activeSeconds > 0
      && (attempt.taskId === "other:icr" || icrTasks.has(attempt.taskId) || attempt.lcwoResult))
    .map(attempt => ({ start: Date.parse(attempt.startedAt), end: Date.parse(attempt.endedAt),
      // An ICR block may contain several drills even when one result is entered.
      kind: icrTasks.has(attempt.taskId) || attempt.taskId === "other:icr" ? undefined : attempt.lcwoResult?.kind }));
  const runs = [...new Map(imports.map(run => [run.id, run])).values()]
    .filter(run => run.sourceType === "groups" && ["letters", "figures", "custom"].includes(run.kind)
      && Number.isFinite(Date.parse(run.recordedAt)));
  const unloggedRuns = runs.filter(run => {
    const end = Date.parse(run.recordedAt);
    return !blocks.some(block => (!block.kind || block.kind === run.kind) && end >= block.start && end <= block.end);
  });
  return { runs, estimatedMinutes: runs.length, alreadyLoggedMinutes: runs.length - unloggedRuns.length,
    additionalMinutes: unloggedRuns.length, unloggedRuns };
}

/** Results completed after opening this block and through clicking Finish. */
export function lcwoBlockMinutes(course: TrainingCourse, attempts: readonly TrainingAttempt[], imports: readonly LcwoRun[], startedAt: string, endedAt: string): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return lcwoPracticeMinutes(course, attempts, imports.filter(run => {
    const completed = Date.parse(run.recordedAt);
    return completed > start && completed <= end;
  })).additionalMinutes;
}
