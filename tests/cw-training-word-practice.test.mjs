import assert from "node:assert/strict";
import test from "node:test";
import { COMMON_WORDS, DEFAULT_WORD_SETTINGS, createWordPracticeBlock, parsePracticeWords, wordPlaybackPosition, wordPracticeNote } from "../src/lib/cw-training/word-practice.ts";
import { createWordRound, renderWordSamples } from "../src/lib/cw-training/word-round.ts";
import { createWordPlayer } from "../src/lib/cw-training/word-player.ts";

const settings = { ...DEFAULT_WORD_SETTINGS, shuffle: false };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test("word lists preserve repeats and prosigns, and reject control tags and unbounded input", () => {
  assert.equal(parsePracticeWords(COMMON_WORDS).length, 30);
  assert.deepEqual(parsePracticeWords("the\r\n of the <AR>"), ["THE", "OF", "THE", "<AR>"]);
  for (const text of ["", "   ", "HELLO 🐈", "THE [wpm=60]", "THE |w60", "E ".repeat(201), "X".repeat(41)]) assert.throws(() => parsePracticeWords(text));
});

test("PARIS timing, word pauses and speed are independent", () => {
  const round = createWordRound("PARIS PARIS", { ...settings, gapSeconds: 1 });
  near(round.duration, 6); // 2 * (50 dits at 40ms + 1 second)
  assert.deepEqual(round.starts, [0, 3]);
  near(createWordRound("PARIS", { ...settings, wpm: 40, gapSeconds: 0 }).duration, 1.5);
  const fast = createWordRound("ET", { ...settings, wpm: 40 });
  assert.deepEqual(fast.timings, [30, -90, 90, -1210]);
  for (const changes of [{wpm: 0}, {wpm: NaN}, {pitch: Infinity}, {gapSeconds: -1}]) assert.throws(() => createWordRound("E", {...settings, ...changes}));
  assert.throws(() => createWordRound("LONG ".repeat(200), {...settings, wpm:10, gapSeconds:5}), /exceeds/);
});

test("shuffle retains every entry including duplicates without rewriting the source", () => {
  const source = "THE OF THE AND";
  const round = createWordRound(source, { ...settings, shuffle:true }, () => 0);
  assert.notDeepEqual(round.words, source.split(" "));
  assert.deepEqual([...round.words].sort(), source.split(" ").sort());
  assert.equal(source, "THE OF THE AND");
});

test("PCM has the requested duration, silent gaps, bounded amplitude and smooth tone edges", () => {
  const round = createWordRound("E", {...settings, wpm:30, gapSeconds:0});
  const samples = renderWordSamples(round, 600);
  assert.equal(samples.length, Math.ceil(round.duration * 22050));
  assert.equal(samples[0], 0);
  near(samples[881], 0);
  assert.ok(samples.slice(882).every(value => value === 0));
  assert.ok(samples.some(value => Math.abs(value) > 0.6));
  assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 0.65));
});

test("optional blocks use word-recognition history and copy defaults without previous credit", () => {
  const first = createWordPracticeBlock("2026-09-24T12:00:00Z", "first");
  first.wordPractice.used.push("30 WPM");
  const second = createWordPracticeBlock("2026-09-24T12:00:00Z", "second", first.wordPractice);
  second.wordPractice.settings.wpm = 40;
  assert.equal(first.wordPractice.settings.wpm, 30);
  assert.deepEqual(second.wordPractice.used, []);
  assert.equal(second.assignmentId, "other-practice");
  assert.equal(second.task.id, "other:word-recognition");
  assert.equal(second.activeSeconds, 0);
  assert.equal(second.review, true);
  assert.match(wordPracticeNote(first.wordPractice), /30 WPM/);
});

function harness(t, resumeWait = Promise.resolve()) {
  const previous = globalThis.window;
  const contexts = [];
  class Context {
    currentTime = 0;
    state = "suspended";
    destination = {};
    sources = [];
    constructor() { contexts.push(this); }
    async resume() { await resumeWait; this.state = "running"; this.onstatechange?.(); }
    async close() { this.state = "closed"; }
    createBuffer(channels, length) { const samples = new Float32Array(length); return { getChannelData: () => samples }; }
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, stop() {}, start(when, offset) { this.offset = offset; } };
      this.sources.push(source); return source;
    }
  }
  globalThis.window = { AudioContext: Context };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  let seconds = 0;
  const statuses = [];
  const player = createWordPlayer({ progress: delta => { seconds += delta; }, status: status => statuses.push(status) });
  t.after(() => player.dispose());
  return { contexts, player, statuses, seconds: () => seconds };
}

test("audio clock credits partial listening once, pauses on interruption, resumes from position and caps delayed completion", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS", settings);
  await h.player.play(round, 600);
  const context = h.contexts[0];
  context.currentTime = 0.6; h.player.checkpoint(); h.player.checkpoint();
  near(h.seconds(), 0.6);
  context.state = "interrupted"; context.onstatechange();
  assert.equal(h.statuses.at(-1), "interrupted");
  context.currentTime = 100; h.player.checkpoint();
  near(h.seconds(), 0.6);
  await h.player.play(round, 600);
  near(context.sources.at(-1).offset, 0.6);
  context.currentTime = 101; h.player.pause();
  near(h.seconds(), 1.6);
  await h.player.play(round, 600);
  context.currentTime = 1000;
  context.sources.at(-1).onended();
  near(h.seconds(), round.duration);
  h.player.checkpoint(); near(h.seconds(), round.duration);
  assert.equal(h.statuses.at(-1), "ended");
  near(wordPlaybackPosition(1, 20, 19, 5), 1);
});

test("cancel while resuming never starts audio or credits elapsed time", async t => {
  let release;
  const h = harness(t, new Promise(resolve => { release = resolve; }));
  const playing = h.player.play(createWordRound("PARIS", settings), 600);
  h.player.pause(); release(); await playing;
  assert.equal(h.contexts[0].sources.length, 0);
  assert.equal(h.seconds(), 0);
});
