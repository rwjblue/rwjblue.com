import assert from "node:assert/strict";
import test from "node:test";
import { practiceTimeSummary, timedPracticeDelta } from "../src/lib/cw-training/practice-time.ts";

const timer = (overrides = {}) => ({ running: true, visible: true, kind: "audio", recalling: false, audioPlaying: false, ...overrides });
const block = (overrides = {}) => ({ id: "active-block", startedAt: "2026-09-07T12:00:00Z", activeSeconds: 85.5, context: "practice", ...overrides });
const zeroDelta = { activeSeconds: 0, recallSeconds: 0, interrupted: false };

test("explicit audio recall counts as a portion of active practice time", () => {
  assert.deepEqual(timedPracticeDelta(1.25, timer({ recalling: true })), { activeSeconds: 1.25, recallSeconds: 1.25, interrupted: false });
  assert.deepEqual(timedPracticeDelta(1.25, timer()), zeroDelta);
  assert.deepEqual(timedPracticeDelta(0, timer({ recalling: true })), zeroDelta);
});

test("playing audio is never credited by the recall timer", () => {
  assert.deepEqual(timedPracticeDelta(1, timer({ audioPlaying: true })), zeroDelta);
  assert.deepEqual(timedPracticeDelta(1, timer({ audioPlaying: true, recalling: true })), zeroDelta);
});

test("running non-audio practice receives active time but never recall time", () => {
  for (const kind of ["sending", "icr", "simulator", "live", "review"]) {
    assert.deepEqual(timedPracticeDelta(0.75, timer({ kind })), { activeSeconds: 0.75, recallSeconds: 0, interrupted: false });
    assert.deepEqual(timedPracticeDelta(0.75, timer({ kind, recalling: true })), { activeSeconds: 0.75, recallSeconds: 0, interrupted: false });
  }
});

test("paused timers count neither ordinary breaks nor time spent away", () => {
  for (const elapsedSeconds of [1, 100, -1, NaN, Infinity]) {
    assert.deepEqual(timedPracticeDelta(elapsedSeconds, timer({ running: false, recalling: true })), zeroDelta);
    assert.deepEqual(timedPracticeDelta(elapsedSeconds, timer({ running: false, visible: false })), zeroDelta);
  }
});

test("hidden pages and delayed or invalid running ticks interrupt instead of catching up", () => {
  const interrupted = { activeSeconds: 0, recallSeconds: 0, interrupted: true };
  assert.deepEqual(timedPracticeDelta(1, timer({ visible: false, recalling: true })), interrupted);
  for (const elapsedSeconds of [4, 5, 3600, -0.1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(timedPracticeDelta(elapsedSeconds, timer({ recalling: true })), interrupted);
    assert.deepEqual(timedPracticeDelta(elapsedSeconds, timer({ kind: "sending" })), interrupted);
  }
  assert.deepEqual(timedPracticeDelta(3.999, timer({ recalling: true })), { activeSeconds: 3.999, recallSeconds: 3.999, interrupted: false });
});

test("today's active draft is added to saved practice without rounding", () => {
  assert.deepEqual(practiceTimeSummary(1200.25, block(), "2026-09-07", "America/New_York", new Set()), {
    savedSeconds: 1200.25, currentSeconds: 85.5, totalSeconds: 1285.75,
  });
  assert.deepEqual(practiceTimeSummary(1200, undefined, "2026-09-07", "America/New_York", new Set()), {
    savedSeconds: 1200, currentSeconds: 0, totalSeconds: 1200,
  });
});

test("saved block IDs prevent double counting while a draft is still present", () => {
  assert.deepEqual(practiceTimeSummary(85.5, block(), "2026-09-07", "America/New_York", new Set(["active-block"])), {
    savedSeconds: 85.5, currentSeconds: 0, totalSeconds: 85.5,
  });
});

test("class blocks and other course dates do not inflate today's practice", () => {
  for (const active of [block({ context: "class" }), block({ startedAt: "2026-09-06T12:00:00Z" }), block({ startedAt: "2026-09-08T12:00:00Z" })]) {
    assert.deepEqual(practiceTimeSummary(600, active, "2026-09-07", "America/New_York", new Set()), {
      savedSeconds: 600, currentSeconds: 0, totalSeconds: 600,
    });
  }
});

test("active drafts use the course time zone rather than UTC or the device date", () => {
  const active = block({ startedAt: "2026-09-08T02:00:00Z" });
  assert.equal(practiceTimeSummary(0, active, "2026-09-07", "America/New_York", new Set()).currentSeconds, 85.5);
  assert.equal(practiceTimeSummary(0, active, "2026-09-08", "America/New_York", new Set()).currentSeconds, 0);
  assert.equal(practiceTimeSummary(0, active, "2026-09-08", "Asia/Tokyo", new Set()).currentSeconds, 85.5);
  const winter = block({ startedAt: "2026-11-03T04:30:00Z" });
  assert.equal(practiceTimeSummary(0, winter, "2026-11-02", "America/New_York", new Set()).currentSeconds, 85.5);
});

test("malformed cached time values neither inflate totals nor throw", () => {
  for (const seconds of [-10, NaN, Infinity, -Infinity]) {
    assert.deepEqual(practiceTimeSummary(seconds, block({ activeSeconds: seconds }), "2026-09-07", "America/New_York", new Set()), {
      savedSeconds: 0, currentSeconds: 0, totalSeconds: 0,
    });
  }
  for (const [active, timeZone] of [[block({ startedAt: "not-a-date" }), "America/New_York"], [block(), "not-a-time-zone"]]) {
    assert.deepEqual(practiceTimeSummary(600, active, "2026-09-07", timeZone, new Set()), {
      savedSeconds: 600, currentSeconds: 0, totalSeconds: 600,
    });
  }
});
