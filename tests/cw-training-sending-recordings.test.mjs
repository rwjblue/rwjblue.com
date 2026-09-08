import assert from "node:assert/strict";
import test from "node:test";
import {
  removeSavedSendingRecording, restoreSavedSendingRecordings, saveSendingRecordings,
} from "../src/lib/cw-training/sending-recordings.ts";

const attemptId = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const take = (index = 1, overrides = {}) => ({
  id: `take-${index}`, startedAt: new Date(Date.UTC(2026, 8, 8, 14, index)).toISOString(),
  endedAt: new Date(Date.UTC(2026, 8, 8, 14, index, 1)).toISOString(),
  input: "midi", wpm: 20, mode: "free", status: "stopped", reason: "stopped",
  timings: [60, -60, 180], elapsedMs: 1000, decodedText: "A", comparison: "not-compared", ...overrides,
});
const recording = (index = 1, overrides = {}) => ({ attemptId: attemptId(index), take: take(index), ...overrides });

test("saving retains the newest ten across attempts in chronological order regardless of input order", () => {
  const entries = Array.from({ length: 15 }, (_, index) => recording(index + 1));
  const restored = restoreSavedSendingRecordings([...entries].reverse());
  assert.deepEqual(restored.map(item => item.take.id), entries.slice(5).map(item => item.take.id));
  const updated = saveSendingRecordings(restored, attemptId(16), [take(17), take(16)]);
  assert.equal(updated.length, 10);
  assert.deepEqual(updated.map(item => item.take.id), Array.from({ length: 10 }, (_, index) => `take-${index + 8}`));
  assert.deepEqual(updated.slice(-2).map(item => item.attemptId), [attemptId(16), attemptId(16)]);
  assert.equal(entries.length, 15, "retention never mutates supplied records");
});

test("latest-ten retention happens after validation, so trailing malformed records do not evict valid replay", () => {
  const valid = Array.from({ length: 10 }, (_, index) => recording(index + 1));
  const restored = restoreSavedSendingRecordings([...valid, ...Array(100).fill({ take: "bad" })]);
  assert.deepEqual(restored, valid);
});

test("duplicate attempt/take pairs update rather than consuming slots, and other attempts remain distinct", () => {
  const initial = recording();
  const corrected = { ...initial, take: { ...initial.take, decodedText: "ET" } };
  const otherAttempt = { attemptId: attemptId(2), take: initial.take };
  const result = restoreSavedSendingRecordings([initial, otherAttempt, corrected]);
  assert.equal(result.length, 2);
  assert.equal(result.find(item => item.attemptId === initial.attemptId).take.decodedText, "ET");
  assert.equal(result.find(item => item.attemptId === attemptId(2)).take.decodedText, "A");
  const updated = saveSendingRecordings(result, initial.attemptId, [take(1, { decodedText: "N" }), take(3)]);
  assert.equal(updated.length, 3);
  assert.equal(updated.find(item => item.attemptId === initial.attemptId && item.take.id === "take-1").take.decodedText, "N");
});

test("capturing and empty takes are excluded instead of being silently promoted to retained recordings", () => {
  const active = recording(1, { take: take(1, { status: "capturing", reason: undefined, endedAt: undefined }) });
  const empty = recording(2, { take: take(2, { timings: [] }) });
  const interrupted = recording(3, { take: take(3, { status: "interrupted", reason: "disconnected" }) });
  assert.deepEqual(restoreSavedSendingRecordings([active, empty, interrupted]), [interrupted]);
  assert.deepEqual(saveSendingRecordings([], attemptId(1), [active.take, empty.take]), []);
});

test("malformed wrapper IDs and take payloads are rejected through the existing strict take validator", () => {
  for (const invalid of [undefined, null, 1, "[]", {}, { recordings: [recording()] }]) {
    assert.deepEqual(restoreSavedSendingRecordings(invalid), []);
  }
  const invalidIds = [undefined, null, 1, "", "take-1", "../private", "x".repeat(100), "00000000000040008000000000000001", `${attemptId(1)}\0`, `${attemptId(1)} `];
  const invalidTakes = [undefined, null, [], {}, take(1, { timings: [-60] }), take(1, { elapsedMs: Infinity }),
    take(1, { status: "stopped", reason: "disconnected" }), take(1, { wpm: 0 }), take(1, { startedAt: "not-a-date" })];
  assert.deepEqual(restoreSavedSendingRecordings([
    ...invalidIds.map(id => recording(1, { attemptId: id })),
    ...invalidTakes.map(value => recording(1, { take: value })),
  ]), []);
  const valid = [recording()];
  assert.deepEqual(saveSendingRecordings(valid, "invalid", [take(2)]), valid);
  assert.deepEqual(saveSendingRecordings(valid, attemptId(2), null), valid);
});

test("restored recordings are independent validated snapshots without unknown fields or forged comparison", () => {
  const original = recording(1, { extra: "ignored", take: take(1, {
    mode: "target", targetText: "N", decodedText: "A", comparison: "matches",
    decoder: { name: "morse-pro", version: "3.0.0", token: "ignored" }, secret: "ignored",
  }) });
  const before = structuredClone(original);
  const restored = restoreSavedSendingRecordings([original])[0];
  assert.equal(restored.extra, undefined);
  assert.equal(restored.take.secret, undefined);
  assert.equal(restored.take.decoder.token, undefined);
  assert.equal(restored.take.comparison, "possible-mismatch");
  restored.take.timings.push(-100);
  restored.take.decoder.version = "changed";
  assert.deepEqual(original, before);
});

test("a malformed duplicate cannot erase an existing valid recording", () => {
  const valid = recording();
  const invalid = { ...valid, take: { ...valid.take, timings: [NaN] } };
  assert.deepEqual(restoreSavedSendingRecordings([valid, invalid]), [valid]);
});

test("adding an older take does not replace newer retained recordings", () => {
  const latest = Array.from({ length: 10 }, (_, index) => recording(index + 2));
  assert.deepEqual(saveSendingRecordings(latest, attemptId(1), [take(1)]), latest);
});

test("removing one local recording leaves the same take ID on other attempts and all other traces intact", () => {
  const first = recording();
  const second = { attemptId: attemptId(2), take: take(1) };
  const third = { attemptId: first.attemptId, take: take(3) };
  const existing = [first, second, third];
  assert.deepEqual(removeSavedSendingRecording(existing, first.attemptId, first.take.id), [second, third]);
  assert.deepEqual(removeSavedSendingRecording(existing, first.attemptId, "missing"), existing);
  assert.equal(existing.length, 3);
});
