import { dateInTimezone } from "./plan.ts";
import type { TrainingAttempt, TrainingResource, TrainingTask } from "./types.ts";

export const DAILY_LISTENING_ID = "bob-77-words";
export const DAILY_LISTENING_ASSIGNMENT = "daily-listening";
export { QSO_WORDS_TITLE as DAILY_LISTENING_TITLE } from "../../data/cw-listening/words.ts";
import { QSO_WORDS_TITLE as DAILY_LISTENING_TITLE } from "../../data/cw-listening/words.ts";
export const DAILY_LISTENING_INSTRUCTIONS = "Optional: listen for at least 10 minutes each day. Listen for the sound of whole words and abbreviations. The original recording uses approximately 40 WPM characters with extra word spacing. The supplied word list is available for reference.";
export const DAILY_LISTENING_PATH = `/api/cw-training/audio/${DAILY_LISTENING_ID}`;
export const DAILY_LISTENING_SECONDS = 600;

export function isDailyListening(task: { id: string }): boolean {
  return task.id === DAILY_LISTENING_ID;
}

/** Separate device preferences: normal recordings pause; daily words loop. */
export function audioAutoReplay(state: { audioAutoReplay?: boolean; dailyListeningAutoReplay?: boolean }, task: { id: string }): boolean {
  return isDailyListening(task) ? state.dailyListeningAutoReplay ?? true : state.audioAutoReplay ?? false;
}

export function createDailyListeningBlock(resource: TrainingResource, now: string, id: string) {
  const task: TrainingTask = {
    id: DAILY_LISTENING_ID, kind: "audio", title: DAILY_LISTENING_TITLE,
    instructions: DAILY_LISTENING_INSTRUCTIONS,
    sourceUrl: resource.url, resourceId: resource.id, optional: true, minutes: 10,
  };
  return {
    id, assignmentId: DAILY_LISTENING_ASSIGNMENT, task,
    resource: { ...resource, title: DAILY_LISTENING_TITLE }, startedAt: now, targetMinutes: 10,
    activeSeconds: 0, completedPasses: 0, previousPasses: 0, targetPasses: 0,
    position: 0, coverage: [] as [number, number][], bookmarks: [] as number[], context: "practice" as const, review: true,
  };
}

/** The suggestion measures listening alone, deduplicated like daily practice time. */
export function dailyListeningSeconds(attempts: readonly TrainingAttempt[], active: (Pick<TrainingAttempt, "id" | "assignmentId" | "startedAt" | "activeSeconds" | "recallSeconds" | "context"> & { task: { id: string } }) | undefined, date: string, timezone: string): number {
  const records = new Map(attempts.map(attempt => [attempt.id, attempt]));
  if (active && !records.has(active.id)) records.set(active.id, { ...active, taskId: active.task.id, endedAt: active.startedAt, completed: false });
  let seconds = 0;
  for (const entry of records.values()) {
    const original = entry.assignmentId === DAILY_LISTENING_ASSIGNMENT && entry.taskId === DAILY_LISTENING_ID;
    const generated = entry.assignmentId === "other-practice" && entry.taskId === "other:word-recognition";
    if ((!original && !generated) || entry.context !== "practice") continue;
    if (dateInTimezone(entry.startedAt, timezone) !== date) continue;
    seconds += Math.max(0, entry.activeSeconds - (entry.recallSeconds ?? 0));
  }
  return seconds;
}

/** Daily loops continue beyond the suggestion; assignment recordings keep their pass target. */
export function shouldReplayAudio(active: { task: { id: string }; completedPasses: number; targetPasses: number }, wholePass: boolean, enabled: boolean): boolean {
  return enabled && (isDailyListening(active.task) || (wholePass && active.completedPasses < active.targetPasses));
}
