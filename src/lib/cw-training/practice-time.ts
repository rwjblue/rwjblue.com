import { dateInTimezone } from "./plan.ts";
import type { ActiveBlock } from "./storage.ts";
import type { TrainingKind } from "./types.ts";

interface PracticeTimerState {
  running: boolean;
  visible: boolean;
  kind: TrainingKind;
  recalling: boolean;
  audioPlaying: boolean;
}

/** Audio playback is credited separately from media events, never by this timer. */
export function timedPracticeDelta(elapsedSeconds: number, state: PracticeTimerState): {
  activeSeconds: number;
  recallSeconds: number;
  interrupted: boolean;
} {
  if (!state.running) return { activeSeconds: 0, recallSeconds: 0, interrupted: false };
  if (!state.visible || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds >= 4) {
    return { activeSeconds: 0, recallSeconds: 0, interrupted: true };
  }
  const recalling = state.kind === "audio" && state.recalling && !state.audioPlaying;
  return {
    activeSeconds: state.kind !== "audio" || recalling ? elapsedSeconds : 0,
    recallSeconds: recalling ? elapsedSeconds : 0,
    interrupted: false,
  };
}

function nonnegativeSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

/** Saved practice and today's unfinished block are disjoint, including during sync. */
export function practiceTimeSummary(
  savedSeconds: number,
  active: Pick<ActiveBlock, "id" | "startedAt" | "activeSeconds" | "context"> | undefined,
  date: string,
  timeZone: string,
  savedAttemptIds: ReadonlySet<string>,
): { savedSeconds: number; currentSeconds: number; totalSeconds: number } {
  const saved = nonnegativeSeconds(savedSeconds);
  let current = 0;
  if (active?.context === "practice" && !savedAttemptIds.has(active.id)) {
    try {
      if (dateInTimezone(active.startedAt, timeZone) === date) current = nonnegativeSeconds(active.activeSeconds);
    } catch {
      // A malformed cached date or time zone must not inflate or break the summary.
    }
  }
  return { savedSeconds: saved, currentSeconds: current, totalSeconds: saved + current };
}
