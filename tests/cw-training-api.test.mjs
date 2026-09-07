import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { buildTrainingCalendar, trainingResponse, TRAINING_COURSE_ID } from "../worker/cw-training.ts";

const origin = "http://localhost:8787";
const now = () => new Date().toISOString();
const course = {
  id: TRAINING_COURSE_ID, title: "Synthetic test course", version: "test",
  sourceUrl: "https://example.org/course", verifiedAt: "2026-09-01T00:00:00.000Z",
  timezone: "America/New_York", dailyGoalMinutes: 60, instructions: "Synthetic private instructions.",
  meetings: [{ session: 1, startsAt: "2026-09-07T19:30:00.000Z", endsAt: "2026-09-07T20:30:00.000Z" }],
  resources: [],
  assignments: [{ id: "s1d1", session: 1, day: 1, date: "2026-09-05", dueAt: "2026-09-07T19:30:00.000Z", instructions: "Synthetic instructions.", sourceUrl: "https://example.org/course", tasks: [{ id: "warmup", title: "Warmup", kind: "sending", instructions: "Synthetic prompt.", sourceUrl: "https://example.org/course" }] }],
};
let miniflare;
let db;
let env;

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('test'); } }", d1Databases: { TRAINING_DB: "cw-training-tests" } });
  db = await miniflare.getD1Database("TRAINING_DB");
  const schema = await readFile(new URL("../migrations/cw-training/0001_training.sql", import.meta.url), "utf8");
  const statements = schema.replace(/^--.*$/gm, "").trim().split(/;\n(?=\n|$)/).filter((sql) => sql.trim());
  await db.batch(statements.map((sql) => db.prepare(sql)));
  await db.prepare("INSERT INTO training_courses(id, payload) VALUES (?, ?)").bind(course.id, JSON.stringify(course)).run();
  env = { TRAINING_DB: db, TRAINING_DEV_USER: "test-owner", TRAINING_ACCESS_TEAM: "", TRAINING_ACCESS_AUD: "", TRAINING_OWNER_EMAIL: "" };
});
after(async () => { await miniflare?.dispose(); });

function request(path, method = "GET", body, headers = {}) {
  return new Request(`${origin}/api/cw-training/${path}`, {
    method,
    headers: { ...(method !== "GET" ? { Origin: origin, "Content-Type": "application/json" } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

function attempt(overrides = {}) {
  const end = Date.now();
  return {
    id: crypto.randomUUID(), assignmentId: "s1d1", taskId: "warmup",
    startedAt: new Date(end - 600_000).toISOString(), endedAt: new Date(end).toISOString(),
    activeSeconds: 600, completed: true, context: "practice", ...overrides,
  };
}

test("bootstrap is private and never enrolls from a client identity header", async () => {
  const response = await trainingResponse(request("bootstrap"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const data = await response.json();
  assert.equal(data.userId, "local:test-owner");
  assert.equal(data.course.instructions, course.instructions);
  assert.equal(data.preferences.blockMinutes, 15);
  assert.equal(data.preferences.reminderTime, "09:00");

  const forged = await trainingResponse(new Request("https://rwjblue.com/api/cw-training/bootstrap", { headers: { "Cf-Access-Authenticated-User-Email": "owner@example.org" } }), env);
  assert.equal(forged.status, 503, "a dev user must not bypass authentication on a real host");
});

test("Access cryptographically verifies issuer, audience, signature, expiry and owner", async () => {
  const issuer = "https://training-api-test.cloudflareaccess.com";
  const authenticatedEnv = { ...env, TRAINING_ACCESS_TEAM: issuer, TRAINING_ACCESS_AUD: "test-audience", TRAINING_OWNER_EMAIL: "owner@example.org" };
  const keys = await generateKeyPair("RS256");
  const wrongKeys = await generateKeyPair("RS256");
  const publicKey = { ...await exportJWK(keys.publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const originalFetch = globalThis.fetch;
  let keyRequests = 0;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
    keyRequests++;
    return Response.json({ keys: [publicKey] });
  };
  const token = async (overrides = {}, key = keys.privateKey) => new SignJWT({ email: "owner@example.org", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("verified-owner")
    .setIssuer(overrides.iss ?? issuer)
    .setAudience(overrides.aud ?? "test-audience")
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? "1h")
    .sign(key);
  const withToken = (jwt) => request("bootstrap", "GET", undefined, { "Cf-Access-Jwt-Assertion": jwt });
  try {
    assert.equal((await trainingResponse(request("bootstrap"), authenticatedEnv)).status, 401);
    assert.equal((await trainingResponse(withToken("not.a.jwt"), authenticatedEnv)).status, 401);
    const valid = await trainingResponse(withToken(await token()), authenticatedEnv);
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).userId, "verified-owner");
    for (const [claims, key] of [
      [{ iss: "https://another.cloudflareaccess.com" }],
      [{ aud: "another-audience" }],
      [{ email: "intruder@example.org" }],
      [{ exp: Math.floor(Date.now() / 1000) - 60 }],
      [{}, wrongKeys.privateKey],
    ]) assert.equal((await trainingResponse(withToken(await token(claims, key)), authenticatedEnv)).status, 401);
    assert.equal(keyRequests, 1, "cache public keys across requests");
    assert.equal((await trainingResponse(withToken(await token()), { ...authenticatedEnv, TRAINING_ACCESS_AUD: "" })).status, 503);
  } finally { globalThis.fetch = originalFetch; }
});

test("same-origin JSON writes reject malformed, oversized, and unknown input", async () => {
  for (const [req, status] of [
    [request("sync", "POST", {}, { Origin: "https://elsewhere.example" }), 403],
    [request("sync", "POST", {}, { Origin: "" }), 403],
    [request("sync", "POST", {}, { "Content-Type": "text/plain" }), 415],
    [request("sync", "POST", "{"), 400],
    [request("sync", "POST", { owner: "someone-else" }), 400],
    [request("sync", "POST", { attempts: Array.from({ length: 101 }, () => attempt()) }), 400],
    [request("sync", "POST", { attempts: [attempt({ activeSeconds: 1000 })] }), 400],
    [request("sync", "POST", { attempts: [attempt({ taskId: "unknown" })] }), 400],
    [request("sync", "POST", { attempts: [attempt({ completed: "yes" })] }), 400],
    [request("sync", "POST", " ".repeat(1_048_577)), 413],
    [request("sync", "POST", {}, { "Content-Length": "1048577" }), 413],
    [request("sync", "POST", { preferences: { blockMinutes: 15, reminderTime: "25:00", updatedAt: now() } }), 400],
  ]) assert.equal((await trainingResponse(req, env)).status, status);
});

test("D1 sync is idempotent, immutable, atomic, and scoped to the verified owner", async () => {
  const saved = attempt({ note: "Synthetic private note." });
  const first = await trainingResponse(request("sync", "POST", { attempts: [saved] }), env);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).attempts.filter((item) => item.id === saved.id).length, 1);
  const repeated = await trainingResponse(request("sync", "POST", { attempts: [saved] }), env);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).attempts.filter((item) => item.id === saved.id).length, 1);
  const newAttempt = attempt();
  const conflict = await trainingResponse(request("sync", "POST", { attempts: [newAttempt, { ...saved, note: "Changed" }] }), env);
  assert.equal(conflict.status, 409);
  const afterConflict = await (await trainingResponse(request("bootstrap"), env)).json();
  assert.equal(afterConflict.attempts.find((item) => item.id === saved.id).note, saved.note);
  assert.equal(afterConflict.attempts.some((item) => item.id === newAttempt.id), false, "batch rolls back on a conflict");
  const other = await trainingResponse(request("bootstrap"), { ...env, TRAINING_DEV_USER: "other-owner" });
  assert.equal((await other.json()).attempts.length, 0);
});

test("material revisions preserve originals and can be practiced in class separately", async () => {
  const original = { id: crypto.randomUUID(), session: 1, title: "Breakout prompt", text: "CQ\nDE TEST", usage: "unknown", createdAt: now() };
  const revised = { ...original, id: crypto.randomUUID(), text: "CQ\nDE TEST TEST", supersedesId: original.id, usage: "class" };
  const practice = attempt({ assignmentId: `material:${revised.id}`, taskId: revised.id, context: "class" });
  const response = await trainingResponse(request("sync", "POST", { materials: [original, revised], attempts: [practice] }), env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.materials.find((item) => item.id === original.id).text, original.text);
  assert.equal(data.materials.find((item) => item.id === revised.id).supersedesId, original.id);
  assert.equal(data.attempts.find((item) => item.id === practice.id).context, "class");
  const missing = { ...revised, id: crypto.randomUUID(), supersedesId: crypto.randomUUID() };
  assert.equal((await trainingResponse(request("sync", "POST", { materials: [missing] }), env)).status, 400);
  assert.equal((await trainingResponse(request("sync", "POST", { materials: [{ ...original, url: "javascript:alert(1)" }] }), env)).status, 400);
});

test("optional review attempts round-trip without changing task identity and stay immutable", async () => {
  const saved = attempt({ review: true, completedPasses: 2 });
  const ordinary = attempt({ review: false });
  const legacy = attempt();
  for (const attempts of [[saved, ordinary, legacy], [saved]]) {
    const response = await trainingResponse(request("sync", "POST", { attempts }), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    for (const item of [saved, ordinary, legacy]) {
      assert.deepEqual(data.attempts.filter((entry) => entry.id === item.id), [item]);
    }
  }
  const conflict = await trainingResponse(request("sync", "POST", { attempts: [{ ...saved, review: false }] }), env);
  assert.equal(conflict.status, 409, "review status cannot rewrite a saved attempt");
  const snapshot = await (await trainingResponse(request("bootstrap"), env)).json();
  assert.deepEqual(snapshot.attempts.find((item) => item.id === saved.id), saved);
});

test("review requires a boolean and cannot bypass known-activity validation", async () => {
  for (const review of [null, "true", "false", 0, 1, [], {}]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt({ review })] }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid review flag.");
  }
  for (const overrides of [
    { taskId: "unknown" },
    { assignmentId: "unknown" },
    { assignmentId: "unknown", taskId: "unknown-reinforcement" },
  ]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt({ ...overrides, review: true })] }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Unknown practice activity.");
  }
});

test("scratchpad and recall round-trip separately without adding recall to total time", async () => {
  const saved = attempt({ scratchpad: "  First pass: CQ\n\nSecond pass: TEST\t?\n", note: "A separate reflection.", recallSeconds: 90 });
  const empty = attempt({ scratchpad: "", recallSeconds: 0 });
  const limit = attempt({
    startedAt: new Date(Date.now() - 86_400_000).toISOString(),
    activeSeconds: 86_400, recallSeconds: 86_400, scratchpad: "x".repeat(10_000),
  });
  const legacy = attempt();
  for (const attempts of [[saved, empty, limit, legacy], [saved]]) {
    const response = await trainingResponse(request("sync", "POST", { attempts }), env);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    for (const item of [saved, empty, limit, legacy]) {
      assert.deepEqual(snapshot.attempts.filter((entry) => entry.id === item.id), [item]);
    }
    assert.equal(snapshot.attempts.find((item) => item.id === saved.id).activeSeconds, 600);
  }
  for (const changes of [{ scratchpad: "Changed scratchpad" }, { recallSeconds: 91 }]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [{ ...saved, ...changes }] }), env);
    assert.equal(response.status, 409, "saved scratchpad and recall remain immutable");
  }
  const snapshot = await (await trainingResponse(request("bootstrap"), env)).json();
  assert.deepEqual(snapshot.attempts.find((item) => item.id === saved.id), saved);
});

test("scratchpad and recall reject malformed, oversized, and inconsistent values", async () => {
  for (const scratchpad of [null, true, 3, [], {}, "contains\0null", "x".repeat(10_001)]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt({ scratchpad })] }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid scratchpad.");
  }
  for (const recallSeconds of [null, true, "90", [], {}, -1, 0.5, 86_401]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt({ recallSeconds })] }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid recall seconds.");
  }
  for (const values of [{ recallSeconds: 601 }, { activeSeconds: 0, recallSeconds: 1 }]) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt(values)] }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Recall time exceeds total practice time.");
  }
  const unknown = attempt({ taskId: "unknown", scratchpad: "CQ", recallSeconds: 90 });
  const response = await trainingResponse(request("sync", "POST", { attempts: [unknown] }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Unknown practice activity.");
});

test("derived reinforcement IDs sync only for a real course assignment", async () => {
  const review = attempt({ taskId: "s1d1-reinforcement" });
  const response = await trainingResponse(request("sync", "POST", { attempts: [review] }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).attempts.some((item) => item.id === review.id), true);
  for (const invalid of [
    attempt({ assignmentId: "unknown", taskId: "unknown-reinforcement" }),
    attempt({ taskId: "s2d1-reinforcement" }),
    attempt({ taskId: "s1d1-reinforcement-anything" }),
  ]) assert.equal((await trainingResponse(request("sync", "POST", { attempts: [invalid] }), env)).status, 400);
});

test("stale preferences do not overwrite a newer device update", async () => {
  const latest = { blockMinutes: 10, reminderTime: "08:30", joinUrl: "https://example.org/private-meeting", updatedAt: now() };
  assert.equal((await trainingResponse(request("sync", "POST", { preferences: latest }), env)).status, 200);
  const stale = { blockMinutes: 15, reminderTime: "10:00", updatedAt: "2020-01-02T00:00:00.000Z" };
  const response = await trainingResponse(request("sync", "POST", { preferences: stale }), env);
  assert.deepEqual((await response.json()).preferences, latest);
});

test("calendar capability is hashed, rotates, revokes, and exposes no private fields", async () => {
  const response = await trainingResponse(request("calendar-token", "POST"), env);
  assert.equal(response.status, 200);
  const { url } = await response.json();
  const row = await db.prepare("SELECT token_hash FROM training_calendar_tokens WHERE owner_id = ?").bind("local:test-owner").first();
  assert.equal(row.token_hash.length, 64);
  assert.equal(url.includes(row.token_hash), false);
  const feed = await trainingResponse(new Request(url), env);
  assert.equal(feed.status, 200);
  const text = await feed.text();
  assert.match(text, /DTSTART:20260905T123000Z/);
  assert.match(text, /URL:https:\/\/rwjblue.com\/radio\/cw-training\/\?start=next/);
  assert.doesNotMatch(text, /private|Synthetic|Breakout|TEST|verified-owner|test-owner/i);
  assert.equal((await trainingResponse(new Request(url, { method: "HEAD" }), env)).status, 200);
  const rotated = await (await trainingResponse(request("calendar-token", "POST"), env)).json();
  assert.notEqual(rotated.url, url);
  assert.equal((await trainingResponse(new Request(url), env)).status, 404);
  assert.equal((await trainingResponse(request("calendar-token", "DELETE"), env)).status, 200);
  assert.equal((await trainingResponse(new Request(rotated.url), env)).status, 404);
});

test("calendar reminders resolve course time zone across daylight saving changes", () => {
  const sample = { ...course, assignments: [{ date: "2026-10-31" }, { date: "2026-11-02" }] };
  const result = buildTrainingCalendar(sample, { blockMinutes: 15, reminderTime: "09:00", updatedAt: "2026-09-05T00:00:00.000Z" });
  assert.match(result, /DTSTART:20261031T130000Z/);
  assert.match(result, /DTSTART:20261102T140000Z/);
  assert.equal((result.match(/BEGIN:VEVENT/g) ?? []).length, 2);
});
