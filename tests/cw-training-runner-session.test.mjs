import assert from "node:assert/strict";
import test from "node:test";
import { createRunnerRun, reduceRunnerEvent, runnerMeetsAssignment, runnerResultNote, runnerSettings, RUNNER_CHANNEL, RUNNER_PROTOCOL_VERSION } from "../src/lib/cw-training/runner-bridge.ts";
import { restartRunnerBlock, runnerMetadata } from "../src/lib/cw-training/runner-session.ts";

const oldId = "11111111-1111-4111-8111-111111111111";
const newId = "22222222-2222-4222-8222-222222222222";
const thirdId = "33333333-3333-4333-8333-333333333333";
const nextStart = "2026-09-08T14:05:00.000Z";
const revision = "847e9089ef379a065d1cf6807c09f0724bbe072e";
const task = (overrides = {}) => ({
  id: "synthetic-runner-task", kind: "simulator", title: "Morse Runner practice",
  instructions: "Use Single Calls.", sourceUrl: "https://example.invalid/instructions",
  speedWpm: 13, minutes: 15, ...overrides,
});
const summary = (overrides = {}) => ({ qsoCount: 3, verifiedPoints: 2, score: 4, nrErrors: 1, nilErrors: 0, ...overrides });
const run = (overrides = {}) => ({
  ...createRunnerRun(oldId, runnerSettings(task())), status: "stopped", lastSequence: 10,
  elapsedSeconds: 75.9, summary: summary(), ...overrides,
});
const block = (overrides = {}) => ({
  id: oldId, assignmentId: "synthetic-day", task: task(),
  resource: { id: "runner", title: "Web Morse Runner", format: "link", url: "https://example.invalid/runner" },
  startedAt: "2026-09-08T14:00:00.000Z", targetMinutes: 15,
  activeSeconds: 99, recallSeconds: 0, completedPasses: 2, previousPasses: 3, targetPasses: 4,
  position: 10, coverage: [[0, 10]], bookmarks: [5], scratchpad: "Private recall\nOne more note",
  context: "practice", runner: run(), runnerRevision: "previous-revision", ...overrides,
});
const event = (state, type, sequence, elapsedSeconds = 0, extra = {}) => ({
  channel: RUNNER_CHANNEL, version: RUNNER_PROTOCOL_VERSION, runId: state.runId,
  type, sequence, elapsedSeconds, ...(type === "started" ? { settings: state.settings } : {}), ...extra,
});

test("shared runner metadata stays exactly compatible with the existing normal-finish note", () => {
  const active = block();
  assert.equal(runnerMetadata(active), `${runnerResultNote(active.runner)} Upstream previous-revision. Synthetic practice calls (not on-air contacts).`);
  assert.equal(runnerMetadata(block({ runner: undefined })), "");
  const loading = block({ runner: createRunnerRun(oldId, runnerSettings(task())), runnerRevision: undefined });
  assert.equal(runnerMetadata(loading), "Web Morse Runner: not started; no practice credited. Upstream revision not recorded. Synthetic practice calls (not on-air contacts).");
});

test("restart captures earned engine time once and prepares a separate zeroed run without mutating the old block", () => {
  const original = block();
  const before = structuredClone(original);
  const result = restartRunnerBlock(original, newId, nextStart, revision);
  assert.deepEqual(result.attempt, {
    id: oldId, assignmentId: original.assignmentId, taskId: original.task.id,
    startedAt: original.startedAt, endedAt: nextStart, activeSeconds: 75, completed: false,
    scratchpad: original.scratchpad, note: runnerMetadata(original), context: "practice",
  });
  assert.equal(result.active.id, newId);
  assert.equal(result.active.runner.runId, newId);
  assert.equal(result.active.startedAt, nextStart);
  assert.equal(result.active.assignmentId, original.assignmentId);
  assert.equal(result.active.task, original.task);
  assert.equal(result.active.resource, original.resource);
  assert.equal(result.active.targetMinutes, 15);
  for (const key of ["activeSeconds", "completedPasses", "previousPasses", "targetPasses", "position"]) assert.equal(result.active[key], 0, key);
  assert.deepEqual(result.active.coverage, []);
  assert.deepEqual(result.active.bookmarks, []);
  assert.equal(result.active.scratchpad, undefined);
  assert.equal(result.active.recallSeconds, undefined);
  assert.equal(result.active.runner.status, "loading");
  assert.equal(result.active.runner.elapsedSeconds, 0);
  assert.equal(result.active.runner.lastSequence, -1);
  assert.equal(result.active.runner.summary, undefined);
  assert.equal(result.active.runner.speedHistory, undefined);
  assert.equal(result.active.runnerRevision, revision);
  assert.deepEqual(original, before);
});

test("restart carries the latest WPM and chosen setup as independent fresh settings", () => {
  const settings = { ...runnerSettings(task()), mode: "WPX", activity: 4, durationSeconds: 300,
    conditions: { qrm: true, qrn: false, qsb: true, flutter: false, lids: true } };
  const original = block({ runner: run({ settings, speedHistory: [
    { elapsedSeconds: 0, wpm: 13 }, { elapsedSeconds: 10, wpm: 18 }, { elapsedSeconds: 40, wpm: 23 },
  ] }) });
  const result = restartRunnerBlock(original, newId, nextStart, revision);
  assert.deepEqual(result.active.runner.settings, { ...settings, wpm: 23 });
  assert.equal(result.active.targetMinutes, 5);
  assert.match(result.attempt.note, /13 WPM starting speed/);
  assert.match(result.attempt.note, /23 WPM at 0:40/);
  result.active.runner.settings.conditions.qrm = false;
  result.active.runner.settings.wpm = 30;
  assert.equal(original.runner.settings.conditions.qrm, true);
  assert.equal(original.runner.settings.wpm, 13);
});

test("partial and review runs preserve review/context while completed required work restarts as extra review", () => {
  for (const review of [undefined, false, true]) {
    const original = block({ review, context: "class" });
    const result = restartRunnerBlock(original, newId, nextStart, revision);
    assert.equal(result.attempt.review, review);
    assert.equal(result.active.review, review);
    assert.equal(result.attempt.context, "class");
    assert.equal(result.active.context, "class");
    assert.equal(result.attempt.completed, false);
  }
  const completed = block({ runner: run({ status: "completed", elapsedSeconds: 900 }) });
  const result = restartRunnerBlock(completed, newId, "2026-09-08T14:15:00.000Z", revision);
  assert.equal(result.attempt.completed, true);
  assert.equal(result.attempt.review, undefined, "only the completed old attempt can receive required credit");
  assert.equal(result.active.review, true);
  assert.equal(result.active.runner.status, "loading");
  const shortReview = block({ review: true, runner: run({ status: "completed", elapsedSeconds: 180,
    settings: { ...runnerSettings(task()), durationSeconds: 180 } }) });
  const reviewed = restartRunnerBlock(shortReview, newId, nextStart, revision);
  assert.equal(reviewed.attempt.completed, true);
  assert.equal(reviewed.attempt.review, true);
  assert.equal(reviewed.active.review, true);
});

test("a completed short or different-mode run cannot finish the original assignment during restart", () => {
  for (const settings of [
    { ...runnerSettings(task()), durationSeconds: 180 },
    { ...runnerSettings(task()), mode: "WPX" },
  ]) {
    const original = block({ runner: run({ status: "completed", elapsedSeconds: settings.durationSeconds, settings }) });
    const result = restartRunnerBlock(original, newId, "2026-09-08T14:20:00.000Z", revision);
    assert.equal(result.attempt.completed, false);
    assert.equal(result.active.review, undefined);
  }
});

test("stale events from the removed frame cannot change the fresh run or combine its time with partial practice", () => {
  const original = block();
  let fresh = restartRunnerBlock(original, newId, nextStart, revision).active.runner;
  for (const oldEvent of [
    event(original.runner, "ready", 0), event(original.runner, "started", 11),
    event(original.runner, "progress", 12, 150),
    event(original.runner, "results", 13, 900, { reason: "completed", summary: summary() }),
  ]) assert.equal(reduceRunnerEvent(fresh, oldEvent), fresh);
  fresh = reduceRunnerEvent(fresh, event(fresh, "ready", 0));
  fresh = reduceRunnerEvent(fresh, event(fresh, "started", 1));
  fresh = reduceRunnerEvent(fresh, event(fresh, "results", 2, 825, { reason: "completed", summary: summary() }));
  assert.equal(fresh.status, "stopped");
  assert.equal(runnerMeetsAssignment(fresh, original.task), false, "75 old seconds plus 825 new seconds is not one full run");
});

test("multiple restarts use distinct saved IDs and per-run time instead of duplicating cumulative totals", () => {
  const first = restartRunnerBlock(block(), newId, nextStart, revision);
  let nextRun = first.active.runner;
  nextRun = reduceRunnerEvent(nextRun, event(nextRun, "ready", 0));
  nextRun = reduceRunnerEvent(nextRun, event(nextRun, "started", 1));
  nextRun = reduceRunnerEvent(nextRun, event(nextRun, "results", 2, 30.75, { reason: "stopped", summary: summary() }));
  const second = restartRunnerBlock({ ...first.active, activeSeconds: 30.75, runner: nextRun }, thirdId, "2026-09-08T14:06:00.000Z", revision);
  assert.deepEqual([first.attempt.id, second.attempt.id, second.active.id], [oldId, newId, thirdId]);
  assert.deepEqual([first.attempt.activeSeconds, second.attempt.activeSeconds, second.active.activeSeconds], [75, 30, 0]);
  assert.equal(second.attempt.startedAt, first.active.startedAt);
  assert.equal(second.active.runner.elapsedSeconds, 0);
  assert.equal(second.active.runner.summary, undefined);
  let completed = second.active.runner;
  completed = reduceRunnerEvent(completed, event(completed, "ready", 0));
  completed = reduceRunnerEvent(completed, event(completed, "started", 1));
  completed = reduceRunnerEvent(completed, event(completed, "results", 2, 900, { reason: "completed", summary: summary() }));
  assert.equal(runnerMeetsAssignment(completed, second.active.task), true, "a fresh run must earn its own whole duration");
});

test("restarting a previous-day block retains its practice date and gives the new block today's date", () => {
  const original = block({ startedAt: "2026-09-07T23:00:00.000Z" });
  const result = restartRunnerBlock(original, newId, nextStart, revision);
  assert.equal(result.attempt.startedAt, original.startedAt);
  assert.equal(result.attempt.endedAt, nextStart);
  assert.equal(result.active.startedAt, nextStart);
  const shortWallTime = block({ startedAt: "2026-09-08T14:04:59.000Z" });
  const corrected = restartRunnerBlock(shortWallTime, newId, nextStart, revision);
  assert.equal(corrected.attempt.startedAt, "2026-09-08T14:03:45.000Z", "same elapsed-wall-time correction as normal Finish");
});

test("zero-time setup resets avoid empty history but retain earned contacts and nonempty scratchpads", () => {
  for (const elapsedSeconds of [0, 0.9]) {
    const setup = block({ runner: run({ status: "error", errorCode: "configuration", elapsedSeconds, summary: undefined }), scratchpad: " \n " });
    const result = restartRunnerBlock(setup, newId, nextStart, revision);
    assert.equal(result.attempt, undefined);
    assert.equal(result.active.runner.status, "loading");
  }
  const contact = block({ runner: run({ elapsedSeconds: 0.9 }), scratchpad: undefined });
  assert.equal(restartRunnerBlock(contact, newId, nextStart, revision).attempt.activeSeconds, 0);
  const notes = block({ runner: run({ elapsedSeconds: 0, summary: undefined }), scratchpad: "Do not lose this note." });
  assert.equal(restartRunnerBlock(notes, newId, nextStart, revision).attempt.scratchpad, notes.scratchpad);
});

test("non-runner and nonterminal blocks cannot restart or prematurely save an active engine", () => {
  for (const original of [
    block({ runner: undefined }), block({ task: task({ kind: "audio" }) }),
    ...["loading", "ready", "running"].map(status => block({ runner: run({ status }) })),
  ]) assert.equal(restartRunnerBlock(original, newId, nextStart, revision), undefined);
});

test("invalid identity, dates, timing, notes or settings fail explicitly without discarding the old run", () => {
  const original = block();
  const before = structuredClone(original);
  for (const id of [oldId, oldId.toUpperCase(), "not-a-uuid", "", original.runner.runId]) {
    assert.throws(() => restartRunnerBlock(original, id, nextStart, revision), /fresh practice ID/);
  }
  const differentRun = block({ runner: run({ runId: newId }) });
  assert.throws(() => restartRunnerBlock(differentRun, newId, nextStart, revision), /fresh practice ID/);
  assert.throws(() => restartRunnerBlock(original, newId, "not-a-date", revision), /invalid practice date/);
  assert.throws(() => restartRunnerBlock(block({ startedAt: "not-a-date" }), newId, nextStart, revision), /invalid practice date/);
  for (const elapsedSeconds of [-1, NaN, Infinity, 6001]) {
    assert.throws(() => restartRunnerBlock(block({ runner: run({ elapsedSeconds }) }), newId, nextStart, revision), /invalid timing or settings/);
  }
  for (const scratchpad of ["x".repeat(10001), "contains\0null"]) {
    assert.throws(() => restartRunnerBlock(block({ scratchpad }), newId, nextStart, revision), /scratchpad/);
  }
  for (const runnerRevision of ["x".repeat(4000), "contains\0null"]) {
    assert.throws(() => restartRunnerBlock(block({ runnerRevision }), newId, nextStart, revision), /automatic details/);
  }
  const badSettings = block({ runner: run({ settings: { ...runnerSettings(task()), durationSeconds: 0 } }) });
  assert.throws(() => restartRunnerBlock(badSettings, newId, nextStart, revision), /invalid timing or settings/);
  for (const currentRevision of ["", "contains\0null", "x".repeat(201)]) {
    assert.throws(() => restartRunnerBlock(original, newId, nextStart, currentRevision), /version is invalid/);
  }
  assert.deepEqual(original, before);
});
