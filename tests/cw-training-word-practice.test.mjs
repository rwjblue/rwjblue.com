import assert from "node:assert/strict";
import test from "node:test";
import { COMMON_WORDS, DEFAULT_WORD_SETTINGS, createWordPracticeBlock, parsePracticeWords, recordWordSettings, wordPracticeAttempt, wordPracticeNote } from "../src/lib/cw-training/word-practice.ts";
import { createWordRound, renderWordSamples, renderWordWav, retimeWordRound } from "../src/lib/cw-training/word-round.ts";
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

test("quick saves use actual audio time and a stable ID without assigning course credit", () => {
  const active = createWordPracticeBlock("2026-09-24T12:00:00Z", "listening-visit");
  active.activeSeconds = 83.9;
  recordWordSettings(active.wordPractice);
  const attempt = wordPracticeAttempt(active, "2026-09-24T12:05:00Z");
  assert.equal(attempt.id, active.id);
  assert.equal(attempt.activeSeconds, 83);
  assert.equal(Date.parse(attempt.startedAt), Date.parse(active.startedAt));
  assert.equal(attempt.endedAt, "2026-09-24T12:05:00Z");
  assert.equal(attempt.assignmentId, "other-practice");
  assert.equal(attempt.taskId, "other:word-recognition");
  assert.equal(attempt.completed, false);
  assert.equal(attempt.review, true);
  assert.equal(attempt.context, "practice");
  assert.match(attempt.note, /40 WPM.*450 Hz/);
  assert.equal(wordPracticeAttempt(active, attempt.endedAt).id, attempt.id);
  // A clock correction cannot make credited time exceed the recorded window.
  const corrected = wordPracticeAttempt(active, "2026-09-24T12:00:30Z");
  assert.equal(Date.parse(corrected.endedAt) - Date.parse(corrected.startedAt), 83000);
});

test("opening word controls without listening does not create an empty history entry", () => {
  const active = createWordPracticeBlock("2026-09-24T12:00:00Z", "empty-visit");
  assert.equal(wordPracticeAttempt(active, "2026-09-24T12:10:00Z"), undefined);
  active.activeSeconds = 0.9;
  assert.equal(wordPracticeAttempt(active, "2026-09-24T12:10:00Z"), undefined);
  active.activeSeconds = NaN;
  assert.equal(wordPracticeAttempt(active, "2026-09-24T12:10:00Z"), undefined);
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

test("generated WAV contains seekable mono PCM with the exact rendered tones and duration", async () => {
  const round = createWordRound("PARIS THE", settings);
  const blob = renderWordWav(round, 450);
  assert.equal(blob.type, "audio/wav");
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  const text = (at, length) => new TextDecoder().decode(bytes.slice(at, at + length));
  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 8), "WAVEfmt ");
  assert.equal(text(36, 4), "data");
  assert.equal(view.getUint32(4, true), bytes.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint32(28, true), 44100);
  assert.equal(view.getUint16(32, true), 2);
  assert.equal(view.getUint16(34, true), 16);
  const samples = renderWordSamples(round, 450);
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(bytes.byteLength, 44 + samples.length * 2);
  for (let i = 0; i < samples.length; i++) assert.equal(view.getInt16(44 + i * 2, true), Math.round(samples[i] * 32767) || 0);
});

function harness(t, outputWait = Promise.resolve()) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const outputs = [];
  const recordings = new Map();
  const revoked = [];
  let nextUrl = 0;
  t.mock.method(URL, "createObjectURL", blob => {
    const url = `blob:word-test-${++nextUrl}`;
    recordings.set(url, blob);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", url => revoked.push(url));
  class Output {
    paused = true;
    ended = false;
    currentTime = 0;
    playCalls = 0;
    loaded = false;
    setAttribute() {}
    set src(value) { this.url = value; this.currentTime = 0; this.paused = true; this.ended = false; this.loaded = false; }
    get src() { return this.url; }
    async play() {
      this.playCalls++;
      this.paused = false;
      await outputWait;
      if (this.paused) throw new Error("Playback cancelled.");
      if (this.fail) throw new Error("Playback interrupted.");
      if (!this.loaded) { this.loaded = true; this.onloadedmetadata?.(); }
      this.onplaying?.();
    }
    pause() { this.paused = true; queueMicrotask(() => this.onpause?.()); }
    finish(duration) { this.currentTime = duration; this.ended = true; this.paused = true; this.onpause?.(); this.onended?.(); }
    removeAttribute(name) { assert.equal(name, "src"); this.url = undefined; }
    load() { this.loaded = false; }
    remove() { this.attached = false; }
  }
  // The regression is specifically resuming without relying on Web Audio.
  globalThis.window = { AudioContext: class { constructor() { throw new Error("Web Audio unavailable in background"); } } };
  globalThis.document = {
    createElement(tag) { assert.equal(tag, "audio"); const output = new Output(); outputs.push(output); return output; },
    body: { append(output) { output.attached = true; } },
  };
  let seconds = 0;
  const statuses = [];
  const player = createWordPlayer({ progress: delta => { seconds += delta; }, status: status => statuses.push(status) });
  t.after(() => {
    player.dispose();
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  });
  return { outputs, recordings, revoked, player, statuses, seconds: () => seconds };
}

test("native recording retains its source on pause and resumes without Web Audio, then releases on disposal", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS THE", settings);
  await h.player.play(round, 450);
  const output = h.outputs[0];
  const url = output.src;
  assert.equal(h.recordings.get(url).type, "audio/wav");
  output.currentTime = 0.8;
  h.player.pause();
  assert.equal(output.paused, true);
  assert.equal(output.src, url);
  assert.equal(output.attached, true);
  assert.deepEqual(h.revoked, []);
  h.player.checkpoint();
  near(h.seconds(), 0.8);
  await h.player.play(round, 450);
  assert.equal(h.outputs.length, 1);
  assert.equal(output.playCalls, 2);
  assert.equal(output.paused, false);
  assert.equal(output.src, url);
  near(output.currentTime, 0.8);
  output.currentTime = 1.3;
  h.player.checkpoint();
  near(h.seconds(), 1.3);
  h.player.dispose();
  assert.equal(output.src, undefined);
  assert.equal(output.attached, false);
  assert.deepEqual(h.revoked, [url]);
});

test("native transport events keep the trainer and listening time synchronized", async t => {
  const h = harness(t);
  await h.player.play(createWordRound("PARIS THE", settings), 450);
  const output = h.outputs[0];
  const url = output.src;
  output.currentTime = 0.4;
  output.pause();
  await Promise.resolve();
  assert.equal(h.statuses.at(-1), "interrupted");
  assert.equal(output.src, url);
  h.player.checkpoint();
  near(h.seconds(), 0.4);
  await output.play();
  assert.equal(h.statuses.at(-1), "playing");
  output.currentTime = 0.9;
  output.ontimeupdate();
  near(h.seconds(), 0.9);
});

test("cancelling pending native playback cannot start audio or earn practice time", async t => {
  let release;
  const h = harness(t, new Promise(resolve => { release = resolve; }));
  const playing = h.player.play(createWordRound("PARIS", settings), 450);
  h.player.dispose();
  release();
  await playing;
  assert.equal(h.outputs[0].paused, true);
  assert.equal(h.outputs[0].attached, false);
  assert.equal(h.seconds(), 0);
  assert.ok(!h.statuses.includes("playing"));
});

test("media clock credits partial listening once and caps delayed completion", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS", settings);
  await h.player.play(round, 450);
  const output = h.outputs[0];
  output.currentTime = 0.6; h.player.checkpoint(); h.player.checkpoint();
  near(h.seconds(), 0.6);
  h.player.pause();
  h.player.checkpoint();
  near(h.seconds(), 0.6);
  await h.player.play(round, 450);
  near(output.currentTime, 0.6);
  output.currentTime = 1.6; h.player.pause();
  near(h.seconds(), 1.6);
  await h.player.play(round, 450);
  output.finish(round.duration + 0.001);
  near(h.seconds(), round.duration);
  h.player.checkpoint(); near(h.seconds(), round.duration);
  assert.equal(h.statuses.at(-1), "ended");
  await h.player.play(round, 450);
  near(output.currentTime, 0);
});

test("live speed changes retain position, heard prefix, pitch, and word order without double-counting", async t => {
  const h = harness(t);
  let round = createWordRound("PARIS THE OF", settings);
  await h.player.play(round, 450);
  const output = h.outputs[0];
  const firstUrl = output.src;
  output.currentTime = 0.6;
  round = h.player.setSpeed(40);
  await Promise.resolve();
  assert.equal(output.paused, false);
  near(output.currentTime, 0.6);
  near(round.starts[1], 3);
  near(h.seconds(), 0.6);
  assert.deepEqual(h.revoked, [firstUrl]);
  const first = new Uint8Array(await h.recordings.get(firstUrl).arrayBuffer());
  const updated = new Uint8Array(await h.recordings.get(output.src).arrayBuffer());
  assert.deepEqual(updated.slice(44, 44 + 3 * 44100), first.slice(44, 44 + 3 * 44100));
  output.currentTime = 0.8;
  round = h.player.setSpeed(25);
  await Promise.resolve();
  near(output.currentTime, 0.8);
  near(round.starts[1], 3);
  assert.deepEqual(round.words, ["PARIS", "THE", "OF"]);
  assert.ok(h.statuses.every(status => status === "playing"));
  output.currentTime = 3.2;
  h.player.checkpoint();
  near(h.seconds(), 3.2);
  h.player.pause();
  await h.player.play(round, 450);
  near(output.currentTime, 3.2);
  output.finish(round.duration);
  near(h.seconds(), round.duration);
});

test("pause during a speed replacement cancels resume and retains the seek position", async t => {
  const h = harness(t);
  await h.player.play(createWordRound("PARIS THE OF", settings), 450);
  const output = h.outputs[0];
  output.currentTime = 0.5;
  const next = h.player.setSpeed(40);
  h.player.pause();
  await Promise.resolve();
  assert.equal(output.paused, true);
  near(h.seconds(), 0.5);
  await h.player.play(next, 450);
  near(output.currentTime, 0.5);
  output.currentTime = 0.7;
  h.player.pause();
  near(h.seconds(), 0.7);
});

test("paused speed changes do not autoplay and a failed resume can be retried", async t => {
  const h = harness(t);
  await h.player.play(createWordRound("PARIS THE OF", settings), 450);
  const output = h.outputs[0];
  output.currentTime = 0.5;
  h.player.pause();
  const next = h.player.setSpeed(40);
  assert.equal(output.playCalls, 1);
  assert.equal(output.paused, true);
  near(output.currentTime, 0.5);
  output.fail = true;
  await assert.rejects(h.player.play(next, 450), /interrupted/);
  assert.equal(h.statuses.at(-1), "interrupted");
  near(h.seconds(), 0.5);
  output.fail = false;
  await h.player.play(next, 450);
  assert.equal(output.paused, false);
  near(output.currentTime, 0.5);
});
