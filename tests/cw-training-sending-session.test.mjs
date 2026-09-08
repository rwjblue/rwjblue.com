import assert from "node:assert/strict";
import test from "node:test";
import {
  SENDING_MAX_TAKE_MS, SENDING_MAX_TIMINGS, SENDING_MAX_TAKES,
  SENDING_MAX_TARGET_LENGTH, SENDING_MAX_SUMMARY_LENGTH,
  createSendingDraft, beginSendingTake, recordSendingEdge, stopSendingTake,
  discardSendingTake, setSendingTranscript, compareSendingText,
  restoreSendingDraft, restoreSendingTake, restoreSendingTakes,
  appendSendingTake, sendingSummary,
} from "../src/lib/cw-training/sending-session.ts";

const startedAt = "2026-09-08T14:00:00.000Z";
const begin = (options = {}, id = "sample-take") => beginSendingTake(createSendingDraft(options), { id, startedAt });
const edge = (draft, atMs, down) => recordSendingEdge(draft, { atMs, down });
const stopped = (options = {}, id = "sample-take") => {
  let draft = begin(options, id);
  draft = edge(draft, 0, true);
  draft = edge(draft, 60, false);
  return stopSendingTake(draft, { atMs: 1000 });
};

test("preparing optional capture does not begin a take or contain practice credit", () => {
  const draft = createSendingDraft();
  assert.deepEqual(draft, { input: "midi", wpm: 20, mode: "free", status: "ready" });
  assert.equal(recordSendingEdge(draft, { atMs: 500, down: true }), draft);
  assert.equal(stopSendingTake(draft, { atMs: 500 }), draft);
  assert.equal(sendingSummary([]), "");
  assert.ok(!("activeSeconds" in draft));
  assert.ok(!("completed" in draft));
});

test("settings stay bounded and capture requires a valid explicit start", () => {
  const draft = createSendingDraft({ input: "keyboard", wpm: 25, mode: "target", targetText: "CQ\0 " + "A".repeat(3000) });
  assert.equal(draft.targetText.length, SENDING_MAX_TARGET_LENGTH);
  assert.ok(!draft.targetText.includes("\0"));
  assert.equal(draft.wpm, 25);
  for (const wpm of [-1, 0, 4, 61, NaN, Infinity]) assert.equal(createSendingDraft({ wpm }).wpm, 20);
  assert.equal(createSendingDraft({ mode: "target", targetText: "   " }).mode, "free");
  for (const options of [{ id: "bad id", startedAt }, { id: "ok", startedAt: "yesterday" }]) {
    assert.equal(beginSendingTake(draft, options), draft);
  }
  const active = beginSendingTake(draft, { id: "valid-id", startedAt });
  assert.equal(active.status, "capturing");
  assert.equal(beginSendingTake(active, { id: "another", startedAt }), active, "starting again cannot replace a running take");
});

test("raw fractional mark/gap timings are preserved without initial waiting silence", () => {
  const original = begin();
  let active = edge(original, 100.125, true);
  active = edge(active, 160.375, false);
  active = edge(active, 281.125, true);
  active = edge(active, 461.25, false);
  assert.deepEqual(active.take.timings, [60.25, -120.75, 180.125]);
  assert.equal(active.take.elapsedMs, 461.25);
  assert.deepEqual(original.take.timings, [], "input snapshots are not mutated");
  assert.equal(active.take.decodedText, undefined, "capture does not implement decoding");
});

test("repeat, unsolicited key-up, invalid and out-of-order edges do not create symbols", () => {
  let active = begin();
  assert.equal(edge(active, 5, false), active);
  active = edge(active, 20, true);
  assert.equal(edge(active, 30, true), active, "keyboard auto-repeat leaves the actual onset intact");
  for (const atMs of [-1, 19, NaN, Infinity]) assert.equal(edge(active, atMs, false), active);
  active = edge(active, 80, false);
  assert.deepEqual(active.take.timings, [60]);
  assert.equal(edge(active, 80, true), active, "a zero-length gap is not a second consecutive mark");
  assert.equal(restoreSendingTake(active.take).status, "interrupted");
});

test("interruption drops an incomplete held mark rather than inventing a long dash", () => {
  for (const reason of ["paused", "disconnected", "hidden", "navigation", "reload", "input-error", "stopped"]) {
    let active = begin();
    active = edge(active, 0, true);
    active = edge(active, 60, false);
    active = edge(active, 120, true);
    const finished = stopSendingTake(active, { atMs: 2000, reason });
    assert.deepEqual(finished.take.timings, [60, -60]);
    assert.equal(finished.take.elapsedMs, 2000);
    assert.equal(finished.status, reason === "stopped" ? "stopped" : "interrupted");
    assert.equal(finished.edgeState, undefined);
    assert.equal(edge(finished, 2100, false), finished);
    assert.equal(stopSendingTake(finished, { atMs: 3000 }), finished);
  }
});

test("capture is bounded to ten minutes and a release beyond the limit cannot complete a mark", () => {
  let active = edge(begin(), SENDING_MAX_TAKE_MS - 60, true);
  const over = edge(active, SENDING_MAX_TAKE_MS + 1, false);
  assert.deepEqual(over.take.timings, []);
  assert.equal(over.take.elapsedMs, SENDING_MAX_TAKE_MS);
  assert.equal(over.take.reason, "duration-limit");
  const exact = edge(active, SENDING_MAX_TAKE_MS, false);
  assert.deepEqual(exact.take.timings, [60]);
  assert.equal(exact.take.reason, "duration-limit");
  assert.equal(exact.take.endedAt, "2026-09-08T14:10:00.000Z");
  assert.equal(stopSendingTake(begin(), { atMs: SENDING_MAX_TAKE_MS + 500 }).take.elapsedMs, SENDING_MAX_TAKE_MS);
});

test("event limit stops capture without exceeding the persisted timing bound", () => {
  let active = edge(begin(), 0, true);
  for (let index = 1; index <= SENDING_MAX_TIMINGS; index++) active = edge(active, index, index % 2 === 0);
  assert.equal(active.take.timings.length, SENDING_MAX_TIMINGS);
  assert.equal(active.take.reason, "event-limit");
  assert.equal(active.status, "interrupted");
  assert.equal(active.take.timings.at(-1), -1, "the held mark at the limit is absent");
  assert.equal(edge(active, SENDING_MAX_TIMINGS + 1, false), active);
  assert.equal(restoreSendingTake(active.take).timings.length, SENDING_MAX_TIMINGS);
});

test("external decoder results retain raw text and only compare normalized spaces and case", () => {
  const draft = stopped({ mode: "target", targetText: "CQ CQ DE N1RWJ K" });
  const matched = setSendingTranscript(draft, { decodedText: "  cq\nCQ de  n1rwj k ", decoder: { name: "example-decoder", version: "1.0" } });
  assert.equal(matched.take.comparison, "matches");
  assert.equal(matched.take.decodedText, "  cq\nCQ de  n1rwj k ");
  assert.equal(setSendingTranscript(draft, { decodedText: "CQ CQ DE N1RWU K" }).take.comparison, "possible-mismatch");
  assert.equal(setSendingTranscript(draft, { decodedText: "" }).take.comparison, "not-compared");
  assert.equal(setSendingTranscript(stopped(), { decodedText: "CQ" }).take.comparison, "not-compared");
  assert.equal(compareSendingText("A B", "AB"), "possible-mismatch", "character spacing is not silently removed");
  assert.equal(setSendingTranscript(draft, { decodedText: "A".repeat(4001) }), draft);
  assert.equal(setSendingTranscript(draft, { decodedText: "CQ\0" }), draft);
  assert.equal(setSendingTranscript(draft, { decodedText: "CQ", decoder: { name: "x".repeat(81), version: "1" } }), draft);
  assert.deepEqual(draft.take.timings, matched.take.timings);
});

test("discard returns ready settings and leaves practice fields and older copies untouched", () => {
  const active = stopped({ mode: "target", targetText: "TEST", input: "keyboard", wpm: 18 });
  const before = structuredClone(active);
  const discarded = discardSendingTake(active);
  assert.deepEqual(discarded, { status: "ready", mode: "target", targetText: "TEST", input: "keyboard", wpm: 18 });
  assert.deepEqual(active, before);
  assert.equal(sendingSummary(appendSendingTake([], discarded.take)), "");
});

test("restoration interrupts a running take at its checkpoint without adding offline time", () => {
  let active = edge(begin(), 0, true);
  active = edge(active, 60, false);
  active = edge(active, 120, true);
  const stored = JSON.parse(JSON.stringify({ ...active, activeSeconds: 999, edgeState: { down: true, lastEdgeMs: 99999999 } }));
  const restored = restoreSendingDraft(stored);
  assert.equal(restored.status, "interrupted");
  assert.equal(restored.take.reason, "reload");
  assert.equal(restored.take.endedAt, "2026-09-08T14:00:00.120Z");
  assert.equal(restored.take.elapsedMs, 120);
  assert.deepEqual(restored.take.timings, [60, -60]);
  assert.equal(restored.edgeState, undefined);
  assert.ok(!("activeSeconds" in restored));
  restored.take.timings.push(1);
  assert.deepEqual(stored.take.timings, [60, -60], "restored traces do not alias stored input");
  assert.deepEqual(restoreSendingDraft(createSendingDraft()), createSendingDraft());
});

test("valid finished captures survive restoration and derived comparison is not trusted", () => {
  const draft = setSendingTranscript(stopped({ mode: "target", targetText: "J" }), { decodedText: "U" });
  const restored = restoreSendingDraft(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(restored, draft);
  assert.equal(restoreSendingTake({ ...draft.take, comparison: "matches" }).comparison, "possible-mismatch");
  assert.equal(restoreSendingTake({ ...draft.take, unexpected: "ignored" }).unexpected, undefined);
});

test("malformed persisted takes are rejected with bounded work instead of guessed results", () => {
  const take = stopped().take;
  for (const invalid of [null, [], "capture", 2, undefined,
    { ...take, input: "microphone" }, { ...take, mode: "target" }, { ...take, targetText: "x".repeat(2001) },
    { ...take, wpm: 0 }, { ...take, id: "bad id" }, { ...take, startedAt: "bad" },
    { ...take, endedAt: "2026-09-07T14:00:00Z" }, { ...take, endedAt: undefined },
    { ...take, status: "ready" }, { ...take, status: "interrupted" }, { ...take, reason: "whatever" },
    { ...take, elapsedMs: Infinity }, { ...take, elapsedMs: -1 }, { ...take, elapsedMs: SENDING_MAX_TAKE_MS + 1 },
    { ...take, timings: [NaN] }, { ...take, timings: [0] }, { ...take, timings: [-10] },
    { ...take, timings: [60, 60] }, { ...take, timings: [60, -2000] },
    { ...take, timings: Array(SENDING_MAX_TIMINGS + 1).fill(1) },
    { ...take, decodedText: "\0" }, { ...take, decodedText: "X".repeat(4001) },
    { ...take, decoder: [] }, { ...take, decoder: { name: "test", version: "v".repeat(81) } },
  ]) assert.equal(restoreSendingTake(invalid), undefined);
  assert.equal(restoreSendingDraft({ ...stopped(), status: "capturing" }), undefined);
  assert.equal(restoreSendingDraft({ ...createSendingDraft(), take }), undefined);
  assert.equal(restoreSendingDraft(null), undefined);
  assert.deepEqual(restoreSendingTakes({ takes: [take] }), []);
});

test("kept local takes are capped, deduplicated by identity, and exclude empty or running takes", () => {
  let takes = [];
  for (let index = 0; index < 15; index++) takes = appendSendingTake(takes, stopped({}, `take-${index}`).take);
  assert.equal(takes.length, SENDING_MAX_TAKES);
  assert.equal(takes[0].id, "take-5");
  assert.equal(takes.at(-1).id, "take-14");
  const updated = { ...takes[0], decodedText: "CQ" };
  takes = appendSendingTake(takes, updated);
  assert.equal(takes.length, SENDING_MAX_TAKES);
  assert.equal(takes.at(-1).id, "take-5");
  assert.equal(takes.at(-1).decodedText, "CQ");
  assert.deepEqual(appendSendingTake(takes, begin().take), takes);
  assert.deepEqual(appendSendingTake(takes, stopSendingTake(begin(), { atMs: 1000 }).take), takes);
  const bounded = restoreSendingTakes(Array(100).fill(stopped().take));
  assert.equal(bounded.length, 1);
  assert.equal(restoreSendingTakes([begin().take]).length, 0);
});

test("summary is bounded, keeps possible mismatch language, and never adds capture to practice", () => {
  let takes = [];
  for (let index = 0; index < 10; index++) {
    const draft = setSendingTranscript(stopped({ mode: "target", targetText: "J ".repeat(1000) }, `take-${index}`), {
      decodedText: "U ".repeat(2000), decoder: { name: "A".repeat(80), version: "B".repeat(80) },
    });
    takes = appendSendingTake(takes, draft.take);
  }
  const summary = sendingSummary(takes);
  assert.ok(summary.length <= SENDING_MAX_SUMMARY_LENGTH);
  assert.match(summary, /10 takes, 10 seconds captured\. Capture does not add practice minutes\./);
  assert.match(summary, /Possible text mismatch; review by ear/);
  assert.match(summary, /more retained take\(s\) omitted/);
  assert.doesNotMatch(summary, /accuracy|score|grade/i);
  assert.equal(sendingSummary([stopSendingTake(begin(), { atMs: 1000 }).take]), "");
  assert.equal(sendingSummary([begin().take]), "");
});
