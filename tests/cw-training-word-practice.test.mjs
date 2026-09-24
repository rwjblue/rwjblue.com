import assert from "node:assert/strict";
import test from "node:test";
import { COMMON_WORDS, DEFAULT_WORD_SETTINGS, createWordPracticeBlock, parsePracticeWords, recordWordSettings, wordPlaybackPosition, wordPracticeNote } from "../src/lib/cw-training/word-practice.ts";
import { createWordRound, renderWordSamples, retimeWordRound } from "../src/lib/cw-training/word-round.ts";
import { createWordPlayer } from "../src/lib/cw-training/word-player.ts";

const settings = { ...DEFAULT_WORD_SETTINGS, wpm: 30, shuffle: false };
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
  second.wordPractice.settings.wpm = 30;
  assert.equal(first.wordPractice.settings.wpm, 40);
  assert.equal(first.wordPractice.settings.pitch, 450);
  assert.deepEqual(second.wordPractice.used, []);
  assert.equal(second.assignmentId, "other-practice");
  assert.equal(second.task.id, "other:word-recognition");
  assert.equal(second.activeSeconds, 0);
  assert.equal(second.review, true);
  assert.match(wordPracticeNote(first.wordPractice), /30 WPM/);
});

test("new defaults replace old defaults once, preserving customized and subsequent preferences", () => {
  const old = { title: "Custom words", text: "HELLO", settings: { ...settings, pitch: 600 }, used: [] };
  const upgraded = createWordPracticeBlock("2026-09-24T12:00:00Z", "new", old).wordPractice;
  assert.equal(upgraded.settings.wpm, 40);
  assert.equal(upgraded.settings.pitch, 450);
  assert.equal(upgraded.text, "HELLO");
  const custom = createWordPracticeBlock("2026-09-24T12:00:00Z", "custom", { ...old, settings: { ...old.settings, wpm: 25, pitch: 500 } }).wordPractice;
  assert.equal(custom.settings.wpm, 25);
  assert.equal(custom.settings.pitch, 500);
  upgraded.settings.wpm = 30;
  upgraded.settings.pitch = 600;
  assert.deepEqual(createWordPracticeBlock("2026-09-24T12:00:00Z", "again", upgraded).wordPractice.settings, upgraded.settings);
});

test("frequent live adjustments keep history bounded without blocking playback", () => {
  const draft = createWordPracticeBlock("2026-09-24T12:00:00Z", "new").wordPractice;
  for (let wpm = 10; wpm <= 60; wpm++) { draft.settings.wpm = wpm; recordWordSettings(draft); }
  assert.equal(draft.used.length, 16);
  assert.match(draft.used.at(-1), /Additional settings/);
  assert.ok(wordPracticeNote(draft).length < 4000);
});

test("speed changes preserve the heard prefix, pitch, shuffle order and extra word pauses", () => {
  const round = createWordRound("THE OF THE AND", { ...settings, shuffle: true }, () => 0);
  const next = retimeWordRound(round, 40, 2);
  assert.deepEqual(next.words, round.words);
  assert.deepEqual(next.starts.slice(0, 3), round.starts.slice(0, 3));
  assert.deepEqual(next.timings.slice(0, next.timingStarts[2]), round.timings.slice(0, round.timingStarts[2]));
  const tail = createWordRound(round.words.slice(2).join(" "), { ...settings, wpm: 40 });
  near(next.duration, round.starts[2] + tail.duration);
  assert.deepEqual(next.timings.slice(next.timingStarts[2]), tail.timings);
  const prefixLength = Math.floor(round.starts[2] * 22050);
  assert.deepEqual(renderWordSamples(next, 450).slice(0, prefixLength), renderWordSamples(round, 450).slice(0, prefixLength));
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
      const source = { connect() {}, disconnect() { this.disconnected = true; }, stop(when = 0) { this.stopAt = when; }, start(when, offset) { this.when = when; this.offset = offset; } };
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

test("live speed changes schedule at word boundaries without pause, restart, or double-counting", async t => {
  const h = harness(t);
  let round = createWordRound("PARIS THE OF", settings);
  await h.player.play(round, 450);
  const context = h.contexts[0];
  context.currentTime = 0.6;
  h.player.checkpoint();
  const statuses = [...h.statuses];
  round = h.player.setSpeed(40);
  near(context.sources[0].stopAt, 3);
  near(context.sources[1].when, 3);
  near(context.sources[1].offset, 3);
  context.currentTime = 0.8;
  round = h.player.setSpeed(25);
  near(context.sources[1].stopAt, 3);
  near(context.sources[2].when, 3);
  assert.deepEqual(h.statuses, statuses);
  near(h.seconds(), 0.6);
  context.currentTime = 3.2;
  context.sources[0].onended();
  context.sources[1].onended();
  h.player.checkpoint();
  near(h.seconds(), 3.2);
  h.player.pause();
  assert.ok(context.sources.every(node => node.disconnected));
  await h.player.play(round, 450);
  near(context.sources.at(-1).offset, 3.2);
  context.currentTime = 1000;
  context.sources.at(-1).onended();
  near(h.seconds(), round.duration);
  assert.equal(h.statuses.at(-1), "ended");
});

test("pausing before a scheduled speed transition cancels every source and retains position", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS THE OF", settings);
  await h.player.play(round, 450);
  const context = h.contexts[0];
  context.currentTime = 0.5;
  const next = h.player.setSpeed(40);
  context.currentTime = 0.7;
  h.player.pause();
  for (const node of context.sources) {
    assert.equal(node.stopAt, 0);
    assert.equal(node.onended, null);
    assert.equal(node.disconnected, true);
  }
  near(h.seconds(), 0.7);
  await h.player.play(next, 450);
  near(context.sources.at(-1).offset, 0.7);
});
