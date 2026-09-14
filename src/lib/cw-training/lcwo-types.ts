/** Measurements retained by LCWO's authenticated result exports. */
export type LcwoSourceType = "callsigns" | "words" | "groups" | "koch";

export interface LcwoRun {
  id: string;
  kind: "callsign" | "words" | "letters" | "figures" | "custom" | "koch";
  sourceType: LcwoSourceType;
  sourceUserId: string;
  sourceResultId: string;
  /** LCWO serves database timestamps in UTC; retain the original as well. */
  recordedAt: string;
  sourceTime: string;
  maximumWpm?: number;
  score?: number;
  characterWpm?: number;
  effectiveWpm?: number;
  /** LCWO's stored accuracy is not necessarily the displayed Errors percentage. */
  accuracyPercent?: number;
  lesson?: number;
  competitive?: boolean;
}

export interface LcwoImportState {
  configured: boolean;
  runs: LcwoRun[];
  syncedAt?: string;
}
