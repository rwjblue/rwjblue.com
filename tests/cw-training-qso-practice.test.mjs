import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_QSOS, practiceQso, newPracticeQso, createQsoPracticeBlock, qsoPracticeAttempt, recordQsoSettings } from "../src/lib/cw-training/qso-practice.ts";
import { createQsoRound, qsoPosition } from "../src/lib/cw-training/qso-round.ts";
import { renderWordSamples } from "../src/lib/cw-training/word-round.ts";
import { sendingTextTimings } from "../src/lib/cw-training/sending-engine.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test("every full exchange and story has exact Morse timing and a bounded timeline at both speed limits", () => {
  assert.equal(new Set(PRACTICE_QSOS.map(item => item.id)).size, PRACTICE_QSOS.length);
  assert.equal(PRACTICE_QSOS.filter(item => item.kind === "qso").length, 4);
  for (const selection of PRACTICE_QSOS) for (const wpm of [10, 40]) {
    const item = practiceQso({ qsoId: selection.id }, () => 0.5);
    const round = createQsoRound(item, wpm);
    near(round.duration, round.timings.reduce((sum, ms) => sum + Math.abs(ms), 0) / 1000);
    assert.equal(round.pitches.length, round.timings.length);
    assert.equal(round.lines.length, item.lines.length);
    assert.equal(round.words.length, round.starts.length);
    assert.ok(round.duration < 1200);
    for (const [i, line] of round.lines.entries()) {
      const expected = sendingTextTimings(item.lines[i], wpm).reduce((sum, ms) => sum + Math.abs(ms), 0) / 1000;
      near(line.end - line.start, expected);
      assert.equal(line.pitch, item.kind === "story" || i % 2 === 0 ? 450 : 500);
      if (i) near(line.start - round.lines[i - 1].end, 2);
      const first = round.timingStarts[line.firstWord];
      const last = round.timingStarts[round.lines[i + 1]?.firstWord] ?? round.timings.length;
      assert.ok(round.pitches.slice(first, last).every(pitch => pitch === line.pitch));
    }
    near(round.lines.at(-1).end, round.duration);
  }
  const lengths = PRACTICE_QSOS.filter(item => item.kind === "story").map(item => createQsoRound(item, 20).duration);
  assert.ok(lengths[0] < lengths[1] && lengths[1] < lengths[2]);
});

test("display follows words and transmissions on forward and backward seeks without highlighting silence", () => {
  const round = createQsoRound(practiceQso({ qsoId: PRACTICE_QSOS[0].id }, () => 0.5), 20);
  assert.deepEqual(qsoPosition(round, 0), { line: 0, word: 0 });
  assert.deepEqual(qsoPosition(round, round.starts[1] + .001), { line: 0, word: 1 });
  assert.equal(qsoPosition(round, round.wordEnds[0] + .001).word, -1);
  assert.deepEqual(qsoPosition(round, round.lines[0].end + 1), { line: 0, word: -1 });
  assert.deepEqual(qsoPosition(round, round.lines[1].start), { line: 1, word: round.lines[1].firstWord });
  assert.deepEqual(qsoPosition(round, round.duration), { line: round.lines.length - 1, word: -1 });
  assert.deepEqual(qsoPosition(round, .01), { line: 0, word: 0 });
});

test("the rendered signal uses 450 and 500 Hz with silent handoffs and smooth envelopes", () => {
  const item = { id: "test", title: "Test", stations: ["A", "B"], lines: ["T", "T"] };
  const round = createQsoRound(item, 20);
  const rate = 22050;
  const samples = renderWordSamples(round, 700, rate);
  for (const [index, line] of round.lines.entries()) {
    const start = Math.round(line.start * rate);
    const tone = index ? 500 : 450;
    for (const offset of [300, 400, 500]) near(samples[start + offset], .65 * Math.sin(2 * Math.PI * tone * offset / rate));
    near(samples[start], 0);
  }
  assert.ok(samples.slice(Math.ceil(round.lines[0].end * rate), Math.floor(round.lines[1].start * rate)).every(value => value === 0));
});

test("listening saves real seconds as optional general practice, with selections and no QSO count", () => {
  const block = createQsoPracticeBlock("2026-09-25T12:00:00Z", "listening");
  assert.equal(qsoPracticeAttempt(block, "2026-09-25T12:00:30Z"), undefined);
  recordQsoSettings(block.qsoPractice);
  recordQsoSettings(block.qsoPractice);
  block.qsoPractice.qsoId = "story-trail";
  recordQsoSettings(block.qsoPractice);
  assert.equal(block.qsoPractice.used.length, 2);
  block.activeSeconds = 27.8;
  const attempt = qsoPracticeAttempt(block, "2026-09-25T12:01:00Z");
  assert.equal(attempt.activeSeconds, 27);
  assert.equal(attempt.completed, false);
  assert.equal(attempt.review, true);
  assert.equal(attempt.taskId, "other:general");
  assert.equal(attempt.qsoCount, undefined);
  assert.match(attempt.note, /A first contact.*20 WPM/);
  assert.match(attempt.note, /The trail marker.*narrator 450 Hz/);
  const next = createQsoPracticeBlock("2026-09-25T13:00:00Z", "next", block.qsoPractice);
  assert.equal(next.qsoPractice.qsoId, "story-trail");
  assert.deepEqual(next.qsoPractice.used, []);
  assert.equal(block.qsoPractice.used.length, 2);
  for (const speed of [0, NaN, Infinity, 9, 41]) assert.throws(() => createQsoRound(practiceQso({ qsoId: PRACTICE_QSOS[0].id }, () => 0.5), speed));
});

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const { generateQso, QSO_TEMPLATES, QSO_CALLSIGNS, QSO_RADIOS } = await import("../src/lib/cw-training/qso-generator.ts");

test("generated contacts vary, keep stations distinct, and pair each radio with supported practice powers", () => {
  const pairs = new Set();
  const rigs = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const item = generateQso("ragchew", seededRandom(Math.imul(seed, 2654435761) >>> 0));
    assert.deepEqual(item, generateQso("ragchew", seededRandom(Math.imul(seed, 2654435761) >>> 0)));
    const [a, b] = item.stations;
    assert.notEqual(a, b);
    assert.ok(QSO_CALLSIGNS.includes(a) && QSO_CALLSIGNS.includes(b));
    pairs.add(item.stations.join("/"));
    assert.equal(item.lines[0].split(" DE ")[1], `${a} ${a} K`);
    for (let index = 1; index < item.lines.length; index++) {
      const sender = index % 2 ? b : a;
      const receiver = index % 2 ? a : b;
      assert.ok(item.lines[index].startsWith(`${receiver} DE ${sender} `));
      assert.ok(item.lines[index].endsWith(`${receiver} DE ${sender} ${index < 6 ? "<KN>" : "<SK>"}`) || index === 1);
    }
    for (const line of item.lines.slice(4, 6)) {
      const [, rig, power] = /RIG HR (\w+) PWR (\d+) WATTS/.exec(line);
      assert.ok(QSO_RADIOS.find(item => item.rig === rig).watts.includes(Number(power)));
      rigs.add(rig);
    }
    const firstName = /NAME (\w+)/.exec(item.lines[2])[1];
    const secondName = /NAME (\w+)/.exec(item.lines[3])[1];
    assert.notEqual(firstName, secondName);
    assert.ok(item.lines[4].includes(`R ${secondName} RIG`));
    assert.ok(item.lines[5].includes(`TNX ${firstName} FER INFO`));
    assert.ok(!item.lines.join(" ").includes("undefined"));
  }
  assert.ok(pairs.size > 50);
  assert.equal(rigs.size, QSO_RADIOS.length);
});

test("repeat requests and POTA acknowledgements use the correct station's original location", () => {
  const a = { call: "W1TEST", name: "ALICE", city: "SANTA FE", state: "NM", report: "579" };
  const b = { call: "K2TEST", name: "BOB", city: "DES MOINES", state: "IA", report: "559" };
  const repeat = QSO_TEMPLATES.find(item => item.id === "repeat").lines(a, b);
  assert.match(repeat[2], /QTH SANTA FE NM/);
  assert.match(repeat[4], /QTH SANTA FE SANTA FE NM NM/);
  assert.match(repeat[5], /R R SANTA FE NM TNX MY QTH DES MOINES IA DES MOINES IA/);
  assert.match(repeat[6], /R DES MOINES IA TNX BOB/);
  const pota = QSO_TEMPLATES.find(item => item.id === "pota").lines(a, b);
  assert.match(pota[2], /UR 579 579/);
  assert.match(pota[3], /UR 559 559 IA IA/);
  assert.match(pota[4], /TNX FER IA/);
});

test("a generated exchange survives replay, speed changes, serialized reload, and template revisions", () => {
  const draft = { qsoId: "ragchew", wpm: 20, used: [] };
  const first = practiceQso(draft, seededRandom(17));
  const mustNotGenerate = () => { throw new Error("Unexpected regeneration"); };
  assert.equal(practiceQso(draft, mustNotGenerate), first);
  draft.wpm = 30;
  assert.equal(practiceQso(draft, mustNotGenerate), first);
  const restored = JSON.parse(JSON.stringify(draft));
  assert.deepEqual(practiceQso(restored, mustNotGenerate), first);
  // A stored script remains the source, even if the template later changes.
  restored.generated.lines[0] = "CQ DE W1TEST K";
  assert.equal(practiceQso(restored, mustNotGenerate).lines[0], "CQ DE W1TEST K");
  recordQsoSettings(draft);
  newPracticeQso(draft, seededRandom(17));
  const second = practiceQso(draft, mustNotGenerate);
  assert.ok(second.stations.every(call => !first.stations.includes(call)));
  assert.notDeepEqual(second.lines, first.lines);
  assert.equal(draft.wpm, 30);
  recordQsoSettings(draft);
  assert.equal(draft.used.length, 2);
  assert.ok(draft.used[0].includes(first.stations.join(" / ")));
  assert.ok(draft.used[1].includes(second.stations.join(" / ")));
});

test("legacy drafts generate once, changing templates discards mismatched scripts, and stories stay authored", () => {
  const draft = { qsoId: "short-contact", wpm: 20, used: [] };
  practiceQso(draft, () => 0);
  draft.qsoId = "pota";
  assert.equal(practiceQso(draft, () => .999).id, "pota");
  const previous = structuredClone(draft.generated);
  draft.qsoId = "story-trail";
  const story = PRACTICE_QSOS.find(item => item.id === "story-trail");
  assert.equal(practiceQso(draft), story);
  newPracticeQso(draft);
  assert.equal(practiceQso(draft), story);
  assert.deepEqual(draft.generated, previous);
  assert.throws(() => generateQso("unknown"), /Choose a QSO template/);
});
