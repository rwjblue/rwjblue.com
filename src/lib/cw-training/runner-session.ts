import { isMorseRunner } from "./morse-runner.ts";
import { taskProgress } from "./plan.ts";
import { createRunnerRun, isRunnerSettings, runnerResultNote, RUNNER_MAX_SECONDS } from "./runner-bridge.ts";
import type { ActiveBlock } from "./storage.ts";
import type { TrainingAttempt } from "./types.ts";
import type { TrainingRunnerResult } from "./report-types.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function runnerMetadata(active: ActiveBlock): string {
  if (!active.runner) return "";
  return `${runnerResultNote(active.runner) ?? "Web Morse Runner: not started; no practice credited."} Upstream ${active.runnerRevision ?? "revision not recorded"}. Synthetic practice calls (not on-air contacts).`;
}

/** Persist the actual individual run; assignment totals and later save times are not run evidence. */
export function runnerAttemptResult(active: ActiveBlock): TrainingRunnerResult | undefined {
  const run = active.runner;
  if (!run || !isMorseRunner(active.task)
    || (run.status !== "completed" && run.status !== "stopped" && run.status !== "error")) return undefined;
  return {
    version: 1,
    mode: run.settings.mode,
    wpm: run.settings.wpm,
    durationSeconds: run.settings.durationSeconds,
    elapsedSeconds: run.elapsedSeconds,
    status: run.status,
    ...(run.summary ? {
      verifiedPoints: run.summary.verifiedPoints,
      qsoCount: run.summary.qsoCount,
      score: run.summary.score,
    } : {}),
    speeds: [...new Set([run.settings.wpm, ...(run.speedHistory ?? []).map(change => change.wpm)])],
    conditions: Object.values(run.settings.conditions).some(Boolean),
    ...(run.runStartedAt ? { runStartedAt: run.runStartedAt } : {}),
    ...(run.runEndedAt ? { runEndedAt: run.runEndedAt } : {}),
    source: "embedded",
  };
}

/** Assignment time accumulates across runs; each run's timer and score stay separate. */
export function runnerAssignmentProgress(active: ActiveBlock, attempts: TrainingAttempt[] = []): {
  savedSeconds: number;
  currentSeconds: number;
  totalSeconds: number;
  requiredSeconds: number;
  complete: boolean;
} {
  const requiredSeconds = isMorseRunner(active.task) && Number.isFinite(active.task.minutes) && active.task.minutes! > 0
    ? active.task.minutes! * 60 : 0;
  const savedSeconds = requiredSeconds > 0
    ? taskProgress(active.task, attempts.filter(attempt => attempt.id !== active.id)).activeSeconds : 0;
  const eligible = requiredSeconds > 0 && active.context === "practice" && !active.review;
  const elapsed = active.runner?.elapsedSeconds;
  const currentSeconds = eligible && typeof elapsed === "number" && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= RUNNER_MAX_SECONDS
    ? Math.floor(elapsed) : 0;
  const totalSeconds = savedSeconds + currentSeconds;
  return { savedSeconds, currentSeconds, totalSeconds, requiredSeconds, complete: eligible && totalSeconds >= requiredSeconds };
}

/** Save one terminal run and prepare a separate, paused run with a fresh identity. */
export function restartRunnerBlock(
  active: ActiveBlock,
  newId: string,
  startedAt: string,
  revision: string,
  attempts: TrainingAttempt[] = [],
): { active: ActiveBlock; attempt?: TrainingAttempt } | undefined {
  const run = active.runner;
  if (!run || !isMorseRunner(active.task) || !["completed", "stopped", "error"].includes(run.status)) return undefined;
  if (!UUID.test(newId) || newId.toLowerCase() === active.id.toLowerCase() || newId.toLowerCase() === run.runId.toLowerCase()) {
    throw new Error("Start the new run with a fresh practice ID.");
  }
  const now = Date.parse(startedAt);
  const oldStart = Date.parse(active.startedAt);
  if (!Number.isFinite(now) || !Number.isFinite(oldStart) || new Date(now).toISOString() !== startedAt) {
    throw new Error("The saved run has an invalid practice date. Export it before starting over.");
  }
  if (!Number.isFinite(run.elapsedSeconds) || run.elapsedSeconds < 0 || run.elapsedSeconds > RUNNER_MAX_SECONDS ||
      !isRunnerSettings(run.settings)) {
    throw new Error("The saved run has invalid timing or settings. Export it before starting over.");
  }
  if (active.scratchpad !== undefined && (typeof active.scratchpad !== "string" || active.scratchpad.length > 10000 || active.scratchpad.includes("\0"))) {
    throw new Error("Keep the scratchpad under 10,000 characters and remove null characters before starting over.");
  }
  const note = runnerMetadata(active);
  if (note.length > 4000 || note.includes("\0")) {
    throw new Error("The saved run's automatic details exceed 4,000 characters or contain null characters. Export it before starting over.");
  }
  if (!revision.trim() || revision.includes("\0") || revision.length > 200) {
    throw new Error("The new runner version is invalid. Reload before starting over.");
  }
  const activeSeconds = Math.floor(run.elapsedSeconds);
  const progress = runnerAssignmentProgress(active, attempts);
  const completed = active.review ? run.status === "completed" : progress.complete;
  const shouldRecord = activeSeconds > 0 || (run.summary?.qsoCount ?? 0) > 0 || !!active.scratchpad?.trim();
  const attempt: TrainingAttempt | undefined = shouldRecord ? {
    id: active.id,
    assignmentId: active.assignmentId,
    taskId: active.task.id,
    startedAt: new Date(Math.min(oldStart, now - activeSeconds * 1000)).toISOString(),
    endedAt: startedAt,
    activeSeconds,
    completed,
    runnerResult: runnerAttemptResult(active),
    ...(active.scratchpad !== undefined ? { scratchpad: active.scratchpad } : {}),
    note,
    context: active.context,
    ...(active.review !== undefined ? { review: active.review } : {}),
  } : undefined;
  const remainingSeconds = Math.max(0, progress.requiredSeconds - progress.totalSeconds);
  const settings = {
    ...run.settings,
    wpm: run.speedHistory?.at(-1)?.wpm ?? run.settings.wpm,
    durationSeconds: active.context === "practice" && !active.review && !progress.complete && remainingSeconds > 0
      ? Math.min(run.settings.durationSeconds, Math.max(60, Math.ceil(remainingSeconds / 60) * 60))
      : run.settings.durationSeconds,
  };
  const next: ActiveBlock = {
    id: newId,
    assignmentId: active.assignmentId,
    task: active.task,
    ...(active.resource ? { resource: active.resource } : {}),
    startedAt,
    targetMinutes: settings.durationSeconds / 60,
    activeSeconds: 0,
    completedPasses: 0,
    previousPasses: 0,
    targetPasses: 0,
    position: 0,
    coverage: [],
    bookmarks: [],
    context: active.context,
    ...(progress.complete ? { review: true } : active.review !== undefined ? { review: active.review } : {}),
    runner: createRunnerRun(newId, settings),
    runnerRevision: revision,
  };
  return { active: next, ...(attempt ? { attempt } : {}) };
}
