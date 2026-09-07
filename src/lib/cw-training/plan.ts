import { upcomingCwSessions, type CwSession } from "../cw-practice.ts";
import type { TrainingAssignment, TrainingAttempt, TrainingCourse, TrainingMeeting, TrainingResource, TrainingTask } from "./types.ts";

export type PracticeMode = "anything" | "listen" | "send" | "computer";
export type BlockMinutes = 3 | 5 | 10 | 15;

export function matchesPracticeMode(task: TrainingTask, mode: PracticeMode): boolean {
  switch (mode) {
    case "anything": return true;
    case "listen": return task.kind === "audio";
    case "send": return task.kind === "sending";
    case "computer": return task.kind === "icr" || task.kind === "simulator";
  }
}

export interface TaskProgress {
  complete: boolean;
  started: boolean;
  completedPasses: number;
  activeSeconds: number;
  interrupted: boolean;
}

export interface PlannedTask {
  assignment: TrainingAssignment;
  task: TrainingTask;
  resource?: TrainingResource;
  completedPasses: number;
  remainingPasses?: number;
  suggestedMinutes: number;
  passesThisBlock?: number;
  started?: boolean;
  activeSeconds?: number;
  interrupted: boolean;
  reason?: string;
  windows?: CwSession[];
  availableNow?: boolean;
  extra?: boolean;
}

export interface TrainingPlan {
  date: string;
  assignment?: TrainingAssignment;
  meeting?: TrainingMeeting;
  nextMeeting?: TrainingMeeting;
  phase: "practice" | "class" | "rest" | "complete" | "upcoming";
  practicedMinutes: number;
  dailyGoalMinutes: number;
  queue: PlannedTask[];
  blocked: PlannedTask[];
  missed: PlannedTask[];
  liveUpcoming: PlannedTask[];
  extras: PlannedTask[];
  next?: PlannedTask;
}

/** Local course dates are independent of the browser's current travel time zone. */
export function dateInTimezone(value: Date | string, timezone = "America/New_York"): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function uniqueAttempts(attempts: TrainingAttempt[]): TrainingAttempt[] {
  return [...new Map(attempts.map((attempt) => [attempt.id, attempt])).values()];
}

export function taskProgress(task: TrainingTask, attempts: TrainingAttempt[]): TaskProgress {
  const relevant = uniqueAttempts(attempts).filter((attempt) => attempt.taskId === task.id && attempt.context === "practice" && !attempt.review).sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  const completedPasses = relevant.reduce((sum, attempt) => sum + Math.max(0, Math.floor(attempt.completedPasses ?? 0)), 0);
  const activeSeconds = relevant.reduce((sum, attempt) => sum + Math.max(0, attempt.activeSeconds), 0);
  const started = activeSeconds > 0 || completedPasses > 0 || relevant.some((attempt) => attempt.completed);
  let complete: boolean;
  if (task.kind === "audio" && task.minimumPasses !== undefined) {
    complete = (completedPasses >= task.minimumPasses && relevant.some((attempt) => attempt.completed)) ||
      relevant.some((attempt) => attempt.completed && attempt.completedPasses === undefined);
  } else if (task.kind === "simulator" && task.minutes !== undefined) {
    // Two interrupted eight-minute runs do not satisfy an uninterrupted 15-minute run.
    complete = relevant.some((attempt) => attempt.completed && attempt.activeSeconds >= task.minutes! * 60);
  } else {
    complete = relevant.some((attempt) => attempt.completed);
  }
  const latest = relevant.at(-1);
  return { complete, started, completedPasses, activeSeconds, interrupted: !complete && started && !!latest && !latest.completed && latest.note !== "[Left missed]" };
}

function leftMissed(task: TrainingTask, attempts: TrainingAttempt[]): boolean {
  return attempts.some((attempt) => attempt.taskId === task.id && !attempt.review && attempt.note === "[Left missed]");
}

function plannedTask(course: TrainingCourse, assignment: TrainingAssignment, task: TrainingTask, attempts: TrainingAttempt[], blockMinutes: BlockMinutes, now: Date): PlannedTask {
  const progress = taskProgress(task, attempts);
  const resource = course.resources.find((resource) => resource.id === task.resourceId);
  const result: PlannedTask = { assignment, task, resource, completedPasses: progress.completedPasses, suggestedMinutes: blockMinutes, started: progress.started, activeSeconds: progress.activeSeconds, interrupted: progress.interrupted };
  if (task.kind === "simulator") result.suggestedMinutes = task.minutes ?? 15;
  if (task.kind === "audio") {
    result.remainingPasses = task.minimumPasses === undefined ? undefined : Math.max(0, task.minimumPasses - progress.completedPasses);
    if (resource?.unresolved) {
      result.reason = resource.unresolved;
    } else if (!resource || resource.format !== "audio") {
      result.reason = "The assigned recording needs a resource link before playback.";
    } else if (resource.durationSeconds && Number.isFinite(resource.durationSeconds) && resource.durationSeconds > 0) {
      const fittingPasses = Math.max(1, Math.floor((blockMinutes * 60) / resource.durationSeconds));
      result.passesThisBlock = Math.max(1, Math.min(fittingPasses, result.remainingPasses ?? fittingPasses));
      result.suggestedMinutes = Math.ceil(resource.durationSeconds * result.passesThisBlock / 60);
      if (result.remainingPasses === 0) result.reason = "Required passes are recorded. Confirm the listening objective, or play another pass for review.";
      if (resource.durationSeconds > blockMinutes * 60) result.reason = "One full pass needs a longer block; reserve enough time or resume the recording later.";
    } else {
      result.passesThisBlock = 1;
      result.reason = blockMinutes < 10
        ? "Recording length is not yet measured, so it cannot be recommended for this short block. Check its length in a longer practice window."
        : "Recording length is not yet measured. Load the player to check the time needed for a full pass.";
    }
  }
  if (task.kind === "live") {
    result.windows = upcomingCwSessions(now, 48).filter((session) => session.activity.id === "cwt" && session.start.getTime() < new Date(assignment.dueAt).getTime());
    result.availableNow = result.windows.some((session) => session.start.getTime() <= now.getTime() && now.getTime() < session.end.getTime());
    if (!result.windows.length) {
      result.reason = "No CWT window remains before class. Keep the objective open and ask the advisor how to proceed.";
    } else if (!result.availableNow) {
      const nextWindow = new Intl.DateTimeFormat("en-US", { timeZone: course.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(result.windows[0]!.start);
      result.reason = `The next CWT window starts ${nextWindow}. Plan this radio activity for that window.`;
    }
  }
  if (task.kind === "simulator" && result.suggestedMinutes > blockMinutes) result.reason = `This exercise needs ${result.suggestedMinutes} uninterrupted minutes.`;
  return result;
}

function fits(item: PlannedTask, blockMinutes: number): boolean {
  if (item.task.kind === "live" && !item.availableNow) return false;
  if (item.resource?.unresolved) return false;
  if (item.task.kind === "audio") {
    if (!item.resource || item.resource.format !== "audio") return false;
    const duration = item.resource.durationSeconds;
    if (duration && Number.isFinite(duration) && duration > 0) return duration <= blockMinutes * 60;
    if (blockMinutes < 10) return false;
  }
  return item.suggestedMinutes <= blockMinutes;
}

function practiceKey(task: TrainingTask, resource?: TrainingResource): string {
  // A recording can recur in several assignments. Replaying it should rotate
  // the material, not recommend the same audio under another assignment ID.
  if (task.kind === "audio") return `audio:${resource?.url ?? task.resourceId ?? task.id}`;
  return `${task.kind}:${task.resourceId ?? task.id}:${task.speedWpm ?? ""}:${task.settings ?? ""}`;
}

function extraPractice(
  course: TrainingCourse,
  assignments: TrainingAssignment[],
  attempts: TrainingAttempt[],
  date: string,
  blockMinutes: BlockMinutes,
  mode: PracticeMode,
  now: Date,
  requiredIds: Set<string>,
): PlannedTask[] {
  const resources = new Map(course.resources.map((resource) => [resource.id, resource]));
  const taskKeys = new Map(course.assignments.flatMap((assignment) => assignment.tasks.map((task) => [task.id, practiceKey(task, resources.get(task.resourceId ?? ""))] as const)));
  const lastPracticed = new Map<string, number>();
  const lastReviewedToday = new Map<string, number>();
  for (const attempt of uniqueAttempts(attempts)) {
    if (attempt.context !== "practice" || attempt.activeSeconds <= 0) continue;
    const key = taskKeys.get(attempt.taskId);
    const endedAt = Date.parse(attempt.endedAt);
    if (key && Number.isFinite(endedAt) && endedAt <= now.getTime()) {
      lastPracticed.set(key, Math.max(lastPracticed.get(key) ?? 0, endedAt));
      if (attempt.review && dateInTimezone(attempt.startedAt, course.timezone) === date) {
        lastReviewedToday.set(key, Math.max(lastReviewedToday.get(key) ?? 0, endedAt));
      }
    }
  }

  const candidates = assignments.filter((assignment) => assignment.date <= date)
    .flatMap((assignment) => assignment.tasks
      .filter((task) => task.kind !== "live" && matchesPracticeMode(task, mode) && !requiredIds.has(task.id))
      .map((task) => {
        // Reviews retain their original IDs and instructions, but their own
        // block starts with fresh passes. The saved attempt has review: true.
        const item = plannedTask(course, assignment, { ...task, optional: true }, [], blockMinutes, now);
        item.extra = true;
        if (!item.reason) item.reason = `Optional review from Session ${assignment.session}, Day ${assignment.day}.`;
        return item;
      }))
    .filter((item) => fits(item, blockMinutes) &&
      (item.task.kind !== "audio" || (item.resource?.durationSeconds ?? 0) > 0));

  candidates.sort((a, b) => b.assignment.date.localeCompare(a.assignment.date));
  // Keep a small current-level pool. A one-recording day must not trap the
  // learner on that recording forever, but reviews should not drift through
  // the whole course when several recent assignments have suitable material.
  const recentDates = new Set([...new Set(candidates.map((item) => item.assignment.date))].slice(0, 3));
  const seen = new Set<string>();
  const recent = candidates.filter((item) => {
    if (!recentDates.has(item.assignment.date)) return false;
    const key = practiceKey(item.task, item.resource);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return recent.sort((a, b) => {
    const aKey = practiceKey(a.task, a.resource);
    const bKey = practiceKey(b.task, b.resource);
    const aReview = lastReviewedToday.get(aKey);
    const bReview = lastReviewedToday.get(bKey);
    if (aReview !== undefined && bReview === undefined) return 1;
    if (aReview === undefined && bReview !== undefined) return -1;
    if (aReview !== undefined && bReview !== undefined && aReview !== bReview) return aReview - bReview;
    return b.assignment.date.localeCompare(a.assignment.date) ||
      (lastPracticed.get(aKey) ?? 0) - (lastPracticed.get(bKey) ?? 0);
  });
}

/**
 * Derive today's work without rolling old sessions into a permanent backlog.
 * Assignments retain their dates after a class begins, so Monday evening cannot
 * become Tuesday's required practice day or reset the same day's minute goal.
 */
export function getTrainingPlan(course: TrainingCourse, attempts: TrainingAttempt[], now = new Date(), blockMinutes: BlockMinutes = 15, mode: PracticeMode = "anything"): TrainingPlan {
  if (!Number.isFinite(now.getTime())) throw new Error("A valid planning date is required.");
  const date = dateInTimezone(now, course.timezone);
  const sortedAssignments = [...course.assignments].sort((a, b) => a.date.localeCompare(b.date));
  const meetings = [...course.meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const assignment = sortedAssignments.find((candidate) => candidate.date === date);
  const meeting = meetings.find((candidate) => dateInTimezone(candidate.startsAt, course.timezone) === date);
  const nextMeeting = meetings.find((candidate) => new Date(candidate.startsAt).getTime() > now.getTime());
  const activeClass = meeting && now.getTime() >= new Date(meeting.startsAt).getTime() && now.getTime() < new Date(meeting.endsAt).getTime();
  const firstDate = sortedAssignments[0]?.date;
  const lastDate = sortedAssignments.at(-1)?.date;
  const phase: TrainingPlan["phase"] = activeClass ? "class"
    : assignment && now.getTime() < new Date(assignment.dueAt).getTime() ? "practice"
    : lastDate && date > lastDate ? "complete"
    : firstDate && date < firstDate ? "upcoming" : "rest";
  const practicedSeconds = uniqueAttempts(attempts).filter((attempt) => attempt.context === "practice" && dateInTimezone(attempt.startedAt, course.timezone) === date)
    .reduce((sum, attempt) => sum + Math.max(0, attempt.activeSeconds), 0);
  const result: TrainingPlan = { date, assignment, meeting, nextMeeting, phase, practicedMinutes: practicedSeconds / 60, dailyGoalMinutes: assignment ? course.dailyGoalMinutes : 0, queue: [], blocked: [], missed: [], liveUpcoming: [], extras: [] };

  if (phase === "practice" && assignment) {
    const eligible = sortedAssignments.filter((candidate) => candidate.session === assignment.session && candidate.date <= date);
    const candidates = eligible.flatMap((candidate) => candidate.tasks.filter((task) => !task.optional && !taskProgress(task, attempts).complete && !leftMissed(task, attempts)).map((task) => plannedTask(course, candidate, task, attempts, blockMinutes, now)));
    candidates.sort((a, b) =>
      Number(b.assignment.date === date) - Number(a.assignment.date === date) ||
      a.assignment.date.localeCompare(b.assignment.date) ||
      Number(b.started) - Number(a.started));
    result.queue = candidates.filter((item) => fits(item, blockMinutes));
    result.blocked = candidates.filter((item) => !fits(item, blockMinutes));
  }

  const lastClass = [...meetings].reverse().find((candidate) => new Date(candidate.startsAt).getTime() <= now.getTime());
  if (lastClass) {
    result.missed = sortedAssignments.filter((candidate) => candidate.session === lastClass.session)
      .flatMap((candidate) => candidate.tasks.filter((task) => !task.optional && !taskProgress(task, attempts).complete && !leftMissed(task, attempts)).map((task) => plannedTask(course, candidate, task, attempts, blockMinutes, now)));
  }

  const upcomingLimit = now.getTime() + 7 * 86_400_000;
  result.liveUpcoming = sortedAssignments.filter((candidate) => new Date(candidate.dueAt).getTime() > now.getTime() && new Date(candidate.dueAt).getTime() <= upcomingLimit)
    .flatMap((candidate) => candidate.tasks.filter((task) => task.kind === "live" && !taskProgress(task, attempts).complete).map((task) => plannedTask(course, candidate, task, attempts, blockMinutes, now)));
  if (phase !== "class") {
    result.extras = extraPractice(course, sortedAssignments, attempts, date, blockMinutes, mode, now,
      new Set([...result.queue, ...result.blocked].map((item) => item.task.id)));
    result.next = result.queue.find((item) => matchesPracticeMode(item.task, mode)) ?? result.extras[0];
  }
  return result;
}

/** Short choices appear only when a matching whole exercise or review can fit. */
export function availableBlockMinutes(course: TrainingCourse, attempts: TrainingAttempt[], now = new Date(), mode: PracticeMode = "anything"): BlockMinutes[] {
  const shortChoices: BlockMinutes[] = [3, 5];
  return [
    ...shortChoices.filter((minutes) => {
      const plan = getTrainingPlan(course, attempts, now, minutes, mode);
      return plan.phase !== "class" && [...plan.queue, ...plan.extras].some((item) => matchesPracticeMode(item.task, mode));
    }),
    10,
    15,
  ];
}
