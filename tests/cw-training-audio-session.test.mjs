import assert from "node:assert/strict";
import test from "node:test";
import { audioRecordingNote, audioVariants } from "../src/lib/cw-training/audio-variants.ts";
import { audioAttemptResults, audioSessionNote, switchAudioRecording } from "../src/lib/cw-training/audio-session.ts";

const source = (overrides = {}) => ({
  id: "assigned-recording", title: "WD101-10", format: "audio",
  url: "https://cwa.cwops.org/wp-content/uploads/WD101_10.mp3", durationSeconds: 443.2, ...overrides,
});
const variant = speed => audioVariants(source()).find(item => item.speedWpm === speed);
const task = (overrides = {}) => ({
  id: "listen-original", kind: "audio", title: "WD101-10", instructions: "Synthetic listening instruction.",
  sourceUrl: "https://example.invalid/instructions", resourceId: "assigned-recording",
  speedWpm: 10, minimumPasses: 2, ...overrides,
});
const block = (overrides = {}) => ({
  id: "synthetic-block", assignmentId: "synthetic-day", task: task(), resource: source(),
  startedAt: "2026-09-08T14:00:00Z", targetMinutes: 15, activeSeconds: 120,
  recallSeconds: 20, scratchpad: "Remember this\nMultiline recall", completedPasses: 1,
  previousPasses: 2, targetPasses: 3, position: 100, coverage: [[0, 100]],
  bookmarks: [15, 65], context: "practice", ...overrides,
});

test("legacy and reloaded blocks retain the original recording note without inferred history", () => {
  const original = block();
  const reloaded = JSON.parse(JSON.stringify(original));
  assert.equal(reloaded.audioHistory, undefined);
  assert.equal(audioSessionNote(reloaded), audioRecordingNote(reloaded.task, reloaded.resource));
  assert.deepEqual(original, reloaded);
  assert.doesNotMatch(audioSessionNote(reloaded), /Difficult marks|Practice:/, "the client retains legacy bookmark handling");
  assert.equal(audioSessionNote(block({ task: task({ kind: "sending" }) })), "");
});

test("structured audio results preserve actual catalog speeds and precise usage across revisits", () => {
  let active = switchAudioRecording(block({ activeSeconds: 100.25, recallSeconds: 20, completedPasses: 1 }), variant(25));
  active = { ...active, activeSeconds: 150.75, completedPasses: 1 };
  active = switchAudioRecording(active, variant(10));
  active = { ...active, activeSeconds: 160.875, completedPasses: 2 };
  const before = structuredClone(active);
  assert.deepEqual(audioAttemptResults(active), [
    { url: variant(10).url, title: variant(10).title, speedWpm: 10, activeSeconds: 110.375, completedPasses: 2 },
    { url: variant(25).url, title: variant(25).title, speedWpm: 25, activeSeconds: 50.5, completedPasses: 0 },
  ]);
  assert.deepEqual(active, before);
  active = switchAudioRecording(active, variant(20));
  assert.equal(audioAttemptResults(active).length, 2, "an unplayed new selection is not a practiced recording");
  assert.equal(audioAttemptResults(active).reduce((total, usage) => total + usage.activeSeconds, 0), 160.875,
    "recall and repeated visits are not counted twice");
});

test("audio reporting does not infer speeds from assignment, title, or unknown recording URLs", () => {
  const known = block({ task: task({ speedWpm: 10 }), resource: { ...variant(25), title: "Incorrect title", speedWpm: 99 } });
  assert.equal(audioAttemptResults(known)[0].speedWpm, 25);
  assert.equal(audioAttemptResults(known)[0].title, "WD101-25");
  const unknown = block({ resource: source({ url: "https://example.invalid/WD101_25.mp3", title: "Custom audio 25 WPM", speedWpm: 25 }) });
  assert.deepEqual(audioAttemptResults(unknown), [{
    url: unknown.resource.url, title: unknown.resource.title, activeSeconds: 120, completedPasses: 1,
  }]);
  for (const overrides of [
    { task: task({ kind: "sending" }) }, { resource: undefined }, { resource: source({ format: "link" }) },
    { resource: source({ unresolved: "Missing recording" }) }, { activeSeconds: 0, completedPasses: 0 },
  ]) assert.equal(audioAttemptResults(block(overrides)), undefined);
});

test("switching archives prior usage and resets only the recording-local playback state", () => {
  const original = block();
  const before = structuredClone(original);
  const updated = switchAudioRecording(original, { ...variant(15), id: "untrusted-id", title: "wrong title", durationSeconds: 1 });
  assert.notEqual(updated, original);
  assert.deepEqual(updated.resource, variant(15), "the new snapshot comes from the verified catalog");
  assert.deepEqual(updated.audioHistory, [{
    resource: original.resource, activeSeconds: 120, recallSeconds: 20, completedPasses: 1, bookmarks: [15, 65],
  }]);
  assert.equal(updated.position, 0);
  assert.deepEqual(updated.coverage, []);
  assert.deepEqual(updated.bookmarks, []);
  for (const key of ["id", "assignmentId", "task", "startedAt", "targetMinutes", "activeSeconds", "recallSeconds",
    "completedPasses", "previousPasses", "targetPasses", "scratchpad", "context", "review"]) {
    assert.deepEqual(updated[key], original[key], `${key} is preserved`);
  }
  assert.deepEqual(original, before, "input counters, coverage, notes and resource remain untouched");
  updated.audioHistory[0].bookmarks.push(200);
  updated.audioHistory[0].resource.title = "Changed copy";
  assert.deepEqual(original, before, "archived nested objects do not alias the input");
  assert.equal(variant(15).title, "WD101-15", "catalog data is also isolated");
});

test("same-URL choices do nothing, preserving current coverage and absence of history", () => {
  const original = block();
  assert.equal(switchAudioRecording(original, variant(10)), original);
  assert.equal(original.audioHistory, undefined);
  assert.deepEqual(original.coverage, [[0, 100]]);
});

test("unsupported sources, non-audio, unknown speeds, other exercises and slower-than-assigned targets are rejected", () => {
  for (const original of [
    block({ task: task({ kind: "icr" }) }), block({ resource: undefined }),
    block({ resource: source({ format: "link" }) }), block({ resource: source({ unresolved: "Unavailable" }) }),
    block({ resource: source({ url: "https://example.invalid/WD101_10.mp3" }) }),
    block({ resource: source({ url: "https://cwa.cwops.org/wp-content/uploads/WD405_10.mp3" }) }),
    ...[undefined, 0, -1, NaN, Infinity].map(speedWpm => block({ task: task({ speedWpm }) })),
  ]) assert.equal(switchAudioRecording(original, variant(15)), original);
  const original = block();
  for (const target of [
    { ...variant(15), format: "text" }, { ...variant(15), unresolved: "Unavailable" },
    { ...variant(15), url: `${variant(15).url}?speed=15` },
    { ...variant(15), url: "https://cwa.cwops.org/wp-content/uploads/WD101_17.mp3" },
    { ...variant(15), url: "https://cwa.cwops.org/wp-content/uploads/PR101_15.mp3" },
    { ...variant(15), url: "https://example.invalid/WD101_15.mp3" },
  ]) assert.equal(switchAudioRecording(original, target), original);
  const assigned13 = block({ task: task({ speedWpm: 13 }), resource: variant(25) });
  assert.equal(switchAudioRecording(assigned13, variant(10)), assigned13);
  assert.equal(switchAudioRecording(assigned13, variant(13)).resource.url, variant(13).url, "returning to the prescribed speed is allowed");
});

test("partial coverage cannot cross recordings or produce a completed pass", () => {
  const partial = block({ activeSeconds: 220, recallSeconds: 20, completedPasses: 0, position: 200, coverage: [[0, 200]] });
  const updated = switchAudioRecording(partial, variant(25));
  assert.equal(updated.completedPasses, 0);
  assert.equal(updated.activeSeconds, 220);
  assert.equal(updated.recallSeconds, 20);
  assert.equal(updated.position, 0);
  assert.deepEqual(updated.coverage, []);
  assert.equal(updated.audioHistory[0].completedPasses, 0);
  const returned = switchAudioRecording(updated, variant(10));
  assert.equal(returned.completedPasses, 0);
  assert.deepEqual(returned.coverage, [], "switching back does not restore abandoned coverage");
});

test("switching back merges exact-URL usage while preserving cumulative passes, time and recall", () => {
  let active = switchAudioRecording(block({ activeSeconds: 100, recallSeconds: 20, completedPasses: 1 }), variant(15));
  active = { ...active, activeSeconds: 150, recallSeconds: 30, completedPasses: 2, bookmarks: [8], position: 40, coverage: [[0, 40]] };
  active = switchAudioRecording(active, variant(10));
  assert.deepEqual(active.audioHistory.map(({ resource, ...usage }) => ({ url: resource.url, ...usage })), [
    { url: variant(10).url, activeSeconds: 100, recallSeconds: 20, completedPasses: 1, bookmarks: [15, 65] },
    { url: variant(15).url, activeSeconds: 50, recallSeconds: 10, completedPasses: 1, bookmarks: [8] },
  ]);
  active = { ...active, activeSeconds: 160, recallSeconds: 35, completedPasses: 2, bookmarks: [0] };
  const note = audioSessionNote(active);
  assert.match(note, /WD101-10 \(10 WPM\); assigned 10 WPM/);
  assert.match(note, /Practice: 110 seconds \(includes 25 seconds recall\); 1 completed pass\. Difficult marks: 0:15, 1:05, 0:00/);
  assert.match(note, /WD101-15 \(15 WPM\); assigned 10 WPM/);
  assert.match(note, /Practice: 50 seconds \(includes 10 seconds recall\); 1 completed pass\. Difficult marks: 0:08/);
  assert.equal(note.split(variant(10).url).length - 1, 1);
  assert.equal(note.split(variant(15).url).length - 1, 1);
  assert.equal(active.audioHistory[0].activeSeconds, 100, "rendering a note never archives current usage");
  active = switchAudioRecording(active, variant(20));
  assert.equal(active.audioHistory.length, 2, "revisited URL merged instead of creating another segment");
  assert.equal(active.audioHistory[0].activeSeconds, 110);
  assert.equal(active.audioHistory[0].recallSeconds, 25);
  assert.deepEqual(active.audioHistory[0].bookmarks, [15, 65, 0]);
  assert.equal(active.activeSeconds, 160);
  assert.equal(active.recallSeconds, 35);
  assert.equal(active.completedPasses, 2);
  assert.equal(active.previousPasses, 2, "passes saved before this block are never counted in recording usage");
});

test("multiple complete passes retain their original identity through switches and JSON reload", () => {
  let active = switchAudioRecording(block({ completedPasses: 2, activeSeconds: 950, recallSeconds: 30 }), variant(20));
  active = { ...active, activeSeconds: 1450, recallSeconds: 50, completedPasses: 4, bookmarks: [4] };
  active = JSON.parse(JSON.stringify(active));
  const before = structuredClone(active);
  const note = audioSessionNote(active);
  assert.equal((note.match(/2 completed passes/g) ?? []).length, 2);
  assert.match(note, /Practice: 950 seconds \(includes 30 seconds recall\)/);
  assert.match(note, /Practice: 500 seconds \(includes 20 seconds recall\)/);
  assert.deepEqual(active, before);
  const updated = switchAudioRecording(active, variant(25));
  assert.equal(updated.completedPasses, 4);
  assert.equal(updated.task.id, "listen-original");
  assert.equal(updated.task.resourceId, "assigned-recording");
  assert.equal(updated.task.speedWpm, 10);
});

test("hundreds of switches remain six URL groups and compact speed-specific notes", () => {
  const variants = audioVariants(source());
  let active = block({ activeSeconds: 0, recallSeconds: 0, completedPasses: 0, bookmarks: [], position: 0, coverage: [] });
  for (let index = 0; index < 300; index++) {
    active = {
      ...active, activeSeconds: active.activeSeconds + 60.25, recallSeconds: active.recallSeconds + 5.25,
      completedPasses: active.completedPasses + 1, bookmarks: Array.from({ length: 20 }, (_, mark) => mark),
    };
    active = switchAudioRecording(active, variants[(index + 1) % variants.length]);
  }
  assert.equal(active.audioHistory.length, 6);
  assert.equal(new Set(active.audioHistory.map(usage => usage.resource.url)).size, 6);
  assert.equal(active.audioHistory.reduce((sum, usage) => sum + usage.activeSeconds, 0), 18075);
  assert.equal(active.audioHistory.reduce((sum, usage) => sum + usage.recallSeconds, 0), 1575);
  assert.equal(active.audioHistory.reduce((sum, usage) => sum + usage.completedPasses, 0), 300);
  const note = audioSessionNote(active);
  assert.ok(note.length < 3000, `automatic note is ${note.length} characters`);
  assert.equal(note.split("\n").length, 6);
  for (const recording of variants) {
    assert.equal(note.split(recording.url).length - 1, 1);
    assert.ok(note.includes(`${recording.speedWpm} WPM`));
  }
  assert.equal((note.match(/\(\+992 more\)/g) ?? []).length, 6);
  assert.equal((note.match(/Difficult marks: 0:00, 0:01, 0:02, 0:03, 0:04, 0:05, 0:06, 0:07/g) ?? []).length, 6);
  assert.equal(active.activeSeconds, 18075, "recall is included, not added a second time");
});

test("extra review stays separate without changing its assigned task or contextual fields", () => {
  const review = block({ review: true, context: "class", previousPasses: 0, targetPasses: 1 });
  const updated = switchAudioRecording(review, variant(18));
  assert.equal(updated.review, true);
  assert.equal(updated.context, "class");
  assert.equal(updated.task, review.task);
  assert.equal(updated.assignmentId, review.assignmentId);
  assert.equal(updated.targetPasses, 1);
  assert.equal(updated.scratchpad, review.scratchpad);
  assert.match(audioSessionNote(updated), /assigned 10 WPM/);
  assert.equal(review.audioHistory, undefined);
});

test("empty history and old blocks without recall still produce accurate non-double-counted notes", () => {
  const original = block({ recallSeconds: undefined, audioHistory: [], activeSeconds: 12.34, completedPasses: 0 });
  assert.match(audioSessionNote(original), /Practice: 12.3 seconds \(includes 0 seconds recall\); 0 completed passes/);
  const switched = switchAudioRecording(original, variant(13));
  assert.equal(switched.audioHistory[0].recallSeconds, 0);
  assert.equal(switched.recallSeconds, undefined, "switching does not add or rewrite cumulative fields");
  assert.match(audioSessionNote(switched), /Practice: 0 seconds \(includes 0 seconds recall\); 0 completed passes/);
});
