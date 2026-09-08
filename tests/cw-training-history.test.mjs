import assert from "node:assert/strict";
import test from "node:test";
import { practiceHistoryForDate, renderPracticeHistory } from "../src/lib/cw-training/history.ts";

const timezone = "America/New_York";
const day = "2026-09-08";
const attempt = (id, extra = {}) => ({
  id, assignmentId: "day-one", taskId: "runner", context: "practice",
  startedAt: "2026-09-08T12:00:00.000Z", endedAt: "2026-09-08T12:10:00.000Z",
  activeSeconds: 600, completed: false, ...extra,
});
const options = (extra = {}) => ({
  course: { timezone, assignments: [{ tasks: [
    { id: "runner", kind: "simulator", title: "Morse Runner" },
    { id: "audio", title: "Official recording" },
    { id: "sending", title: "Sending practice" },
  ] }] },
  materials: [{ id: "material-one", title: "Instructor preparation" }],
  pendingIds: new Set(), ...extra,
});

test("today includes all practiced activities, not class time or another date", () => {
  const records = [
    attempt("runner"), attempt("audio", { taskId: "audio" }),
    attempt("sending", { taskId: "sending" }),
    attempt("words", { taskId: "other:word-recognition", review: true }),
    attempt("icr", { taskId: "other:icr", review: true }),
    attempt("other", { taskId: "other:general", review: true }),
    attempt("material", { taskId: "material-one" }),
    attempt("class", { context: "class" }),
    attempt("yesterday", { startedAt: "2026-09-07T12:00:00.000Z" }),
    attempt("tomorrow", { startedAt: "2026-09-09T12:00:00.000Z" }),
    attempt("invalid", { startedAt: "invalid-date" }),
  ];
  assert.deepEqual(practiceHistoryForDate(records, day, timezone).map(({ id }) => id),
    ["audio", "icr", "material", "other", "runner", "sending", "words"]);
});

test("practice follows its course-local start date even if the run ends after midnight", () => {
  const records = [
    attempt("previous-evening", { startedAt: "2026-09-08T03:55:00.000Z", endedAt: "2026-09-08T04:05:00.000Z" }),
    attempt("midnight", { startedAt: "2026-09-08T04:00:00.000Z", endedAt: "2026-09-08T04:10:00.000Z" }),
    attempt("late-evening", { startedAt: "2026-09-09T03:55:00.000Z", endedAt: "2026-09-09T04:05:00.000Z" }),
    attempt("next-midnight", { startedAt: "2026-09-09T04:00:00.000Z", endedAt: "2026-09-09T04:10:00.000Z" }),
  ];
  assert.deepEqual(practiceHistoryForDate(records, day, timezone).map(({ id }) => id), ["late-evening", "midnight"]);
});

test("deduplication uses the latest record before filtering and leaves source data unchanged", () => {
  const first = attempt("same-id");
  const replacement = attempt("same-id", { activeSeconds: 900 });
  const movedOutOfToday = attempt("removed", { context: "class" });
  const records = [first, attempt("removed"), replacement, movedOutOfToday];
  const before = structuredClone(records);
  assert.deepEqual(practiceHistoryForDate(records, day, timezone), [replacement]);
  assert.deepEqual(records, before);
});

test("empty setup and dismissal records stay out, while zero-minute notes or earned progress remain", () => {
  const records = [
    attempt("empty", { activeSeconds: 0 }),
    attempt("whitespace", { activeSeconds: 0, note: " \n ", scratchpad: "\t" }),
    attempt("dismissed", { activeSeconds: 0, note: "[Left missed]" }),
    attempt("empty-manual", { activeSeconds: 0, note: "[Practiced elsewhere] " }),
    attempt("note", { activeSeconds: 0, note: "Ask about copying cut numbers." }),
    attempt("scratch", { activeSeconds: 0, scratchpad: "Preserve this reflection." }),
    attempt("pass", { activeSeconds: 0, completedPasses: 1 }),
    attempt("objective", { activeSeconds: 0, completed: true }),
    attempt("rating", { activeSeconds: 0, difficulty: "hard" }),
  ];
  assert.deepEqual(practiceHistoryForDate(records, day, timezone).map(({ id }) => id), ["note", "objective", "pass", "rating", "scratch"]);
});

test("sessions render independently with exact stored score summaries and explicit sync status", () => {
  const records = [
    attempt("first", { note: "Web Morse Runner: completed; 600 seconds; 4 QSOs; Verified Pts 3; verified score 6." }),
    attempt("second", { note: "Web Morse Runner: stopped (partial); 300 seconds; 3 QSOs; Verified Pts 2; verified score 4.", activeSeconds: 300 }),
  ];
  const html = renderPracticeHistory(records, options({ pendingIds: new Set(["second"]) }));
  assert.equal((html.match(/class="training-history-entry"/g) ?? []).length, 2);
  assert.match(html, /10 min/);
  assert.match(html, /5 min/);
  assert.match(html, /verified score 6/);
  assert.match(html, /verified score 4/);
  assert.doesNotMatch(html, /verified score 10/);
  assert.match(html, /Saved in account/);
  assert.match(html, /Saved on this device · waiting to sync/);
  assert.equal((html.match(/<summary>Results &amp; notes<\/summary>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]+ open>/);
});

test("titles, notes, scratchpads, and detail IDs are safely escaped and multiline text is preserved", () => {
  const id = 'id" onclick="bad()';
  const record = attempt(id, {
    note: '<script>alert("notes")</script>\nA & B',
    scratchpad: '<img src=x onerror="bad()">\nSecond line',
  });
  const settings = options({
    course: { timezone, assignments: [{ tasks: [{ id: "runner", title: '<svg onload="bad()"> & practice' }] }] },
    expandedIds: new Set([id]),
  });
  const html = renderPracticeHistory([record], settings);
  assert.doesNotMatch(html, /<script|<img|<svg/);
  assert.match(html, /&lt;script&gt;alert\(&quot;notes&quot;\)&lt;\/script&gt;\nA &amp; B/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;\nSecond line/);
  assert.match(html, /&lt;svg onload=&quot;bad\(\)&quot;&gt; &amp; practice/);
  assert.match(html, /data-history-id="id&quot; onclick=&quot;bad\(\)" open/);
  assert.match(html, /Recall &amp; scratchpad/);
});

test("history resolves assignment, instructor material, other-practice, and fallback titles", () => {
  const html = renderPracticeHistory([
    attempt("audio", { taskId: "audio", completedPasses: 2, recallSeconds: 90, difficulty: "right", completed: true }),
    attempt("material", { taskId: "material-one" }),
    attempt("words", { taskId: "other:word-recognition", review: true }),
    attempt("icr", { taskId: "other:icr", review: true }),
    attempt("other", { taskId: "other:general", review: true }),
    attempt("review", { review: true }),
    attempt("missing", { taskId: "unrecognized" }),
  ], options());
  for (const title of ["Official recording", "Instructor preparation", "Word recognition", "ICR (instant character recognition)", "Other CW practice"]) assert.ok(html.includes(title), title);
  assert.match(html, /<strong>Practice<\/strong>/);
  assert.match(html, /Other practice/);
  assert.match(html, /Extra review/);
  assert.match(html, /Requirements completed/);
  assert.match(html, /2 passes/);
  assert.match(html, /includes 1.5 min recall/);
  assert.match(html, /Felt: About right/);
  assert.doesNotMatch(html, /<details/);
});

test("optional Week history formatting shows dates and has a non-daily empty state", () => {
  assert.match(renderPracticeHistory([attempt("old")], options({ includeDate: true })), /Tue, Sep 8/);
  assert.match(renderPracticeHistory([], options()), /No saved practice yet today/);
  assert.doesNotMatch(renderPracticeHistory([], options({ includeDate: true })), /today/);
});

test("a short final runner run labels the cumulative assignment milestone, without changing review or class labels", () => {
  const completed = attempt("last-eight-seconds", { activeSeconds: 8, completed: true });
  const html = renderPracticeHistory([completed], options());
  assert.match(html, /8 sec · Assignment total reached/);
  assert.doesNotMatch(html, /Requirements completed|0\.1 min/);
  for (const [extra, label] of [[{ review: true }, "Extra review"], [{ context: "class" }, "Class use"]]) {
    const separate = renderPracticeHistory([{ ...completed, ...extra }], options());
    assert.ok(separate.includes(label));
    assert.doesNotMatch(separate, /Assignment total reached/);
  }
  assert.match(renderPracticeHistory([{ ...completed, completed: false }], options()), /8 sec · Practice logged/);
  assert.match(renderPracticeHistory([{ ...completed, taskId: "sending" }], options()), /8 sec · Requirements completed/);
});
