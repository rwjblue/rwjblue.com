import assert from "node:assert/strict";
import test from "node:test";
import { listeningGuidance } from "../src/lib/cw-training/guidance.ts";

const task = (title, extra = {}) => ({
  id: "synthetic-audio", kind: "audio", title,
  instructions: "Follow this synthetic exercise's objective.",
  sourceUrl: "https://example.invalid/synthetic-exercise", ...extra,
});

test("word and phrase guidance favors mental recognition with optional recall notes", () => {
  const words = listeningGuidance(task("WD987-14"));
  assert.equal(words.title, "Whole words");
  assert.match(words.approach, /word.*sound.*mind/);
  assert.match(words.scratchpadPrompt, /^Optional:/);
  const phrases = listeningGuidance(task("PR876-17"));
  assert.equal(phrases.title, "Phrase meaning");
  assert.match(phrases.approach, /meaning.*head/);
  assert.match(phrases.scratchpadPrompt, /^Optional:/);
});

test("all supported prefix and suffix recordings emphasize word recognition", () => {
  for (const family of ["DIS", "IM", "IN", "IR", "RE", "UN", "ED", "ES", "ING", "LY"]) {
    const result = listeningGuidance(task(`${family}9-17`));
    assert.equal(result.title, "Word beginnings and endings", family);
    assert.match(result.approach, /complete word by sound/);
    assert.match(result.scratchpadPrompt, /^Optional:/);
  }
});

test("QSO, POTA, and CWT guidance distinguish the exchange details", () => {
  const qso = listeningGuidance(task("QSO765-17"));
  assert.match(qso.approach, /callsign, name, and location \(QTH\)/);
  const pota = listeningGuidance(task("POTA654-17"));
  assert.match(pota.approach, /both callsigns.*any park reference/);
  assert.doesNotMatch(pota.approach, /must|required/);
  const cwt = listeningGuidance(task("CWT543-17"));
  assert.match(cwt.approach, /callsign.*name.*number/);
  for (const result of [qso, pota, cwt]) assert.match(result.scratchpadPrompt, /^Optional:/);
});

test("story practice asks for recognizable words rather than a transcript", () => {
  const story = listeningGuidance(task("SS432-17"));
  assert.match(story.approach, /recognizable words/);
  assert.match(story.approach, /complete transcript is not the goal/);
  assert.match(story.scratchpadPrompt, /^Optional:.*words or fragments/);
});

test("resource codes tolerate actual separator variants and renamed task titles", () => {
  const expected = listeningGuidance(task("QSO765-17"));
  for (const code of ["qso765_17", "QSO 765–17", "QSO 765 — 17"]) {
    assert.deepEqual(listeningGuidance(task(code)), expected);
    assert.deepEqual(listeningGuidance(task("Renamed recording", { instructions: `Use ${code} for this synthetic listening exercise.` })), expected);
  }
  const titleWins = listeningGuidance(task("WD987-14", { instructions: "Compare this synthetic exercise with PR876-17 later." }));
  assert.equal(titleWins.title, "Whole words");
});

test("plain story and affix descriptions work without invented file names", () => {
  assert.equal(listeningGuidance(task("Short story practice")).title, "Words within a story");
  assert.equal(listeningGuidance(task("Renamed recording", { instructions: "Listen to a short story for this synthetic exercise." })).title, "Words within a story");
  assert.equal(listeningGuidance(task("Suffix recognition")).title, "Word beginnings and endings");
  assert.equal(listeningGuidance(task("Renamed recording", { instructions: "Listen to synthetic prefixes." })).title, "Word beginnings and endings");
});

test("unknown recordings defer to original instructions without invented completion rules", () => {
  const unknown = task("ZZ321-17", { instructions: "The instructor supplies a different listening objective here.", minimumPasses: 9, maximumPasses: 12, minutes: 23 });
  const original = structuredClone(unknown);
  const result = listeningGuidance(unknown);
  assert.equal(result.title, "Listening objective");
  assert.match(result.approach, /original objective.*instructor directs otherwise/);
  assert.match(result.scratchpadPrompt, /^Optional:/);
  assert.deepEqual(Object.keys(result).sort(), ["approach", "scratchpadPrompt", "title"]);
  assert.doesNotMatch(JSON.stringify(result), /9|12|23|uninterrupted|required passes|never write/);
  assert.deepEqual(unknown, original);
  result.title = "Caller changed its own copy";
  assert.equal(listeningGuidance(unknown).title, "Listening objective");
});

test("sending, typing trainers, live radio, and review instructions are not audio guidance", () => {
  for (const kind of ["sending", "icr", "simulator", "live", "review"]) {
    assert.equal(listeningGuidance(task("QSO765-17", { kind })), undefined);
  }
});
