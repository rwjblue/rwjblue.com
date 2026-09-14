import type { LcwoRun, LcwoSourceType } from "../src/lib/cw-training/lcwo-types.ts";

export type { LcwoRun, LcwoSourceType } from "../src/lib/cw-training/lcwo-types.ts";

const LCWO_ORIGIN = "https://lcwo.net";
const EXPORT_TYPES: readonly LcwoSourceType[] = ["words", "callsigns", "groups", "koch"];
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const MAX_LOGIN_BYTES = 512 * 1024;
const MAX_RECORDS = 50_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export type LCWOImportErrorCode = "authentication" | "credentials" | "upstream" | "timeout" | "invalid_export" | "limit";

const ERROR_MESSAGES: Record<LCWOImportErrorCode, string> = {
  authentication: "LCWO sign-in failed. Check your username and password.",
  credentials: "Enter a valid LCWO username and password.",
  upstream: "LCWO could not be reached. Try importing again later.",
  timeout: "LCWO took too long to respond. Try importing again later.",
  invalid_export: "LCWO returned an unsupported result export. No results were imported.",
  limit: "The LCWO export exceeds the import limit. No results were imported.",
};

/** Safe to display; never includes credentials, cookies, or upstream response text. */
export class LCWOImportError extends Error {
  readonly code: LCWOImportErrorCode;

  constructor(code: LCWOImportErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "LCWOImportError";
    this.code = code;
  }
}

function invalidExport(): never {
  throw new LCWOImportError("invalid_export");
}

function sourceId(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 1)) invalidExport();
  if (typeof value !== "string" && typeof value !== "number") invalidExport();
  const id = String(value);
  if (!/^[1-9][0-9]{0,19}$/.test(id)) invalidExport();
  return id;
}

function optionalNumber(value: unknown, maximum = Number.MAX_SAFE_INTEGER, integer = false): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))) invalidExport();
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum || (integer && !Number.isSafeInteger(number))) invalidExport();
  return number;
}

function sourceDate(value: unknown): { recordedAt: string; sourceTime: string } {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) invalidExport();
  // LCWO's database server uses UTC. Keep the exact export value for provenance.
  const iso = `${value.replace(" ", "T")}.000Z`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso) invalidExport();
  return { recordedAt: iso, sourceTime: value };
}

function exportRows(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) {
    if (input && typeof input === "object" && "msg" in input && input.msg === "you must log in to use this function") {
      throw new LCWOImportError("authentication");
    }
    invalidExport();
  }
  if (input.length > MAX_RECORDS) throw new LCWOImportError("limit");
  return input.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) invalidExport();
    return row as Record<string, unknown>;
  });
}

function uniqueRuns(runs: LcwoRun[]): LcwoRun[] {
  const unique = new Map<string, LcwoRun>();
  for (const run of runs) {
    const existing = unique.get(run.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(run)) invalidExport();
    unique.set(run.id, run);
  }
  return [...unique.values()].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
}

/** Parse an entire export atomically. Unsupported mixed groups are omitted. */
export function parseLCWOExport(sourceType: LcwoSourceType, input: unknown): LcwoRun[] {
  if (!EXPORT_TYPES.includes(sourceType)) invalidExport();
  let userId: string | undefined;
  const runs: LcwoRun[] = [];
  for (const row of exportRows(input)) {
    const sourceUserId = sourceId(row.uid);
    const sourceResultId = sourceId(row.NR);
    if (userId !== undefined && userId !== sourceUserId) invalidExport();
    userId = sourceUserId;
    const time = sourceDate(row.time);
    if (sourceType === "groups" && row.mode === "mixed") continue;
    let kind: LcwoRun["kind"];
    if (sourceType === "groups") {
      if (row.mode !== "letters" && row.mode !== "figures" && row.mode !== "custom") invalidExport();
      kind = row.mode;
    } else {
      kind = sourceType === "callsigns" ? "callsign" : sourceType;
    }
    const run: LcwoRun = {
      id: `${sourceType}:${sourceUserId}:${sourceResultId}`,
      kind, sourceType, sourceUserId, sourceResultId, ...time,
    };
    const competitive = optionalNumber(row.valid, 1, true);
    if (competitive !== undefined) run.competitive = competitive === 1;
    if (sourceType === "words" || sourceType === "callsigns") {
      const maximumWpm = optionalNumber(row.max, Number.MAX_SAFE_INTEGER, true);
      const score = optionalNumber(row.score, Number.MAX_SAFE_INTEGER, true);
      if (maximumWpm !== undefined) run.maximumWpm = maximumWpm;
      if (score !== undefined) run.score = score;
    } else {
      const characterWpm = optionalNumber(row.speed);
      const effectiveWpm = optionalNumber(row.eff);
      const accuracyPercent = optionalNumber(row.accuracy, 100);
      if (characterWpm !== undefined) run.characterWpm = characterWpm;
      if (effectiveWpm !== undefined) run.effectiveWpm = effectiveWpm;
      if (accuracyPercent !== undefined) run.accuracyPercent = accuracyPercent;
      if (sourceType === "koch") {
        const lesson = optionalNumber(row.lesson, Number.MAX_SAFE_INTEGER, true);
        if (lesson !== undefined) run.lesson = lesson;
      }
    }
    runs.push(run);
  }
  return uniqueRuns(runs);
}

async function readBoundedBody(response: Response, limit: number, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get("Content-Length")) > limit) {
    await response.body?.cancel();
    throw new LCWOImportError("limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new LCWOImportError("limit");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

async function requestLCWO(path: string, init: RequestInit, limit: number, fetchImpl: typeof fetch, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LCWOImportError("timeout"));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(`${LCWO_ORIGIN}${path}`, {
          ...init, redirect: "manual", signal: controller.signal,
        });
        // Never follow login redirects or forward a session cookie elsewhere.
        if (!response.ok || response.redirected) {
          await response.body?.cancel();
          throw new LCWOImportError(response.status === 401 || response.status === 403 ? "authentication" : "upstream");
        }
        return { headers: response.headers, body: await readBoundedBody(response, limit, controller.signal) };
      })(),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof LCWOImportError) throw error;
    throw new LCWOImportError("upstream");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Sign in for this request only, then read authenticated exports sequentially.
 * Credentials and the PHP session cookie are neither returned nor persisted.
 */
export async function fetchLCWOExports(
  credentials: { username: string; password: string },
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number } = {},
): Promise<LcwoRun[]> {
  if (!credentials || typeof credentials.username !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(credentials.username)
    || typeof credentials.password !== "string" || credentials.password.length < 1 || credentials.password.length > 1024) {
    throw new LCWOImportError("credentials");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) throw new LCWOImportError("credentials");
  const login = await requestLCWO("/dologin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body: new URLSearchParams({ username: credentials.username, password: credentials.password }).toString(),
  }, MAX_LOGIN_BYTES, fetchImpl, timeoutMs);
  const session = login.headers.getSetCookie().map((cookie) => cookie.match(/^PHPSESSID=([A-Za-z0-9,-]{1,128})(?:;|$)/)?.[1]).filter(Boolean);
  if (!login.body.includes("<!-- LOGIN_SUCCESS -->") || session.length !== 1) throw new LCWOImportError("authentication");
  const runs: LcwoRun[] = [];
  let userId: string | undefined;
  let rowCount = 0;
  for (const type of EXPORT_TYPES) {
    const response = await requestLCWO(`/api/index.php?action=export_results&type=${type}&fmt=json`, {
      method: "GET", headers: { Accept: "application/json", Cookie: `PHPSESSID=${session[0]}` },
    }, MAX_EXPORT_BYTES, fetchImpl, timeoutMs);
    let input: unknown;
    try { input = JSON.parse(response.body); } catch { invalidExport(); }
    const rows = exportRows(input);
    rowCount += rows.length;
    if (rowCount > MAX_RECORDS) throw new LCWOImportError("limit");
    // Check even skipped mixed groups so every export belongs to the same user.
    for (const row of rows) {
      const id = sourceId(row.uid);
      if (userId !== undefined && id !== userId) invalidExport();
      userId = id;
    }
    runs.push(...parseLCWOExport(type, rows));
  }
  return uniqueRuns(runs);
}
