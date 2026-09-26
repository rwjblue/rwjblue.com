import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_QSOS, createQsoPracticeBlock, qsoPracticeAttempt, recordQsoSettings } from "../src/lib/cw-training/qso-practice.ts";
import { createQsoRound, qsoPosition } from "../src/lib/cw-training/qso-round.ts";
import { renderWordSamples } from "../src/lib/cw-training/word-round.ts";
import { sendingTextTimings } from "../src/lib/cw-training/sending-engine.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test("every full exchange and story has exact Morse timing and a bounded timeline at both speed limits", () => {
  assert.equal(new Set(PRACTICE_QSOS.map(item => item.id)).size, PRACTICE_QSOS.length);
  assert.equal(PRACTICE_QSOS.filter(item => !item.kind).length, 4);
  for (const item of PRACTICE_QSOS) for (const wpm of [10, 40]) {
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
  const round = createQsoRound(PRACTICE_QSOS[0], 20);
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
  for (const speed of [0, NaN, Infinity, 9, 41]) assert.throws(() => createQsoRound(PRACTICE_QSOS[0], speed));
});
