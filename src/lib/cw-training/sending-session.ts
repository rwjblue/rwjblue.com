/** Optional input capture. Nothing in this module credits practice or completes a task. */
export const SENDING_MAX_TAKE_MS = 10 * 60 * 1000;
export const SENDING_MAX_TIMINGS = 12_000;
export const SENDING_MAX_TAKES = 10;
export const SENDING_MAX_TARGET_LENGTH = 2_000;
export const SENDING_MAX_DECODED_LENGTH = 4_000;
export const SENDING_MAX_SUMMARY_LENGTH = 2_000;

export type SendingInput = "midi" | "keyboard";
export type SendingMode = "free" | "target";
export type SendingStatus = "ready" | "capturing" | "stopped" | "interrupted";
export type SendingStopReason = "stopped" | "paused" | "disconnected" | "hidden" | "navigation" | "reload" | "duration-limit" | "event-limit" | "input-error";
export type SendingComparison = "matches" | "possible-mismatch" | "not-compared";

export interface SendingSettings {
  input: SendingInput;
  wpm: number;
  mode: SendingMode;
  targetText?: string;
}

export interface SendingDecoder {
  name: string;
  version: string;
}

export interface SendingTake extends SendingSettings {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: Exclude<SendingStatus, "ready">;
  /** Measured milliseconds: positive marks, negative gaps; never quantized to ideal Morse. */
  timings: number[];
  /** Capture duration, including thinking/idle time; never additional practice credit. */
  elapsedMs: number;
  decodedText?: string;
  decoder?: SendingDecoder;
  comparison: SendingComparison;
  reason?: SendingStopReason;
}

export interface SendingDraft extends SendingSettings {
  status: SendingStatus;
  take?: SendingTake;
  /** Monotonic offsets within this take. Discarded on restore, never resumed automatically. */
  edgeState?: { down: boolean; lastEdgeMs: number };
}

const reasons = new Set<SendingStopReason>(["stopped", "paused", "disconnected", "hidden", "navigation", "reload", "duration-limit", "event-limit", "input-error"]);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const validText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max && !value.includes("\0");
const validDate = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);

function settings(value: unknown): SendingSettings | undefined {
  if (!isRecord(value) || !["midi", "keyboard"].includes(String(value.input)) || !["free", "target"].includes(String(value.mode)) || !finite(value.wpm, 5, 60)) return;
  if (value.targetText !== undefined && !validText(value.targetText, SENDING_MAX_TARGET_LENGTH)) return;
  if (value.mode === "target" && (typeof value.targetText !== "string" || !value.targetText.trim())) return;
  return { input: value.input as SendingInput, wpm: value.wpm, mode: value.mode as SendingMode,
    ...(value.mode === "target" ? { targetText: value.targetText as string } : {}) };
}

/** Settings may be prepared without connecting hardware or beginning a take. */
export function createSendingDraft(options: Partial<SendingSettings> = {}): SendingDraft {
  const targetText = typeof options.targetText === "string" ? options.targetText.replaceAll("\0", "").slice(0, SENDING_MAX_TARGET_LENGTH) : "";
  const mode = options.mode === "target" && targetText.trim() ? "target" : "free";
  return {
    input: options.input === "keyboard" ? "keyboard" : "midi",
    wpm: finite(options.wpm, 5, 60) ? options.wpm : 20,
    mode,
    ...(mode === "target" ? { targetText } : {}),
    status: "ready",
  };
}

/** Only this explicit action starts input capture. atMs in later calls is elapsed since here. */
export function beginSendingTake(draft: SendingDraft, options: { id: string; startedAt: string }): SendingDraft {
  const selected = settings(draft);
  if (!selected || draft.status === "capturing" || !validId(options.id) || !validDate(options.startedAt)) return draft;
  return { ...selected, status: "capturing", edgeState: { down: false, lastEdgeMs: 0 }, take: {
    ...selected, id: options.id, startedAt: options.startedAt, status: "capturing", timings: [], elapsedMs: 0, comparison: "not-compared",
  } };
}

/** Pure text comparison, not a decoder or accuracy score. Decoder uncertainty remains possible. */
export function compareSendingText(targetText: string | undefined, decodedText: string | undefined): SendingComparison {
  const normalize = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  const expected = normalize(targetText);
  const decoded = normalize(decodedText);
  return expected && decoded ? expected === decoded ? "matches" : "possible-mismatch" : "not-compared";
}

export function setSendingTranscript(draft: SendingDraft, result: { decodedText: string; decoder?: SendingDecoder }): SendingDraft {
  if (!draft.take || !validText(result.decodedText, SENDING_MAX_DECODED_LENGTH)) return draft;
  if (result.decoder && (!validText(result.decoder.name, 80) || !validText(result.decoder.version, 80))) return draft;
  const take = { ...draft.take, decodedText: result.decodedText,
    ...(result.decoder ? { decoder: { ...result.decoder } } : {}),
    comparison: compareSendingText(draft.take.targetText, result.decodedText) };
  return { ...draft, take };
}

/** Stop never manufactures a key-up. An open held mark cannot be measured reliably. */
export function stopSendingTake(draft: SendingDraft, options: { atMs: number; endedAt?: string; reason?: SendingStopReason; decodedText?: string; decoder?: SendingDecoder }): SendingDraft {
  if (draft.status !== "capturing" || !draft.take) return draft;
  const elapsedMs = finite(options.atMs, 0, Number.MAX_SAFE_INTEGER) ? Math.min(SENDING_MAX_TAKE_MS, Math.max(draft.take.elapsedMs, options.atMs)) : draft.take.elapsedMs;
  const reason = options.reason && reasons.has(options.reason) ? options.reason : "stopped";
  const status = reason === "stopped" ? "stopped" : "interrupted";
  const endedAt = validDate(options.endedAt) && Date.parse(options.endedAt) >= Date.parse(draft.take.startedAt)
    ? options.endedAt : new Date(Date.parse(draft.take.startedAt) + elapsedMs).toISOString();
  const { edgeState: _edgeState, ...paused } = draft;
  let result: SendingDraft = { ...paused, status, take: { ...draft.take, timings: [...draft.take.timings], elapsedMs, endedAt, reason, status } };
  if (options.decodedText !== undefined) result = setSendingTranscript(result, { decodedText: options.decodedText, decoder: options.decoder });
  return result;
}

/** Repeat/missing/out-of-order edges cannot invent marks. Initial waiting silence is omitted. */
export function recordSendingEdge(draft: SendingDraft, edge: { atMs: number; down: boolean }): SendingDraft {
  if (draft.status !== "capturing" || !draft.take || !draft.edgeState || typeof edge.down !== "boolean" || !finite(edge.atMs, 0, Number.MAX_SAFE_INTEGER) || edge.atMs < draft.take.elapsedMs) return draft;
  if (edge.atMs > SENDING_MAX_TAKE_MS) return stopSendingTake(draft, { atMs: SENDING_MAX_TAKE_MS, reason: "duration-limit" });
  const previous = draft.edgeState;
  if (previous.down === edge.down) {
    return edge.atMs >= SENDING_MAX_TAKE_MS ? stopSendingTake(draft, { atMs: edge.atMs, reason: "duration-limit" }) : draft;
  }
  const duration = edge.atMs - previous.lastEdgeMs;
  if (duration === 0 && draft.take.timings.length) return draft;
  const timings = [...draft.take.timings];
  if (duration > 0 && (!edge.down || timings.length)) timings.push(edge.down ? -duration : duration);
  const next: SendingDraft = { ...draft, edgeState: { down: edge.down, lastEdgeMs: edge.atMs }, take: { ...draft.take, elapsedMs: edge.atMs, timings } };
  if (timings.length >= SENDING_MAX_TIMINGS) return stopSendingTake(next, { atMs: edge.atMs, reason: "event-limit" });
  if (edge.atMs >= SENDING_MAX_TAKE_MS) return stopSendingTake(next, { atMs: edge.atMs, reason: "duration-limit" });
  return next;
}

/** Removes this take only. Caller owns practice timing and previously kept takes. */
export function discardSendingTake(draft: SendingDraft): SendingDraft {
  return createSendingDraft(draft);
}

function readTake(value: unknown): SendingTake | undefined {
  const selected = settings(value);
  if (!selected || !isRecord(value) || !validId(value.id) || !validDate(value.startedAt)
    || !["capturing", "stopped", "interrupted"].includes(String(value.status))
    || !finite(value.elapsedMs, 0, SENDING_MAX_TAKE_MS) || !Array.isArray(value.timings) || value.timings.length > SENDING_MAX_TIMINGS) return;
  let measured = 0;
  for (let index = 0; index < value.timings.length; index++) {
    const timing = value.timings[index];
    if (!finite(timing, -SENDING_MAX_TAKE_MS, SENDING_MAX_TAKE_MS) || (index % 2 === 0 ? timing <= 0 : timing >= 0)) return;
    measured += Math.abs(timing);
  }
  if (measured > value.elapsedMs + 0.001) return;
  if (value.status !== "capturing" && (!validDate(value.endedAt) || Date.parse(value.endedAt) < Date.parse(value.startedAt)
    || !reasons.has(value.reason as SendingStopReason) || (value.status === "stopped") !== (value.reason === "stopped"))) return;
  if (value.decodedText !== undefined && !validText(value.decodedText, SENDING_MAX_DECODED_LENGTH)) return;
  if (value.decoder !== undefined && (!isRecord(value.decoder) || !validText(value.decoder.name, 80) || !validText(value.decoder.version, 80))) return;
  return { ...selected, id: value.id, startedAt: value.startedAt, status: value.status as SendingTake["status"], timings: [...value.timings] as number[], elapsedMs: value.elapsedMs,
    ...(value.status !== "capturing" ? { endedAt: value.endedAt as string, reason: value.reason as SendingStopReason } : {}),
    ...(value.decodedText !== undefined ? { decodedText: value.decodedText as string } : {}),
    ...(value.decoder !== undefined ? { decoder: { name: value.decoder.name as string, version: value.decoder.version as string } } : {}),
    comparison: compareSendingText(selected.targetText, value.decodedText as string | undefined),
  };
}

/** Restoring a take pauses it at its last confirmed input offset, without adding offline time. */
export function restoreSendingTake(value: unknown): SendingTake | undefined {
  const take = readTake(value);
  if (!take || take.status !== "capturing") return take;
  return stopSendingTake({ ...take, status: "capturing", take }, { atMs: take.elapsedMs, reason: "reload" }).take;
}

/** Strictly bounded persisted data; unknown fields and old clock edges are never restored. */
export function restoreSendingDraft(value: unknown): SendingDraft | undefined {
  const selected = settings(value);
  if (!selected || !isRecord(value)) return;
  if (value.status === "ready") return value.take === undefined ? { ...selected, status: "ready" } : undefined;
  const take = readTake(value.take);
  if (!take || value.status !== take.status) return;
  const draft: SendingDraft = { ...selected, status: take.status, take };
  return take.status === "capturing" ? stopSendingTake(draft, { atMs: take.elapsedMs, reason: "reload" }) : draft;
}

/** Keep at most ten recent local traces per block. No raw timing arrays enter the summary. */
export function restoreSendingTakes(value: unknown): SendingTake[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SendingTake>();
  for (const item of value.slice(-SENDING_MAX_TAKES)) {
    const take = readTake(item);
    if (take && take.status !== "capturing") byId.set(take.id, take);
  }
  return [...byId.values()];
}

export function appendSendingTake(takes: readonly SendingTake[], take: SendingTake | undefined): SendingTake[] {
  const existing = restoreSendingTakes(takes);
  const selected = readTake(take);
  if (!selected || selected.status === "capturing" || !selected.timings.some(timing => timing > 0)) return existing;
  return [...existing.filter(item => item.id !== selected.id), selected].slice(-SENDING_MAX_TAKES);
}

export function sendingSummary(takes: readonly SendingTake[]): string {
  const selected = restoreSendingTakes(takes).filter(take => take.timings.some(timing => timing > 0));
  if (!selected.length) return "";
  const seconds = (ms: number) => Number((ms / 1000).toFixed(1));
  const compact = (text: string | undefined, limit = 100) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  let summary = `Sending capture: ${selected.length} take${selected.length === 1 ? "" : "s"}, ${seconds(selected.reduce((sum, take) => sum + take.elapsedMs, 0))} seconds captured. Capture does not add practice minutes.`;
  for (const [index, take] of selected.entries()) {
    const outcome = take.comparison === "matches" ? "Text matches after normalizing spaces/case."
      : take.comparison === "possible-mismatch" ? "Possible text mismatch; review by ear." : "No text comparison.";
    const line = `\nTake ${index + 1}: ${take.input === "midi" ? "MIDI" : "keyboard"}, ${take.wpm} WPM, ${seconds(take.elapsedMs)} seconds, ${take.mode === "free" ? "free sending" : "selected text"}; ${take.reason}. ${outcome}${take.targetText ? ` Expected: ${compact(take.targetText)}.` : ""}${take.decodedText ? ` Decoded: ${compact(take.decodedText)}.` : ""}${take.decoder ? ` Decoder: ${compact(take.decoder.name, 40)} ${compact(take.decoder.version, 30)}.` : ""}`;
    if (summary.length + line.length > SENDING_MAX_SUMMARY_LENGTH - 55) { summary += `\n${selected.length - index} more retained take(s) omitted from this summary.`; break; }
    summary += line;
  }
  return summary;
}
