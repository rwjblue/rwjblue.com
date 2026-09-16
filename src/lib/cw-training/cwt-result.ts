import type { TrainingCwtResult } from "./report-types.ts";
import { parseQsoCount } from "./qso-count.ts";

export const CWT_TEXT_FIELDS = {
  heardCallsigns: "Callsigns heard",
  heardExchanges: "Names and exchanges heard",
  workedCallsigns: "Callsigns worked",
  workedNames: "First names of people worked",
  comments: "CWT comments for the report",
} as const;

/** Shared browser/API validation preserves zero and never guesses missing results. */
export function parseCwtResult(value: unknown): TrainingCwtResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid CWT result.");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => key !== "qsoCount" && !Object.hasOwn(CWT_TEXT_FIELDS, key))) throw new Error("Unknown CWT result field.");
  const result: TrainingCwtResult = {};
  if (row.qsoCount !== undefined) {
    result.qsoCount = parseQsoCount(row.qsoCount);
  }
  for (const key of Object.keys(CWT_TEXT_FIELDS) as (keyof typeof CWT_TEXT_FIELDS)[]) {
    const text = row[key];
    if (text === undefined) continue;
    if (typeof text !== "string" || text.length > 4000 || text.includes("\0")) throw new Error(`Keep ${CWT_TEXT_FIELDS[key].toLowerCase()} under 4,000 characters and remove null characters.`);
    result[key] = text;
  }
  return result;
}

export function readCwtResult(data: FormData): TrainingCwtResult | undefined {
  const row: Record<string, unknown> = {};
  const count = String(data.get("cwtQsoCount") ?? "").trim();
  if (count) row.qsoCount = Number(count);
  for (const key of Object.keys(CWT_TEXT_FIELDS)) {
    const text = String(data.get(`cwt${key}`) ?? "").trim();
    if (text) row[key] = text;
  }
  return Object.keys(row).length ? parseCwtResult(row) : undefined;
}

export function cwtResultSummary(result: TrainingCwtResult): string {
  return [
    ...(result.qsoCount !== undefined ? [`CWT: ${result.qsoCount} QSOs`] : []),
    ...Object.entries(CWT_TEXT_FIELDS).flatMap(([key, label]) => {
      const value = result[key as keyof typeof CWT_TEXT_FIELDS]?.trim();
      return value ? [`${label}: ${value}`] : [];
    }),
  ].join("\n");
}
