import { restoreSendingTake, SENDING_MAX_TAKES } from "./sending-session.ts";
import type { SendingTake } from "./sending-session.ts";

export interface SavedSendingRecording {
  attemptId: string;
  take: SendingTake;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const validAttemptId = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Local replay is bounded across all saved attempts, not ten copies per attempt.
 * Last valid duplicate wins; returned records are oldest to newest by take start.
 */
export function restoreSavedSendingRecordings(value: unknown): SavedSendingRecording[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedSendingRecording>();
  for (const item of value) {
    if (!isRecord(item) || !validAttemptId(item.attemptId) || !isRecord(item.take)
      || item.take.status === "capturing") continue;
    // Exclude capturing before restoring: restoreSendingTake deliberately turns
    // an active draft into an interrupted draft, but that is not a kept recording.
    const take = restoreSendingTake(item.take);
    if (!take || !take.timings.some(timing => timing > 0)) continue;
    byId.set(`${item.attemptId}\0${take.id}`, { attemptId: item.attemptId, take });
  }
  return [...byId.values()]
    .sort((left, right) => Date.parse(left.take.startedAt) - Date.parse(right.take.startedAt))
    .slice(-SENDING_MAX_TAKES);
}

/** Merge explicitly kept takes into local replay; no task or account data changes. */
export function saveSendingRecordings(existing: unknown, attemptId: string, takes: readonly SendingTake[]): SavedSendingRecording[] {
  const retained = restoreSavedSendingRecordings(existing);
  if (!validAttemptId(attemptId) || !Array.isArray(takes)) return retained;
  return restoreSavedSendingRecordings([
    ...retained,
    ...takes.map(take => ({ attemptId, take })),
  ]);
}

/** Remove only this take's local replay, retaining its attempt and other takes. */
export function removeSavedSendingRecording(existing: unknown, attemptId: string, takeId: string): SavedSendingRecording[] {
  return restoreSavedSendingRecordings(existing).filter(recording => recording.attemptId !== attemptId || recording.take.id !== takeId);
}
