import { createRemoteJWKSet, jwtVerify } from "jose";
import type {
  TrainingAttempt,
  TrainingCourse,
  TrainingMaterial,
  TrainingPreferences,
  TrainingSnapshot,
  TrainingSync,
} from "../src/lib/cw-training/types.ts";

export const TRAINING_COURSE_ID = "cwa-intermediate-2026-09";
const MAX_BODY_BYTES = 1_048_576;
const MIN_DATE = Date.parse("2020-01-01T00:00:00Z");
const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,149}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

// Only public signing-key caches are shared between requests, never identities.
const signingKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

class TrainingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: PRIVATE_HEADERS });
}

function invalid(message: string): never {
  throw new TrainingError(400, message);
}

async function identity(request: Request, env: Env): Promise<string> {
  const host = new URL(request.url).hostname;
  const devUser = "TRAINING_DEV_USER" in env ? env.TRAINING_DEV_USER : undefined;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (local && typeof devUser === "string" && ID.test(devUser) &&
      !env.TRAINING_ACCESS_TEAM && !env.TRAINING_ACCESS_AUD) {
    return `local:${devUser}`;
  }
  const issuer = env.TRAINING_ACCESS_TEAM?.replace(/\/$/, "");
  const audience = env.TRAINING_ACCESS_AUD;
  const ownerEmail = env.TRAINING_OWNER_EMAIL?.trim().toLowerCase();
  if (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
      !audience || !ownerEmail) {
    throw new TrainingError(503, "Training sign-in is not configured.");
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16_384) {
    throw new TrainingError(401, "Sign in to sync your training.");
  }
  try {
    let keys = signingKeys.get(issuer);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5_000,
      });
      if (signingKeys.size >= 4) signingKeys.clear();
      signingKeys.set(issuer, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "email", "iat", "exp"],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || payload.sub.length > 255 || !payload.sub ||
        typeof payload.email !== "string" || payload.email.toLowerCase() !== ownerEmail ||
        typeof payload.iat !== "number" || payload.iat > Date.now() / 1000 + 5) {
      throw new Error("Invalid owner identity");
    }
    return payload.sub;
  } catch {
    throw new TrainingError(401, "Sign in to sync your training.");
  }
}

function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Expected an object.");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowed.includes(key))) invalid("Unknown field.");
  return object;
}

function string(value: unknown, name: string, maximum: number, empty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!empty && !value.trim()) || value.includes("\0")) {
    invalid(`Invalid ${name}.`);
  }
  return value;
}

function id(value: unknown, name: string, uuid = false): string {
  const result = string(value, name, 150);
  if (!(uuid ? UUID : ID).test(result)) invalid(`Invalid ${name}.`);
  return result;
}

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid(`Invalid ${name}.`);
  }
  return value;
}

function timestamp(value: unknown, name: string, now: number): string {
  const result = string(value, name, 24);
  const millis = Date.parse(result);
  if (!Number.isFinite(millis) || millis < MIN_DATE || millis > now + 86_400_000 ||
      new Date(millis).toISOString() !== result) invalid(`Invalid ${name}.`);
  return result;
}

function practiceDate(value: unknown): string {
  const result = string(value, "practice date", 10);
  const millis = Date.parse(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result < "2020-01-01" || result > "2100-12-31" ||
      !Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== result) {
    invalid("Invalid practice date.");
  }
  return result;
}

function httpUrl(value: unknown, name: string): string {
  const result = string(value, name, 2_000);
  try {
    const url = new URL(result);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid(`Invalid ${name}.`);
  } catch { invalid(`Invalid ${name}.`); }
  return result;
}

function attempt(value: unknown, now: number): TrainingAttempt {
  const row = record(value, ["id", "assignmentId", "taskId", "startedAt", "endedAt", "activeSeconds", "recallSeconds", "completed", "review", "completedPasses", "difficulty", "note", "scratchpad", "context"]);
  const result: TrainingAttempt = {
    id: id(row.id, "attempt ID", true),
    assignmentId: id(row.assignmentId, "assignment ID"),
    taskId: id(row.taskId, "task ID"),
    startedAt: timestamp(row.startedAt, "start time", now),
    endedAt: timestamp(row.endedAt, "end time", now),
    activeSeconds: integer(row.activeSeconds, "active seconds", 0, 86_400),
    completed: row.completed as boolean,
    context: row.context as TrainingAttempt["context"],
  };
  if (typeof row.completed !== "boolean" || !["practice", "class"].includes(String(row.context))) invalid("Invalid attempt outcome.");
  const wallSeconds = (Date.parse(result.endedAt) - Date.parse(result.startedAt)) / 1000;
  if (wallSeconds < 0 || result.activeSeconds > wallSeconds + 2) invalid("Practice time exceeds the elapsed time.");
  if (row.recallSeconds !== undefined) {
    result.recallSeconds = integer(row.recallSeconds, "recall seconds", 0, 86_400);
    if (result.recallSeconds > result.activeSeconds) invalid("Recall time exceeds total practice time.");
  }
  if (row.review !== undefined) {
    if (typeof row.review !== "boolean") invalid("Invalid review flag.");
    result.review = row.review;
  }
  if (row.completedPasses !== undefined) result.completedPasses = integer(row.completedPasses, "completed passes", 0, 100);
  if (row.difficulty !== undefined) {
    if (!["hard", "right", "easy"].includes(String(row.difficulty))) invalid("Invalid difficulty.");
    result.difficulty = row.difficulty as TrainingAttempt["difficulty"];
  }
  if (row.note !== undefined) result.note = string(row.note, "note", 4_000, true);
  if (row.scratchpad !== undefined) result.scratchpad = string(row.scratchpad, "scratchpad", 10_000, true);
  return result;
}

function material(value: unknown, now: number): TrainingMaterial {
  const row = record(value, ["id", "session", "title", "text", "url", "filename", "usage", "createdAt", "supersedesId"]);
  if (!["preparation", "class", "reference", "unknown"].includes(String(row.usage))) invalid("Invalid material usage.");
  const result: TrainingMaterial = {
    id: id(row.id, "material ID", true),
    session: integer(row.session, "session", 1, 16),
    title: string(row.title, "title", 200),
    text: string(row.text, "material text", 100_000, true),
    usage: row.usage as TrainingMaterial["usage"],
    createdAt: timestamp(row.createdAt, "material time", now),
  };
  if (row.url !== undefined) result.url = httpUrl(row.url, "material URL");
  if (!result.text.trim() && !result.url) invalid("A material needs text or a URL.");
  if (row.filename !== undefined) result.filename = string(row.filename, "filename", 255);
  if (row.supersedesId !== undefined) result.supersedesId = id(row.supersedesId, "original material ID", true);
  if (result.supersedesId === result.id) invalid("A revision needs a new ID.");
  return result;
}

function preferences(value: unknown, now: number): TrainingPreferences {
  const row = record(value, ["blockMinutes", "reminderTime", "joinUrl", "carriedTasks", "updatedAt"]);
  if (row.blockMinutes !== 10 && row.blockMinutes !== 15) invalid("Block length must be 10 or 15 minutes.");
  const reminderTime = string(row.reminderTime, "reminder time", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) invalid("Invalid reminder time.");
  const result: TrainingPreferences = {
    blockMinutes: row.blockMinutes,
    reminderTime,
    updatedAt: timestamp(row.updatedAt, "preferences time", now),
  };
  if (Date.parse(result.updatedAt) > now + 300_000) invalid("Preferences time is in the future.");
  if (row.joinUrl !== undefined && row.joinUrl !== "") result.joinUrl = httpUrl(row.joinUrl, "class URL");
  if (row.carriedTasks !== undefined) {
    if (!Array.isArray(row.carriedTasks) || row.carriedTasks.length > 100) invalid("Carry at most 100 tasks at once.");
    const seen = new Set<string>();
    result.carriedTasks = row.carriedTasks.map((value) => {
      const item = record(value, ["taskId", "date"]);
      const taskId = id(item.taskId, "carried task ID");
      if (seen.has(taskId)) invalid("Each carried task must appear only once.");
      seen.add(taskId);
      return { taskId, date: practiceDate(item.date) };
    });
  }
  return result;
}

function parseSync(value: unknown, now: number): TrainingSync {
  const row = record(value, ["attempts", "materials", "preferences"]);
  const result: TrainingSync = {};
  if (row.attempts !== undefined) {
    if (!Array.isArray(row.attempts) || row.attempts.length > 100) invalid("Sync at most 100 attempts at once.");
    result.attempts = row.attempts.map((item) => attempt(item, now));
  }
  if (row.materials !== undefined) {
    if (!Array.isArray(row.materials) || row.materials.length > 50) invalid("Sync at most 50 materials at once.");
    result.materials = row.materials.map((item) => material(item, now));
  }
  if (row.preferences !== undefined) result.preferences = preferences(row.preferences, now);
  return result;
}

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new TrainingError(415, "Use application/json.");
  }
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw new TrainingError(413, "Training update is too large.");
  }
  if (!request.body) invalid("An update body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new TrainingError(413, "Training update is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)); }
  catch { invalid("Invalid JSON."); }
}

function sameOrigin(request: Request): void {
  if (request.headers.get("Origin") !== new URL(request.url).origin ||
      request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new TrainingError(403, "Use this site's training page to save changes.");
  }
}

function defaultPreferences(): TrainingPreferences {
  return { blockMinutes: 15, reminderTime: "09:00", updatedAt: "2020-01-01T00:00:00.000Z" };
}

async function snapshot(db: D1Database, owner: string): Promise<TrainingSnapshot> {
  const results = await db.batch<{ payload: string }>([
    db.prepare("SELECT payload FROM training_courses WHERE id = ?").bind(TRAINING_COURSE_ID),
    db.prepare("SELECT payload FROM training_attempts WHERE owner_id = ? AND course_id = ? ORDER BY recorded_at, id").bind(owner, TRAINING_COURSE_ID),
    db.prepare("SELECT payload FROM training_materials WHERE owner_id = ? AND course_id = ? ORDER BY recorded_at, id").bind(owner, TRAINING_COURSE_ID),
    db.prepare("SELECT payload FROM training_preferences WHERE owner_id = ? AND course_id = ?").bind(owner, TRAINING_COURSE_ID),
  ]);
  const curriculum = results[0]?.results[0]?.payload;
  if (!curriculum) throw new TrainingError(503, "The training curriculum is not available yet.");
  return {
    userId: owner,
    course: JSON.parse(curriculum) as TrainingCourse,
    attempts: results[1]!.results.map((item) => JSON.parse(item.payload) as TrainingAttempt),
    materials: results[2]!.results.map((item) => JSON.parse(item.payload) as TrainingMaterial),
    preferences: results[3]?.results[0] ? JSON.parse(results[3].results[0].payload) as TrainingPreferences : defaultPreferences(),
    serverTime: new Date().toISOString(),
  };
}

async function sync(db: D1Database, owner: string, update: TrainingSync): Promise<TrainingSnapshot> {
  const current = await snapshot(db, owner);
  const knownMaterials = new Map(current.materials.map((item) => [item.id, item]));
  for (const item of update.materials ?? []) knownMaterials.set(item.id, item);
  for (const item of update.materials ?? []) {
    if (!current.course.meetings.some((meeting) => meeting.session === item.session)) invalid("Unknown class session.");
    if (item.supersedesId) {
      const original = knownMaterials.get(item.supersedesId);
      if (!original || original.session !== item.session || original.createdAt > item.createdAt) invalid("Unknown original material revision.");
      const visited = new Set([item.id]);
      let parent: TrainingMaterial | undefined = original;
      while (parent) {
        if (visited.has(parent.id)) invalid("Material revisions cannot form a cycle.");
        visited.add(parent.id);
        parent = parent.supersedesId ? knownMaterials.get(parent.supersedesId) : undefined;
      }
    }
  }
  for (const item of update.attempts ?? []) {
    const assignment = current.course.assignments.find((entry) => entry.id === item.assignmentId);
    const materialId = item.assignmentId.startsWith("material:") ? item.assignmentId.slice(9) : "";
    const reinforcement = assignment && item.taskId === `${assignment.id}-reinforcement`;
    if (!assignment?.tasks.some((task) => task.id === item.taskId) &&
        !reinforcement && !(knownMaterials.has(materialId) && item.taskId === materialId)) invalid("Unknown practice activity.");
  }
  for (const item of update.preferences?.carriedTasks ?? []) {
    const assignment = current.course.assignments.find((entry) => entry.tasks.some((task) => task.id === item.taskId));
    if (!assignment) invalid("Unknown carried task.");
    if (item.date < assignment.date) invalid("A task cannot be carried before its assignment date.");
  }
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  for (const [table, values] of [
    ["training_attempts", update.attempts ?? []],
    ["training_materials", update.materials ?? []],
  ] as const) {
    for (const item of values) statements.push(db.prepare(
      `INSERT INTO ${table} (owner_id, course_id, id, payload, recorded_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_id, course_id, id) DO UPDATE SET payload = excluded.payload`,
    ).bind(owner, TRAINING_COURSE_ID, item.id, JSON.stringify(item), now));
  }
  if (update.preferences) {
    // Preserve carry state from older clients atomically, including concurrent writes.
    // An explicit array (including []) still replaces it under the usual timestamp rule.
    statements.push(db.prepare(
      `INSERT INTO training_preferences (owner_id, course_id, payload, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_id, course_id) DO UPDATE SET
         payload = CASE
           WHEN json_type(excluded.payload, '$.carriedTasks') IS NULL
             AND json_type(training_preferences.payload, '$.carriedTasks') = 'array'
           THEN json_set(excluded.payload, '$.carriedTasks', json_extract(training_preferences.payload, '$.carriedTasks'))
           ELSE excluded.payload END,
         updated_at = excluded.updated_at
       WHERE excluded.updated_at > training_preferences.updated_at`,
    ).bind(owner, TRAINING_COURSE_ID, JSON.stringify(update.preferences), update.preferences.updatedAt));
  }
  if (statements.length) {
    try { await db.batch(statements); }
    catch (error) {
      if (error instanceof Error && error.message.includes("training_immutable_conflict")) {
        throw new TrainingError(409, "A saved record cannot be changed. Save a new revision instead.");
      }
      throw error;
    }
  }
  return snapshot(db, owner);
}

async function tokenHash(token: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function calendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Resolve a local reminder against the course zone, including offset changes. */
function localReminder(date: string, time: string, timezone: string): Date {
  const target = Date.parse(`${date}T${time}:00.000Z`);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let result = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(format.formatToParts(new Date(result)).map((part) => [part.type, part.value]));
    const viewed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`);
    result += target - viewed;
  }
  return new Date(result);
}

export function buildTrainingCalendar(course: TrainingCourse, settings: TrainingPreferences): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//N1RWJ//CW Training//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:CW practice",
  ];
  for (const date of new Set(course.assignments.map((assignment) => assignment.date))) {
    const start = localReminder(date, settings.reminderTime, course.timezone);
    lines.push(
      "BEGIN:VEVENT", `UID:cw-training-${date}@rwjblue.com`,
      `DTSTAMP:${calendarDate(new Date(course.verifiedAt))}`,
      `LAST-MODIFIED:${calendarDate(new Date(settings.updatedAt))}`,
      `DTSTART:${calendarDate(start)}`,
      `DTEND:${calendarDate(new Date(start.getTime() + settings.blockMinutes * 60_000))}`,
      "SUMMARY:CW practice", "DESCRIPTION:Open your next practice block.",
      "URL:https://rwjblue.com/radio/cw-training/?start=next", "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:CW practice", "TRIGGER:PT0M",
      "END:VALARM", "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR", "");
  return lines.join("\r\n");
}

async function calendar(request: Request, env: Env, token: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...PRIVATE_HEADERS, Allow: "GET, HEAD" } });
  }
  if (!/^[a-f0-9]{64}$/.test(token)) throw new TrainingError(404, "Calendar not found.");
  const row = await env.TRAINING_DB.prepare(
    "SELECT owner_id FROM training_calendar_tokens WHERE token_hash = ? AND course_id = ?",
  ).bind(await tokenHash(token), TRAINING_COURSE_ID).first<{ owner_id: string }>();
  if (!row) throw new TrainingError(404, "Calendar not found.");
  // This capability grants reminder dates only; do not read attempts or materials.
  const data = await env.TRAINING_DB.batch<{ payload: string }>([
    env.TRAINING_DB.prepare("SELECT payload FROM training_courses WHERE id = ?").bind(TRAINING_COURSE_ID),
    env.TRAINING_DB.prepare("SELECT payload FROM training_preferences WHERE owner_id = ? AND course_id = ?").bind(row.owner_id, TRAINING_COURSE_ID),
  ]);
  const curriculum = data[0]?.results[0]?.payload;
  if (!curriculum) throw new TrainingError(503, "The training curriculum is not available yet.");
  const course = JSON.parse(curriculum) as TrainingCourse;
  const settings = data[1]?.results[0] ? JSON.parse(data[1].results[0].payload) as TrainingPreferences : defaultPreferences();
  return new Response(request.method === "HEAD" ? null : buildTrainingCalendar(course, settings), {
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="cw-training.ics"' },
  });
}

export async function trainingResponse(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.TRAINING_DB) throw new TrainingError(503, "Training storage is not configured.");
    const path = new URL(request.url).pathname;
    const feed = /^\/api\/cw-training-calendar\/([^/]+)\.ics$/.exec(path);
    if (feed) return await calendar(request, env, feed[1]!);
    const routes = new Map([
      ["/api/cw-training/login", ["GET"]],
      ["/api/cw-training/bootstrap", ["GET"]],
      ["/api/cw-training/sync", ["POST"]],
      ["/api/cw-training/calendar-token", ["POST", "DELETE"]],
    ]);
    const allowed = routes.get(path);
    if (!allowed) throw new TrainingError(404, "Training route not found.");
    if (!allowed.includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...PRIVATE_HEADERS, Allow: allowed.join(", ") } });
    }
    const owner = await identity(request, env);
    if (request.method !== "GET") sameOrigin(request);
    if (path.endsWith("/login")) {
      return new Response(null, { status: 302, headers: { ...PRIVATE_HEADERS, Location: "/radio/cw-training/" } });
    }
    if (path.endsWith("/bootstrap")) return json(await snapshot(env.TRAINING_DB, owner));
    if (path.endsWith("/sync")) {
      const update = parseSync(await readJson(request), Date.now());
      return json(await sync(env.TRAINING_DB, owner, update));
    }
    if (request.method === "DELETE") {
      await env.TRAINING_DB.prepare("DELETE FROM training_calendar_tokens WHERE owner_id = ? AND course_id = ?")
        .bind(owner, TRAINING_COURSE_ID).run();
      return json({ revoked: true });
    }
    await snapshot(env.TRAINING_DB, owner);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    await env.TRAINING_DB.prepare(
      `INSERT INTO training_calendar_tokens (owner_id, course_id, token_hash, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_id, course_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`,
    ).bind(owner, TRAINING_COURSE_ID, await tokenHash(token), new Date().toISOString()).run();
    return json({ url: `${new URL(request.url).origin}/api/cw-training-calendar/${token}.ics` });
  } catch (error) {
    if (error instanceof TrainingError) return json({ error: error.message }, error.status);
    // No exception serialization: D1 errors can contain private SQL values.
    return json({ error: "Training sync is unavailable. Your local work is safe; try again." }, 503);
  }
}
