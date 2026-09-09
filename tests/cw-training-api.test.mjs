import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { buildTrainingCalendar, trainingResponse, TRAINING_COURSE_ID } from "../worker/cw-training.ts";
import { OTHER_PRACTICE_ASSIGNMENT_ID, OTHER_PRACTICE_ACTIVITIES } from "../src/lib/cw-training/other-practice.ts";

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
  for (const migration of ["0001_training.sql", "0002_reports.sql"]) {
    const schema = await readFile(new URL(`../migrations/cw-training/${migration}`, import.meta.url), "utf8");
    const statements = schema.replace(/^--.*$/gm, "").trim().split(/;\n(?=\n|$)/).filter((sql) => sql.trim());
    await db.batch(statements.map((sql) => db.prepare(sql)));
  }
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

function otherPracticeAttempt(overrides = {}) {
  return attempt({
    assignmentId: OTHER_PRACTICE_ASSIGNMENT_ID, taskId: "other:general",
    context: "practice", review: true, completed: false, ...overrides,
  });
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

test("all self-directed categories round-trip as extra practice without changing the curriculum", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "other-practice-roundtrip" };
  const attempts = OTHER_PRACTICE_ACTIVITIES.map((activity, index) => otherPracticeAttempt({
    taskId: activity.id, activeSeconds: 180 + index * 60, note: `Synthetic private ${activity.title} note.`,
    ...(index === 1 ? { completedPasses: 0, recallSeconds: 30, scratchpad: "CQ\nTEST" } : {}),
  }));
  for (const req of [request("sync", "POST", { attempts }), request("bootstrap")]) {
    const response = await trainingResponse(req, ownerEnv);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const snapshot = await response.json();
    assert.equal(snapshot.attempts.length, 3);
    for (const saved of attempts) assert.deepEqual(snapshot.attempts.find(item => item.id === saved.id), saved);
    assert.deepEqual(snapshot.course, course, "self-directed categories do not become curriculum assignments");
    assert.ok(snapshot.attempts.every(item => item.review === true && item.completed === false && !item.completedPasses));
  }
});

test("self-directed activities reject unknown categories, assignment mismatches and forged completion atomically", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "other-practice-invalid" };
  const invalid = [
    { taskId: "other:unknown" }, { taskId: "other:general:extra" }, { taskId: "other:constructor" },
    { taskId: "other:ICR" }, { taskId: "warmup" }, { taskId: "s1d1-reinforcement" },
    { assignmentId: "s1d1" }, { assignmentId: "unknown" }, { assignmentId: "other-practice:extra" },
    { context: "class" }, { review: false }, { review: undefined }, { completed: true },
    { completedPasses: 1 }, { completedPasses: 100 }, { completedPasses: -1 }, { completedPasses: "0" },
    { owner: "some-other-owner" }, { activeSeconds: 6010 }, { recallSeconds: 601 },
  ];
  for (const overrides of invalid) {
    const pending = otherPracticeAttempt();
    const response = await trainingResponse(request("sync", "POST", {
      attempts: [pending, otherPracticeAttempt(overrides)],
    }), ownerEnv);
    assert.equal(response.status, 400, JSON.stringify(overrides));
    const snapshot = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
    assert.deepEqual(snapshot.attempts, [], "a rejected mixed batch writes neither record");
  }
});

test("self-directed retries remain idempotent and cannot rewrite saved categories, notes or time", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "other-practice-immutable" };
  const saved = otherPracticeAttempt({ taskId: "other:word-recognition", note: "Synthetic original podcast practice." });
  for (let index = 0; index < 2; index++) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [saved] }), ownerEnv);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).attempts, [saved]);
  }
  for (const overrides of [{ taskId: "other:icr" }, { note: "Changed" }, { activeSeconds: 599 }]) {
    const pending = otherPracticeAttempt();
    const response = await trainingResponse(request("sync", "POST", { attempts: [pending, { ...saved, ...overrides }] }), ownerEnv);
    assert.equal(response.status, 409);
    const snapshot = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
    assert.deepEqual(snapshot.attempts, [saved], "immutable conflicts roll back the whole batch");
  }
});

test("self-directed records stay owner-scoped even when two owners use the same attempt ID", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "other-practice-owner-a" };
  const otherEnv = { ...env, TRAINING_DEV_USER: "other-practice-owner-b" };
  const original = otherPracticeAttempt({ note: "Owner A private practice." });
  assert.equal((await trainingResponse(request("sync", "POST", { attempts: [original] }), ownerEnv)).status, 200);
  const empty = await (await trainingResponse(request("bootstrap"), otherEnv)).json();
  assert.deepEqual(empty.attempts, []);
  const other = { ...original, taskId: "other:icr", note: "Owner B private practice." };
  const response = await trainingResponse(request("sync", "POST", { attempts: [other] }), otherEnv);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).attempts, [other]);
  const unchanged = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
  assert.deepEqual(unchanged.attempts, [original]);
});

test("self-directed logging cannot bypass Access authentication or same-origin write protection", async () => {
  const attempts = [otherPracticeAttempt()];
  const protectedEnv = {
    ...env, TRAINING_ACCESS_TEAM: "https://other-practice-test.cloudflareaccess.com",
    TRAINING_ACCESS_AUD: "test-audience", TRAINING_OWNER_EMAIL: "owner@example.org",
  };
  const forged = new Request("https://n1rwj.com/api/cw-training/sync", {
    method: "POST", body: JSON.stringify({ attempts }),
    headers: { Origin: "https://n1rwj.com", "Content-Type": "application/json", "Cf-Access-Authenticated-User-Email": "owner@example.org" },
  });
  assert.equal((await trainingResponse(forged, protectedEnv)).status, 401);
  assert.equal((await trainingResponse(request("sync", "POST", { attempts }, { Origin: "https://other.example" }), env)).status, 403);
  assert.equal((await trainingResponse(request("sync", "POST", { attempts }, { "Sec-Fetch-Site": "cross-site" }), env)).status, 403);
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

test("carried tasks round-trip across reloads and remain scoped to their owner", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "carry-owner" };
  const otherEnv = { ...env, TRAINING_DEV_USER: "carry-other-owner" };
  const settings = {
    blockMinutes: 15, reminderTime: "09:00", updatedAt: now(),
    carriedTasks: [{ taskId: "warmup", date: "2026-09-06" }],
  };
  for (const req of [request("sync", "POST", { preferences: settings }), request("bootstrap")]) {
    const response = await trainingResponse(req, ownerEnv);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.deepEqual(snapshot.preferences, settings, "past dates from offline work remain valid");
    assert.equal(snapshot.course.assignments[0].date, "2026-09-05", "carry does not rewrite the curriculum");
  }
  const other = await (await trainingResponse(request("bootstrap"), otherEnv)).json();
  assert.equal(other.preferences.carriedTasks, undefined);
  const otherSettings = { ...settings, carriedTasks: [{ taskId: "warmup", date: "2026-09-07" }] };
  assert.equal((await trainingResponse(request("sync", "POST", { preferences: otherSettings }), otherEnv)).status, 200);
  const original = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
  assert.deepEqual(original.preferences.carriedTasks, settings.carriedTasks);
});

test("carried tasks validate bounded unique known task IDs and real calendar dates", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "carry-validation-owner" };
  const settings = { blockMinutes: 15, reminderTime: "09:00", updatedAt: now() };
  const invalidLists = [
    null, true, 1, "warmup", {},
    [null], [true], ["warmup"], [[]], [{}],
    [{ taskId: "warmup" }], [{ date: "2026-09-07" }],
    [{ taskId: "warmup", date: "2026-09-07", owner: "other-owner" }],
    [{ taskId: "warmup", date: "2026-09-07" }, { taskId: "warmup", date: "2026-09-08" }],
    Array.from({ length: 101 }, (_, index) => ({ taskId: `task-${index}`, date: "2026-09-07" })),
    ...[null, true, 1, [], {}, "bad task", "x".repeat(151), "unknown", "s1d1-reinforcement"].map((taskId) => [
      { taskId, date: "2026-09-07" },
    ]),
    ...[
      null, true, 1, [], {}, "", "2026-9-07", "2026-09-7", "2026-09-07T00:00:00.000Z",
      "2026-02-29", "2026-04-31", "2026-00-07", "2026-13-07", "2026-09-00", "2026-09-32",
      "2019-12-31", "2101-01-01", "2026-09-04",
    ].map((date) => [{ taskId: "warmup", date }]),
  ];
  for (const carriedTasks of invalidLists) {
    const response = await trainingResponse(request("sync", "POST", { preferences: { ...settings, carriedTasks } }), ownerEnv);
    assert.equal(response.status, 400, JSON.stringify(carriedTasks));
  }
  for (const [index, date] of ["2026-09-05", "2028-02-29", "2100-12-31"].entries()) {
    const preferences = { ...settings, updatedAt: new Date(Date.now() + index * 1000).toISOString(), carriedTasks: [{ taskId: "warmup", date }] };
    const response = await trainingResponse(request("sync", "POST", { preferences }), ownerEnv);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).preferences, preferences);
  }
});

test("legacy preferences preserve carried tasks while explicit clearing uses the existing timestamp rule", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "carry-legacy-owner" };
  const baseTime = Date.now() - 10_000;
  const settings = {
    blockMinutes: 15, reminderTime: "09:00", joinUrl: "https://example.org/class",
    updatedAt: new Date(baseTime).toISOString(), carriedTasks: [{ taskId: "warmup", date: "2026-09-07" }],
  };
  assert.equal((await trainingResponse(request("sync", "POST", { preferences: settings }), ownerEnv)).status, 200);
  const legacy = { blockMinutes: 10, reminderTime: "10:00", updatedAt: new Date(baseTime + 1000).toISOString() };
  const preserved = await (await trainingResponse(request("sync", "POST", { preferences: legacy }), ownerEnv)).json();
  assert.deepEqual(preserved.preferences, { ...legacy, carriedTasks: settings.carriedTasks });
  assert.equal(preserved.preferences.joinUrl, undefined, "unrelated preferences retain replacement semantics");
  const cleared = { ...legacy, carriedTasks: [], updatedAt: new Date(baseTime + 2000).toISOString() };
  const response = await trainingResponse(request("sync", "POST", { preferences: cleared }), ownerEnv);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).preferences, cleared);
  for (const preferences of [settings, legacy, { ...settings, updatedAt: cleared.updatedAt }]) {
    const stale = await trainingResponse(request("sync", "POST", { preferences }), ownerEnv);
    assert.equal(stale.status, 200);
    assert.deepEqual((await stale.json()).preferences, cleared, "stale or same-time updates cannot restore a cleared carry");
  }
  const legacyAfterClear = { ...legacy, updatedAt: new Date(baseTime + 3000).toISOString() };
  const latest = await (await trainingResponse(request("sync", "POST", { preferences: legacyAfterClear }), ownerEnv)).json();
  assert.deepEqual(latest.preferences, { ...legacyAfterClear, carriedTasks: [] });
});

test("an older client preserves carry changes committed after its snapshot was read", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "carry-concurrent-owner" };
  const baseTime = Date.now() - 10_000;
  const original = { blockMinutes: 15, reminderTime: "09:00", updatedAt: new Date(baseTime).toISOString() };
  assert.equal((await trainingResponse(request("sync", "POST", { preferences: original }), ownerEnv)).status, 200);
  const concurrent = { ...original, carriedTasks: [{ taskId: "warmup", date: "2026-09-07" }], updatedAt: new Date(baseTime + 1000).toISOString() };
  let firstRead = true;
  const interleavedDb = {
    prepare: db.prepare.bind(db),
    async batch(statements) {
      const results = await db.batch(statements);
      if (firstRead) {
        firstRead = false;
        const response = await trainingResponse(request("sync", "POST", { preferences: concurrent }), ownerEnv);
        assert.equal(response.status, 200);
      }
      return results;
    },
  };
  const legacy = { ...original, blockMinutes: 10, updatedAt: new Date(baseTime + 2000).toISOString() };
  const response = await trainingResponse(request("sync", "POST", { preferences: legacy }), { ...ownerEnv, TRAINING_DB: interleavedDb });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).preferences, { ...legacy, carriedTasks: concurrent.carriedTasks });
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

function sessionReport(overrides = {}) {
  return {
    id: crypto.randomUUID(), session: 1,
    fromDate: "2026-09-05", toDate: "2026-09-07", reportDate: "2026-09-07",
    createdAt: now(), answers: {}, sourceAttemptIds: [], status: "draft", ...overrides,
  };
}

function submittedReport(overrides = {}) {
  const stamp = now();
  return sessionReport({
    createdAt: stamp, submittedAt: stamp, status: "submitted",
    answers: { callsign: "TEST", firstName: "Test", session: "1", reportDate: "2026-09-07", scalesRating: "Very good", runnerVerifiedPoints: "0" },
    ...overrides,
  });
}

const runnerMetrics = {
  version: 1, mode: "SingleCall", wpm: 18, durationSeconds: 900, elapsedSeconds: 599.75,
  status: "stopped", verifiedPoints: 11, qsoCount: 12, score: 132,
  speeds: [18, 20], conditions: false, source: "embedded",
};

test("structured practice metrics round-trip with exact values and retain legacy records", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "report-metrics-owner" };
  const base = attempt();
  const runner = attempt({
    performanceRating: "very-good", runnerResult: {
      ...runnerMetrics, runStartedAt: base.startedAt, runEndedAt: base.endedAt,
    },
  });
  const audio = attempt({
    difficulty: "hard", performanceRating: "fair",
    audioResults: [{ url: "https://example.org/WD101-13.mp3", title: "WD101-13", speedWpm: 13, activeSeconds: 480.25, completedPasses: 2 }],
  });
  const lcwo = attempt({ lcwoResult: { kind: "letters", speedWpm: 13, groupLength: 3, errorPercent: 29.4 } });
  const zero = attempt({ lcwoResult: { kind: "callsign", speedWpm: 15, score: 0, errorCount: 0 } });
  const legacy = attempt({ difficulty: "right", note: "Historical note stays intact." });
  const records = [runner, audio, lcwo, zero, legacy];
  for (let index = 0; index < 2; index++) {
    const response = await trainingResponse(request("sync", "POST", { attempts: records }), ownerEnv);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.attempts.length, records.length);
    for (const expected of records) assert.deepEqual(snapshot.attempts.find((item) => item.id === expected.id), expected);
  }
  const changed = { ...runner, runnerResult: { ...runner.runnerResult, verifiedPoints: 12 } };
  assert.equal((await trainingResponse(request("sync", "POST", { attempts: [changed] }), ownerEnv)).status, 409);
});

test("structured metrics reject malformed values and distinguish LCWO counts from percentages", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "report-metrics-invalid" };
  const invalid = [
    { performanceRating: "easy" }, { performanceRating: null }, { performanceRating: ["good"] },
    { runnerResult: null }, { runnerResult: { ...runnerMetrics, version: 2 } },
    { runnerResult: { ...runnerMetrics, mode: ["SingleCall"] } },
    { runnerResult: { ...runnerMetrics, status: ["completed"] } },
    { runnerResult: { ...runnerMetrics, source: ["embedded"] } },
    { runnerResult: { ...runnerMetrics, speeds: [] } },
    { runnerResult: { ...runnerMetrics, speeds: [20] } },
    { runnerResult: { ...runnerMetrics, speeds: [18, 18] } },
    { runnerResult: { ...runnerMetrics, elapsedSeconds: -0.1 } },
    { runnerResult: { ...runnerMetrics, verifiedPoints: 13 } },
    { runnerResult: { ...runnerMetrics, verifiedPoints: 1.5 } },
    { runnerResult: { ...runnerMetrics, conditions: "false" } },
    { runnerResult: { ...runnerMetrics, source: "trusted" } },
    { runnerResult: { ...runnerMetrics, runStartedAt: "2026-09-06T00:00:00.000Z", runEndedAt: "2026-09-05T00:00:00.000Z" } },
    { audioResults: {} },
    { audioResults: [{ url: "javascript:alert(1)", title: "Bad", activeSeconds: 0, completedPasses: 0 }] },
    { audioResults: [{ url: "https://example.org/audio.mp3", title: "Bad", activeSeconds: -1, completedPasses: 0 }] },
    { lcwoResult: { kind: ["letters"] } },
    { lcwoResult: { kind: "letters", errorCount: 5 } },
    { lcwoResult: { kind: "callsign", errorPercent: 5 } },
    { lcwoResult: { kind: "words", errorCount: 0.5 } },
    { lcwoResult: { kind: "custom", groupLength: 0 } },
    { lcwoResult: { kind: "figures", errorPercent: 100.1 } },
    { lcwoResult: { kind: "letters", errorPercent: null } },
    { lcwoResult: { kind: "words", unknownMetric: 1 } },
  ];
  for (const fields of invalid) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt(), attempt(fields)] }), ownerEnv);
    assert.equal(response.status, 400, JSON.stringify(fields));
  }
  const snapshot = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
  assert.deepEqual(snapshot.attempts, [], "no partial writes from rejected metric batches");
});

test("reports retain immutable draft revisions and submitted snapshots across retries and old-client sync", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "reports-revisions-owner" };
  const source = attempt();
  const draft = sessionReport({ answers: { firstName: "Test" }, editedAnswerKeys: ["firstName"], sourceAttemptIds: [source.id] });
  const submitted = submittedReport({ editedAnswerKeys: [], sourceAttemptIds: [source.id] });
  const first = await trainingResponse(request("sync", "POST", { attempts: [source], reports: [draft, submitted] }), ownerEnv);
  assert.equal(first.status, 200, "a report can reference an attempt in the same atomic sync");
  for (const body of [{ reports: [submitted, draft] }, { attempts: [source] }, { reports: [] }, {}]) {
    const response = await trainingResponse(request("sync", "POST", body), ownerEnv);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.reports.length, 2);
    assert.deepEqual(snapshot.reports.find((item) => item.id === draft.id), draft);
    assert.deepEqual(snapshot.reports.find((item) => item.id === submitted.id), submitted);
    assert.equal(snapshot.reports.find((item) => item.id === submitted.id).answers.runnerVerifiedPoints, "0");
  }
  for (const saved of [draft, submitted]) {
    const pending = attempt();
    const changed = { ...saved, answers: { ...saved.answers, problems: "Changed saved report." } };
    const response = await trainingResponse(request("sync", "POST", { attempts: [pending], reports: [changed] }), ownerEnv);
    assert.equal(response.status, 409);
    const snapshot = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
    assert.deepEqual(snapshot.attempts, [source], "a report conflict rolls back attempts in the same sync");
    assert.deepEqual(snapshot.reports.find((item) => item.id === saved.id), saved);
  }
});

test("report snapshots and their source references remain owner scoped", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "reports-owner-a" };
  const otherEnv = { ...env, TRAINING_DEV_USER: "reports-owner-b" };
  const source = attempt();
  const original = sessionReport({ sourceAttemptIds: [source.id], answers: { firstName: "Owner A" } });
  assert.equal((await trainingResponse(request("sync", "POST", { attempts: [source], reports: [original] }), ownerEnv)).status, 200);
  const otherSnapshot = await (await trainingResponse(request("bootstrap"), otherEnv)).json();
  assert.deepEqual(otherSnapshot.reports, []);
  assert.equal((await trainingResponse(request("sync", "POST", { reports: [original] }), otherEnv)).status, 400, "another owner's source attempt is not accessible");
  const other = { ...original, sourceAttemptIds: [], answers: { firstName: "Owner B" } };
  const response = await trainingResponse(request("sync", "POST", { reports: [other] }), otherEnv);
  assert.equal(response.status, 200, "the same UUID belongs to a separate owner namespace");
  assert.deepEqual((await response.json()).reports, [other]);
  assert.deepEqual((await (await trainingResponse(request("bootstrap"), ownerEnv)).json()).reports, [original]);
});

test("reports validate known fields, real dates, required submitted answers and bounded references before writing", async () => {
  const ownerEnv = { ...env, TRAINING_DEV_USER: "reports-invalid-owner" };
  const valid = submittedReport();
  const invalid = [
    sessionReport({ owner: "somebody-else" }),
    sessionReport({ answers: { unknown: "answer" } }),
    sessionReport({ answers: { firstName: null } }),
    sessionReport({ answers: { problems: "bad\0note" } }),
    sessionReport({ answers: { problems: "x".repeat(4_001) } }),
    sessionReport({ answers: { runnerWpm: "10" } }),
    sessionReport({ answers: { scalesRating: "Very Good" } }),
    sessionReport({ answers: { session: "2" } }),
    sessionReport({ answers: { reportDate: "2026-09-08" } }),
    sessionReport({ editedAnswerKeys: null }),
    sessionReport({ editedAnswerKeys: "firstName" }),
    sessionReport({ editedAnswerKeys: ["unknown"] }),
    sessionReport({ editedAnswerKeys: [["firstName"]] }),
    sessionReport({ editedAnswerKeys: ["firstName", "firstName"] }),
    sessionReport({ editedAnswerKeys: Array(43).fill("firstName") }),
    sessionReport({ fromDate: "2026-02-30" }),
    sessionReport({ fromDate: "2026-09-08" }),
    sessionReport({ session: 2 }),
    sessionReport({ sourceAttemptIds: [crypto.randomUUID()] }),
    sessionReport({ sourceAttemptIds: ["not-a-uuid"] }),
    sessionReport({ sourceAttemptIds: Array(2).fill(crypto.randomUUID()) }),
    sessionReport({ submittedAt: now() }),
    sessionReport({ status: ["draft"] }),
    sessionReport({ status: "submitted" }),
    { ...valid, submittedAt: undefined },
    { ...valid, submittedAt: "2020-01-01T00:00:00.000Z" },
    { ...valid, answers: { ...valid.answers, firstName: " " } },
  ];
  for (const report of invalid) {
    const response = await trainingResponse(request("sync", "POST", { attempts: [attempt()], reports: [report] }), ownerEnv);
    assert.equal(response.status, 400, JSON.stringify(report));
  }
  for (const reports of [null, {}, Array.from({ length: 21 }, () => sessionReport())]) {
    assert.equal((await trainingResponse(request("sync", "POST", { reports }), ownerEnv)).status, 400);
  }
  const snapshot = await (await trainingResponse(request("bootstrap"), ownerEnv)).json();
  assert.deepEqual(snapshot.reports, []);
  assert.deepEqual(snapshot.attempts, []);
});
