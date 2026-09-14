import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchLCWOExports, LCWOImportError, parseLCWOExport } from "../worker/lcwo.ts";

const credentials = { username: "SyntheticUser", password: "synthetic +&= password" };
const sourceTime = "2026-09-10 01:23:45";
const row = (overrides = {}) => ({ NR: "12", uid: "34", time: sourceTime, ...overrides });
const login = () => new Response("<html><!-- LOGIN_SUCCESS --></html>", {
  headers: { "Set-Cookie": "PHPSESSID=synthetic-session; Path=/; HttpOnly; Secure" },
});
const emptyExports = () => [Response.json([]), Response.json([]), Response.json([]), Response.json([])];

function sequence(responses) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      assert.ok(responses.length, "unexpected additional LCWO request");
      return responses.shift();
    },
  };
}

function hasSafeCode(code) {
  return (error) => {
    assert.ok(error instanceof LCWOImportError);
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /SyntheticUser|synthetic|password-with-private-data/);
    assert.equal(error.cause, undefined);
    return true;
  };
}

test("LCWO exports preserve peak speed, zero scores and noncompetitive runs without inventing report fields", () => {
  const [result] = parseLCWOExport("callsigns", [row({ max: "0", score: "0", valid: "0" })]);
  assert.deepEqual(result, {
    id: "callsigns:34:12", kind: "callsign", sourceType: "callsigns",
    sourceUserId: "34", sourceResultId: "12", sourceTime,
    recordedAt: "2026-09-10T01:23:45.000Z", competitive: false,
    maximumWpm: 0, score: 0,
  });
  const [words] = parseLCWOExport("words", [row({ max: "42", score: 1234, valid: 1 })]);
  assert.equal(words.maximumWpm, 42);
  assert.equal(words.competitive, true);
  for (const missing of ["startingWpm", "characterWpm", "errors", "errorPercent", "length", "duration", "activeSeconds"]) {
    assert.equal(Object.hasOwn(words, missing), false, `${missing} must not be inferred`);
  }
});

test("group categories and stored accuracy stay distinct; mixed groups are skipped and Koch stays separate", () => {
  const groups = parseLCWOExport("groups", [
    row({ NR: "1", mode: "letters", speed: "30", eff: "20", accuracy: "92.5", valid: "0" }),
    row({ NR: "2", mode: "figures", speed: 0, eff: 0, accuracy: 0 }),
    row({ NR: "3", mode: "custom", speed: "35", eff: "25", accuracy: "100" }),
    row({ NR: "4", mode: "mixed", speed: "20", eff: "15", accuracy: "80" }),
  ]);
  assert.deepEqual(groups.map((run) => run.kind), ["letters", "figures", "custom"]);
  assert.equal(groups[0].characterWpm, 30);
  assert.equal(groups[0].effectiveWpm, 20);
  assert.equal(groups[0].accuracyPercent, 92.5);
  assert.equal(groups[0].competitive, false);
  assert.equal(groups[1].accuracyPercent, 0);
  assert.equal(Object.hasOwn(groups[0], "errorPercent"), false);
  const [koch] = parseLCWOExport("koch", [row({ lesson: "21", speed: "30", eff: "18", accuracy: "96" })]);
  assert.equal(koch.kind, "koch");
  assert.equal(koch.lesson, 21);
});

test("absent LCWO metrics remain absent and result IDs retain large integer precision", () => {
  const [result] = parseLCWOExport("words", [row({ NR: "18446744073709551615", max: null, score: "", valid: undefined })]);
  assert.equal(result.id, "words:34:18446744073709551615");
  assert.equal(Object.hasOwn(result, "maximumWpm"), false);
  assert.equal(Object.hasOwn(result, "score"), false);
  assert.equal(Object.hasOwn(result, "competitive"), false);
});

test("stable source identity deduplicates identical results and rejects conflicting duplicates", () => {
  const values = [row({ NR: "2", max: "40" }), row({ NR: "1", max: "30" })];
  const first = parseLCWOExport("words", [...values, values[0]]);
  const second = parseLCWOExport("words", [...values].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.throws(() => parseLCWOExport("words", [values[0], { ...values[0], max: "41" }]), hasSafeCode("invalid_export"));
  assert.throws(() => parseLCWOExport("words", [values[0], { ...values[1], uid: "35" }]), hasSafeCode("invalid_export"));
});

test("invalid source rows fail atomically, including malformed dates and nonnumeric metrics", () => {
  for (const invalid of [
    null, [], "row", row({ NR: 9007199254740992 }), row({ uid: "../private" }),
    row({ time: "2026-02-30 12:00:00" }), row({ time: "2026-09-10T01:23:45Z" }),
    row({ max: "NaN" }), row({ score: "1e3" }), row({ score: -1 }), row({ valid: "2" }),
  ]) assert.throws(() => parseLCWOExport("words", [row(), invalid]), hasSafeCode("invalid_export"));
  assert.throws(() => parseLCWOExport("groups", [row({ mode: "letters", accuracy: "101" })]), hasSafeCode("invalid_export"));
  assert.throws(() => parseLCWOExport("groups", [row({ mode: "unknown" })]), hasSafeCode("invalid_export"));
  assert.throws(() => parseLCWOExport("qtc", []), hasSafeCode("invalid_export"));
  assert.throws(() => parseLCWOExport("words", { msg: "you must log in to use this function" }), hasSafeCode("authentication"));
  assert.throws(() => parseLCWOExport("words", { msg: "password-with-private-data" }), hasSafeCode("invalid_export"));
});

test("transport logs in with normal form encoding, uses only the PHP session, and fetches exports in sequence", async () => {
  const mock = sequence([
    login(),
    Response.json([row({ max: "35", score: "120" })]),
    Response.json([row({ max: "28", score: "100" })]),
    Response.json([row({ mode: "letters", speed: "30", eff: "20", accuracy: "95" })]),
    Response.json([row({ lesson: "12", speed: "25", eff: "18", accuracy: "97" })]),
  ]);
  const results = await fetchLCWOExports(credentials, mock.fetch);
  assert.equal(results.length, 4);
  assert.equal(mock.calls[0].url, "https://lcwo.net/dologin");
  assert.equal(mock.calls[0].init.method, "POST");
  assert.deepEqual(Object.fromEntries(new URLSearchParams(mock.calls[0].init.body)), credentials);
  assert.equal(mock.calls[0].init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.deepEqual(mock.calls.slice(1).map(({ url }) => new URL(url).searchParams.get("type")), ["words", "callsigns", "groups", "koch"]);
  for (const { url, init } of mock.calls) {
    assert.equal(new URL(url).origin, "https://lcwo.net");
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal instanceof AbortSignal);
  }
  for (const { url, init } of mock.calls.slice(1)) {
    assert.equal(new URL(url).searchParams.get("action"), "export_results");
    assert.equal(new URL(url).searchParams.get("fmt"), "json");
    assert.equal(init.headers.Cookie, "PHPSESSID=synthetic-session");
    assert.equal(init.body, undefined);
  }
  assert.doesNotMatch(JSON.stringify(results), /SyntheticUser|synthetic-session|password/);
});

test("empty authenticated exports are valid and never cause fabricated results", async () => {
  const mock = sequence([login(), ...emptyExports()]);
  assert.deepEqual(await fetchLCWOExports(credentials, mock.fetch), []);
  assert.equal(mock.calls.length, 5);
});

test("failed sign-in or missing/ambiguous PHP session stops without requesting exports", async () => {
  for (const response of [
    new Response("Sorry, login failed: password-with-private-data", { headers: { "Set-Cookie": "PHPSESSID=synthetic-session; Path=/" } }),
    new Response("<!-- LOGIN_SUCCESS -->"),
    new Response("<!-- LOGIN_SUCCESS -->", { headers: [
      ["Set-Cookie", "PHPSESSID=first; Path=/"], ["Set-Cookie", "PHPSESSID=second; Path=/"],
    ] }),
  ]) {
    const mock = sequence([response]);
    await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("authentication"));
    assert.equal(mock.calls.length, 1);
  }
});

test("export authentication failures are checked even after a successful login marker", async () => {
  const mock = sequence([login(), Response.json({ msg: "you must log in to use this function" })]);
  await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("authentication"));
  assert.equal(mock.calls.length, 2);
});

test("redirect responses stop at their original request without forwarding credentials or cookies", async () => {
  for (const afterLogin of [false, true]) {
    const mock = sequence([
      ...(afterLogin ? [login()] : []),
      new Response(null, { status: 307, headers: { Location: "https://elsewhere.example/private" } }),
    ]);
    await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("upstream"));
    assert.equal(mock.calls.length, afterLogin ? 2 : 1);
    assert.equal(mock.calls.at(-1).init.redirect, "manual");
  }
});

test("upstream errors, malformed JSON and truncated JSON do not expose response details", async () => {
  for (const [response, code] of [
    [new Response("password-with-private-data", { status: 500 }), "upstream"],
    [new Response("<html>password-with-private-data</html>"), "invalid_export"],
    [new Response('[{"NR":"12","uid":"34"'), "invalid_export"],
    [Response.json({ msg: "password-with-private-data" }), "invalid_export"],
  ]) {
    const mock = sequence([login(), response]);
    await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode(code));
    assert.equal(mock.calls.length, 2);
  }
  await assert.rejects(fetchLCWOExports(credentials, async () => { throw new Error("password-with-private-data"); }), hasSafeCode("upstream"));
});

test("all exports must have one source user, including skipped mixed groups", async () => {
  const mock = sequence([
    login(), Response.json([row({ max: "30" })]), Response.json([]),
    Response.json([row({ uid: "35", mode: "mixed" })]),
  ]);
  await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("invalid_export"));
  assert.equal(mock.calls.length, 4);
});

test("credential validation makes no network requests", async () => {
  const mock = sequence([]);
  for (const invalid of [null, {}, { ...credentials, username: "../person" }, { ...credentials, username: "x".repeat(25) }, { ...credentials, password: "" }]) {
    await assert.rejects(fetchLCWOExports(invalid, mock.fetch), hasSafeCode("credentials"));
  }
  assert.equal(mock.calls.length, 0);
});

test("request timeout aborts a stalled request and returns a sanitized error", async () => {
  let signal;
  await assert.rejects(fetchLCWOExports(credentials, async (_url, init) => {
    signal = init.signal;
    return new Promise(() => {});
  }, { timeoutMs: 5 }), hasSafeCode("timeout"));
  assert.equal(signal.aborted, true);
});

test("the timeout also covers a stalled response body and cancels its reader", async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const mock = sequence([login(), new Response(body)]);
  await assert.rejects(fetchLCWOExports(credentials, mock.fetch, { timeoutMs: 5 }), hasSafeCode("timeout"));
  assert.equal(cancelled, true);
  assert.equal(mock.calls.length, 2);
});

test("body limits reject both declared lengths and streamed exports, without partial results", async () => {
  for (const response of [
    new Response("[]", { headers: { "Content-Length": String(8 * 1024 * 1024 + 1) } }),
    new Response(new Uint8Array(8 * 1024 * 1024 + 1)),
  ]) {
    const mock = sequence([login(), response]);
    await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("limit"));
    assert.equal(mock.calls.length, 2);
  }
  const mock = sequence([new Response(new Uint8Array(512 * 1024 + 1))]);
  await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("limit"));
});

test("record limits count raw rows across exports, including duplicates", async () => {
  assert.throws(() => parseLCWOExport("words", Array(50_001).fill(row())), hasSafeCode("limit"));
  const mock = sequence([
    login(), Response.json(Array(25_001).fill(row())), Response.json(Array(25_000).fill(row())),
  ]);
  await assert.rejects(fetchLCWOExports(credentials, mock.fetch), hasSafeCode("limit"));
  assert.equal(mock.calls.length, 3);
});
