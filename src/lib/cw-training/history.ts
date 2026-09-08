import { dateInTimezone } from "./plan.ts";
import { isMorseRunner } from "./morse-runner.ts";
import { otherPracticeActivity } from "./other-practice.ts";
import type { TrainingAttempt, TrainingCourse, TrainingMaterial } from "./types.ts";

const escapes: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapes[character]);

/** A dismissal is queue bookkeeping, not a practice session. */
function hasPractice(attempt: TrainingAttempt): boolean {
  const note = attempt.note?.trim();
  return attempt.activeSeconds > 0 || attempt.completed || (attempt.completedPasses ?? 0) > 0 ||
    !!attempt.scratchpad?.trim() || !!attempt.difficulty ||
    !!(note && note !== "[Left missed]" && note !== "[Practiced elsewhere]");
}

/** Match the planner's last-record-per-ID accounting before filtering or sorting. */
export function practiceHistoryForDate(
  attempts: readonly TrainingAttempt[], date: string, timezone: string,
): TrainingAttempt[] {
  return [...new Map(attempts.map((attempt) => [attempt.id, attempt])).values()]
    .filter((attempt) => {
      if (attempt.context !== "practice" || !hasPractice(attempt)) return false;
      try { return dateInTimezone(attempt.startedAt, timezone) === date; }
      catch { return false; }
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.endedAt.localeCompare(a.endedAt) || a.id.localeCompare(b.id));
}

export interface PracticeHistoryOptions {
  course: Pick<TrainingCourse, "assignments" | "timezone">;
  materials: readonly TrainingMaterial[];
  pendingIds: ReadonlySet<string>;
  /** Preserve expanded results when the surrounding tracker rerenders. */
  expandedIds?: ReadonlySet<string>;
  /** Local replay needs an insertion point even when the user omitted a synced summary. */
  sendingRecordingAttemptIds?: ReadonlySet<string>;
  includeDate?: boolean;
}

/** Notes contain the original per-run result summary; never infer or sum scores. */
export function renderPracticeHistory(attempts: readonly TrainingAttempt[], options: PracticeHistoryOptions): string {
  if (!attempts.length) return `<p class="training-small">No saved practice yet${options.includeDate ? "" : " today"}. Finish and save a block to add it here.</p>`;
  const tasks = new Map(options.course.assignments.flatMap((assignment) => assignment.tasks.map((task) => [task.id, task] as const)));
  const titles = new Map([...tasks].map(([id, task]) => [id, task.title]));
  for (const material of options.materials) titles.set(material.id, material.title);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: options.course.timezone,
    ...(options.includeDate ? { weekday: "short", month: "short", day: "numeric" } as const : {}),
    hour: "numeric", minute: "2-digit",
  });
  return `<ul class="training-history-list" role="list">${attempts.map((attempt) => {
    const title = otherPracticeActivity(attempt.taskId)?.title ?? titles.get(attempt.taskId) ?? "Practice";
    const started = new Date(attempt.startedAt);
    const stamp = Number.isFinite(started.getTime()) ? formatter.format(started) : "Time unavailable";
    const duration = attempt.activeSeconds < 60 ? `${Math.round(attempt.activeSeconds)} sec` : `${Math.round(attempt.activeSeconds / 6) / 10} min`;
    const task = tasks.get(attempt.taskId);
    const completion = task && isMorseRunner(task) ? "Assignment total reached" : "Requirements completed";
    const type = attempt.context === "class" ? "Class use" : otherPracticeActivity(attempt.taskId)
      ? "Other practice" : attempt.review ? "Extra review" : attempt.completed ? completion : "Practice logged";
    const rating = attempt.difficulty ? { hard: "Hard", right: "About right", easy: "Easy" }[attempt.difficulty] : undefined;
    const details = [
      attempt.note?.trim() ? `<div class="training-history-notes">${escapeHtml(attempt.note)}</div>` : "",
      attempt.scratchpad?.trim() ? `<p class="training-history-label">Recall &amp; scratchpad</p><div class="training-history-notes">${escapeHtml(attempt.scratchpad)}</div>` : "",
    ].join("");
    const metadata = [stamp, duration, type,
      ...(attempt.completedPasses ? [`${attempt.completedPasses} pass${attempt.completedPasses === 1 ? "" : "es"}`] : []),
      ...(attempt.recallSeconds ? [`includes ${Math.round(attempt.recallSeconds / 6) / 10} min recall`] : []),
      ...(rating ? [`Felt: ${rating}`] : []),
    ].join(" · ");
    const sync = options.pendingIds.has(attempt.id) ? "Saved on this device · waiting to sync" : "Saved in account";
    return `<li class="training-history-entry"><strong>${escapeHtml(title)}</strong><p class="training-history-meta">${escapeHtml(metadata)}</p><p class="training-history-sync">${sync}</p>${details || options.sendingRecordingAttemptIds?.has(attempt.id) ? `<details data-history-id="${escapeHtml(attempt.id)}"${options.expandedIds?.has(attempt.id) ? " open" : ""}><summary>Results &amp; notes</summary>${details}</details>` : ""}</li>`;
  }).join("")}</ul>`;
}
