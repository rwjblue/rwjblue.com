import assert from "node:assert/strict";
import test from "node:test";
import { lcwoBlockMinutes, lcwoPracticeMinutes } from "../src/lib/cw-training/lcwo-practice.ts";
import { getTrainingPlan } from "../src/lib/cw-training/plan.ts";
import { buildReportDraft } from "../src/lib/cw-training/report.ts";

const course = { timezone: "America/New_York", dailyGoalMinutes: 60, resources: [], meetings: [],
  assignments: [{ id: "day", date: "2026-09-19", session: 1, day: 1, dueAt: "2026-09-20T23:00:00Z",
    tasks: [{ id: "icr", kind: "icr", title: "ICR", minutes: 15, instructions: "Practice" }] }] };
const run = (id, extra = {}) => ({ id, kind: "letters", sourceType: "groups", sourceResultId: id,
  sourceUserId: "123", recordedAt: "2026-09-19T14:00:00Z", sourceTime: "2026-09-19 14:00:00", ...extra });
const block = (extra = {}) => ({ id: "manual", assignmentId: "day", taskId: "icr", context: "practice",
  startedAt: "2026-09-19T13:45:00Z", endedAt: "2026-09-19T14:00:00Z", activeSeconds: 900, completed: false, ...extra });
const report = (runs, attempts = []) => buildReportDraft(course, attempts, {
  session: 1, reportDate: "2026-09-19", fromDate: "2026-09-19", toDate: "2026-09-19", lcwoRuns: runs,
});

test("Finish suggests minutes only for uncovered group runs completed during the block", () => {
  const imports = [run("before", { recordedAt: "2026-09-19T13:59:00Z" }),
    run("start"), run("inside", { recordedAt: "2026-09-19T14:01:00Z" }),
    run("inside", { recordedAt: "2026-09-19T14:01:00Z" }),
    run("finish", { recordedAt: "2026-09-19T14:15:00Z" }),
    run("after", { recordedAt: "2026-09-19T14:16:00Z" }),
    run("words", { kind: "words", sourceType: "words", recordedAt: "2026-09-19T14:02:00Z" })];
  const start = "2026-09-19T14:00:00Z";
  const finish = "2026-09-19T14:15:00Z";
  assert.equal(lcwoBlockMinutes(course, [], imports, start, finish), 2);
  assert.equal(lcwoBlockMinutes(course, [block({ endedAt: "2026-09-19T14:05:00Z" })], imports, start, finish), 1);
  assert.equal(lcwoBlockMinutes(course, [], imports, finish, start), 0);
  assert.equal(lcwoBlockMinutes(course, [], imports, "invalid", finish), 0);
});

test("one estimated minute per unique code-group run, regardless of speed or accuracy", () => {
  const imports = [run("letters"), run("letters"), run("figures", { kind: "figures", effectiveWpm: 20 }),
    run("custom", { kind: "custom", accuracyPercent: 0 }), run("word", { kind: "words", sourceType: "words" }),
    run("call", { kind: "callsign", sourceType: "callsigns" }), run("koch", { kind: "koch", sourceType: "koch" }),
    run("bad-date", { recordedAt: "invalid" })];
  const before = structuredClone(imports);
  const minutes = lcwoPracticeMinutes(course, [], imports);
  assert.equal(minutes.estimatedMinutes, 3);
  assert.equal(minutes.additionalMinutes, 3);
  assert.deepEqual(minutes.runs.map(run => run.id), ["letters", "figures", "custom"]);
  assert.deepEqual(lcwoPracticeMinutes(course, [], [...imports, ...imports]), minutes);
  assert.deepEqual(imports, before);
});

test("saved ICR intervals cover imports once and corrections recalculate coverage", () => {
  const imports = [run("inside"), run("later", { recordedAt: "2026-09-19T14:10:00Z" })];
  for (const attempt of [block(), block({ taskId: "other:icr", review: true }),
    block({ taskId: "old-task", lcwoResult: { kind: "letters" } })]) {
    const minutes = lcwoPracticeMinutes(course, [attempt, attempt], imports);
    assert.equal(minutes.alreadyLoggedMinutes, 1);
    assert.equal(minutes.additionalMinutes, 1);
  }
  const corrected = lcwoPracticeMinutes(course, [block(), block({ endedAt: "2026-09-19T13:59:00Z" })], imports);
  assert.equal(corrected.additionalMinutes, 2);
  for (const attempt of [block({ context: "class" }), block({ activeSeconds: 0 }),
    block({ taskId: "other:general" }), block({ taskId: "old-task", lcwoResult: { kind: "words" } })]) {
    assert.equal(lcwoPracticeMinutes(course, [attempt], imports).additionalMinutes, 2);
  }
  assert.equal(lcwoPracticeMinutes(course, [block({ lcwoResult: { kind: "letters" } })],
    [run("letters"), run("figures", { kind: "figures" })]).additionalMinutes, 0,
  "one recorded result does not limit the time covered by a mixed ICR block");
});

test("fifteen imports add fifteen daily minutes without creating entries or completing assignments", () => {
  const imports = Array.from({ length: 15 }, (_, index) => run(String(index)));
  const attempts = [];
  const now = new Date("2026-09-19T18:00:00Z");
  const plan = getTrainingPlan(course, attempts, now, null, "anything", [], imports);
  assert.equal(plan.practicedMinutes, 15);
  assert.equal(plan.estimatedLcwoMinutes, 15);
  assert.ok(plan.queue.some(item => item.task.id === "icr"));
  assert.deepEqual(attempts, []);
  const logged = getTrainingPlan(course, [block()], now, null, "anything", [], imports);
  assert.equal(logged.practicedMinutes, 15);
  assert.equal(logged.estimatedLcwoMinutes, 0);
});

test("report and daily estimates use local completion dates and recognize blocks crossing midnight", () => {
  const imports = [run("before", { recordedAt: "2026-09-19T03:59:59Z" }),
    run("first", { recordedAt: "2026-09-19T04:00:00Z" }),
    run("last", { recordedAt: "2026-09-20T03:59:59Z" }),
    run("after", { recordedAt: "2026-09-20T04:00:00Z" })];
  const attempt = block({ startedAt: "2026-09-19T03:50:00Z", endedAt: "2026-09-19T04:05:00Z" });
  const result = report(imports, [attempt]);
  assert.equal(result.lcwoPractice.estimatedMinutes, 2);
  assert.equal(result.lcwoPractice.alreadyLoggedMinutes, 1);
  assert.equal(result.lcwoPractice.additionalMinutes, 1);
  assert.deepEqual(new Set(result.sourceLcwoIds), new Set(["first", "last"]));
  const plan = getTrainingPlan(course, [attempt], new Date("2026-09-19T18:00:00Z"), null, "anything", [], imports);
  assert.equal(plan.estimatedLcwoMinutes, 1);
  assert.equal(plan.practicedMinutes, 1, "manual blocks retain their existing start-date accounting");
});
