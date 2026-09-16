/** Report metrics preserve the source measurement and never replace practice credit. */
export type PerformanceRating = "very-good" | "good" | "fair" | "poor";

/** Optional observations from one CWT session, kept separate from private notes. */
export interface TrainingCwtResult {
  qsoCount?: number;
  heardCallsigns?: string;
  heardExchanges?: string;
  workedCallsigns?: string;
  workedNames?: string;
  comments?: string;
}

export interface TrainingRunnerResult {
  version: 1;
  mode: "SingleCall" | "WPX";
  wpm: number;
  durationSeconds: number;
  elapsedSeconds: number;
  status: "completed" | "stopped" | "error";
  verifiedPoints?: number;
  qsoCount?: number;
  score?: number;
  /** Distinct speeds actually used in this run. */
  speeds: number[];
  conditions: boolean;
  runStartedAt?: string;
  runEndedAt?: string;
  source: "embedded" | "manual" | "legacy";
}

export interface TrainingAudioResult {
  url: string;
  title: string;
  speedWpm?: number;
  activeSeconds: number;
  completedPasses: number;
}

export interface TrainingLcwoResult {
  kind: "callsign" | "letters" | "words" | "figures" | "custom";
  speedWpm?: number;
  groupLength?: number;
  maximumLength?: number;
  score?: number;
  errorCount?: number;
  errorPercent?: number;
}

/** Every saved draft or submitted snapshot gets a new ID; prior versions stay intact. */
export interface TrainingReport {
  id: string;
  session: number;
  fromDate: string;
  toDate: string;
  reportDate: string;
  createdAt: string;
  answers: Record<string, string>;
  /** Answers deliberately edited by the user; automatic suggestions may refresh. */
  editedAnswerKeys?: string[];
  sourceAttemptIds: string[];
  /** Imported LCWO measurements are sources, never timed practice attempts. */
  sourceLcwoIds?: string[];
  status: "draft" | "submitted";
  submittedAt?: string;
}
