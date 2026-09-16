/** POTA and general on-air practice use a count; CWT keeps its detailed result. */
export function usesQsoCount(taskId: string): boolean {
  return taskId === "other:pota" || taskId === "other:on-air";
}

export function parseQsoCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error("Enter a whole number of QSOs from 0 to 1,000,000.");
  }
  return value;
}

/** Blank means unrecorded; zero is a recorded result. */
export function readQsoCount(data: FormData): number | undefined {
  const raw = String(data.get("qsoCount") ?? "").trim();
  return raw ? parseQsoCount(Number(raw)) : undefined;
}
