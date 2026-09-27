import assert from "node:assert/strict";
import test from "node:test";
import { COMMON_WORDS, COMMON_QSO_WORDS, DEFAULT_WORD_SETTINGS, createWordPracticeBlock, parsePracticeWords, recordWordSettings, restoreWordPractice, restoreWordSettings, wordPracticeAttempt, wordPracticeNote } from "../src/lib/cw-training/word-practice.ts";
import { createWordRound, renderWordSamples, renderWordWav, retimeWordRound } from "../src/lib/cw-training/word-round.ts";
import { createWordPlayer } from "../src/lib/cw-training/word-player.ts";
import { createQsoRound, retimedQsoPosition } from "../src/lib/cw-listening/qso-round.ts";

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

test("QSO rounds keep VVV first while shuffling every other supplied entry in both audio modes", () => {
  const source = parsePracticeWords(COMMON_QSO_WORDS);
  const clips = new Map(source.map(word => [word, new Float32Array(2205)]));
  const orders = new Set();
  for (const spokenAnswers of [false, true]) for (let seed = 0; seed < 20; seed++) {
    let state = seed;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const round = createWordRound(COMMON_QSO_WORDS, { ...settings, wpm: 40, shuffle: true, spokenAnswers }, random, clips, "VVV");
    assert.equal(round.words[0], "VVV");
    assert.equal(round.starts[0], 0);
    assert.deepEqual([...round.words].sort(), [...source].sort());
    assert.equal(round.words.filter(word => word === "TKS").length, 1);
    assert.equal(round.words.filter(word => word === "TNX").length, 1);
    orders.add(round.words.join(" "));
    const retimed = retimeWordRound(round, 35, 3);
    assert.deepEqual(retimed.words, round.words);
    if (spokenAnswers) {
      assert.equal(round.speech[0].wordIndex, 0);
      assert.equal(round.speech[0].samples, clips.get("VVV"));
    }
  }
  assert.ok(orders.size > 10);
  assert.deepEqual(createWordRound(COMMON_QSO_WORDS, settings, Math.random, undefined, "VVV").words, source);
  assert.deepEqual(createWordRound("VVV THE OF", { ...settings, shuffle: true }, () => 0).words, ["THE", "OF", "VVV"], "Other lists keep their normal shuffle behavior");
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
  first.wordPractice.volume = 0.23;
  const second = createWordPracticeBlock("2026-09-24T12:00:00Z", "second", first.wordPractice);
  second.wordPractice.settings.wpm = 30;
  assert.equal(first.wordPractice.settings.wpm, 40);
  assert.equal(first.wordPractice.settings.pitch, 450);
  assert.deepEqual(second.wordPractice.used, []);
  assert.equal(second.wordPractice.volume, undefined);
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

function harness(t, outputWait = Promise.resolve(), canPlay = () => true) {
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
    volume = 1;
    seeking = false;
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
      this.onplay?.();
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
  const positions = [];
  const player = createWordPlayer({ canPlay, progress: (delta, position) => { seconds += delta; positions.push(position); }, status: status => statuses.push(status) });
  t.after(() => {
    player.dispose();
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  });
  return { outputs, recordings, revoked, player, statuses, positions, seconds: () => seconds };
}

test("changing native playback rate settles the preceding interval at its original rate", async t => {
  const h = harness(t);
  await h.player.play(createWordRound("PARIS PARIS PARIS", settings), 450);
  const output = h.outputs[0];
  output.currentTime = 1;
  output.playbackRate = 2;
  output.onratechange();
  near(h.seconds(), 1);
  output.currentTime = 3;
  h.player.checkpoint();
  near(h.seconds(), 2);
  output.playbackRate = 0.5;
  output.onratechange();
  output.currentTime = 3.5;
  h.player.pause();
  near(h.seconds(), 3);
  output.playbackRate = 1;
  output.onratechange();
  near(h.seconds(), 3);
});

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
  assert.equal(h.statuses.at(-1), "paused");
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

test("spoken mode adds the requested pause between repeats and after the answer", () => {
  const speech = new Float32Array(11025).fill(0.25); // half a second
  const clips = new Map([["PARIS", speech]]);
  for (const wpm of [30, 40]) {
    const round = createWordRound("PARIS", { ...settings, wpm, spokenAnswers: true, gapSeconds: 1 }, Math.random, clips);
    const compact = createWordRound("PARIS", { ...settings, wpm, gapSeconds: 0 });
    const repeatDuration = 60 / wpm;
    near(round.speech[0].at, repeatDuration * 3 + 2);
    near(round.duration, repeatDuration * 3 + .5 + 8.4 / wpm + 3);
    assert.equal(round.speech.length, 1);
    const repetition = [...compact.timings];
    const spaced = [...repetition];
    spaced[spaced.length - 1] -= 1000;
    assert.deepEqual(round.timings.slice(0, repetition.length * 3), [...spaced, ...spaced, ...repetition]);
    const samples = renderWordSamples(round, 450);
    const at = Math.round(round.speech[0].at * 22050);
    assert.deepEqual(samples.slice(at, at + speech.length), speech);
    assert.ok(samples.slice(at + speech.length).every(value => value === 0));
  }
});

test("spoken speed changes preserve the current item, spoken clip speed, duplicates and shuffled order", () => {
  const clips = new Map([["THE", new Float32Array(2205).fill(.2)], ["OF", new Float32Array(4410).fill(.3)]]);
  const round = createWordRound("THE OF THE", { ...settings, spokenAnswers: true, shuffle: true }, () => 0, clips);
  const next = retimeWordRound(round, 40, 1);
  assert.deepEqual(next.words, round.words);
  near(next.starts[1], round.starts[1]);
  assert.equal(next.speech.length, 3);
  assert.deepEqual(next.speech[0], round.speech[0]);
  for (let i = 0; i < next.words.length; i++) assert.equal(next.speech[i].samples, clips.get(next.words[i]));
  const prefix = Math.floor(round.starts[1] * 22050);
  assert.deepEqual(renderWordSamples(next, 450).slice(0, prefix), renderWordSamples(round, 450).slice(0, prefix));
  assert.throws(() => createWordRound("NEWWORD", { ...settings, spokenAnswers: true }, Math.random, clips), /No spoken clip/);
  assert.doesNotThrow(() => createWordRound("NEWWORD", settings));
});

test("ready-made recordings play and resume directly without creating a generated WAV", async t => {
  const h = harness(t);
  const round = { words: ["THE"], starts: [0], duration: 3, settings, recordingUrl: "/audio/cw-training/recordings/common-compact.mp3", speech: [], timings: [], timingStarts: [] };
  await h.player.play(round, 450);
  const output = h.outputs[0];
  assert.equal(output.src, round.recordingUrl);
  assert.equal(h.recordings.size, 0);
  output.currentTime = .8;
  h.player.pause();
  await h.player.play(round, 450);
  near(output.currentTime, .8);
  assert.equal(h.player.setSpeed(30), round);
  h.player.dispose();
  assert.deepEqual(h.revoked, []);
});


test("legacy source preferences restore the displayed configuration once without locking controls", () => {
  const fixed = { ...settings, wpm: 25, pitch: 700, gapSeconds: 2, shuffle: true, audioSource: "recording" };
  restoreWordSettings(fixed);
  assert.deepEqual(fixed, { ...settings, wpm: 40, pitch: 450, gapSeconds: 1, shuffle: false });
  fixed.wpm = 35;
  restoreWordSettings(fixed);
  assert.equal(fixed.wpm, 35);
  const generated = { ...settings, wpm: 25, audioSource: "generated" };
  restoreWordSettings(generated);
  assert.equal(generated.wpm, 25);
  assert.equal(generated.audioSource, undefined);
});

test("a live MP3 speed edit converts to generated audio at the same position and preserves the current spoken item", async t => {
  const h = harness(t);
  const clips = new Map([["THE", new Float32Array(2205).fill(.2)], ["OF", new Float32Array(4410).fill(.3)]]);
  const generated = createWordRound("THE OF", { ...settings, wpm: 40, spokenAnswers: true }, Math.random, clips);
  const recording = { ...generated, speech: [], speechClips: undefined, timings: [], timingStarts: [], recordingUrl: '/practice.mp3' };
  await h.player.play(recording, 450);
  const output = h.outputs[0];
  output.currentTime = .8;
  const next = h.player.setSpeed(30, clips);
  await Promise.resolve();
  assert.equal(next.recordingUrl, undefined);
  assert.match(output.src, /^blob:/);
  assert.equal(output.paused, false);
  near(output.currentTime, .8);
  near(next.starts[1], generated.starts[1]);
  assert.deepEqual(next.speech[0], generated.speech[0]);
  const prefix = Math.floor(generated.starts[1] * 22050);
  assert.deepEqual(renderWordSamples(next, 450).slice(0, prefix), renderWordSamples(generated, 450).slice(0, prefix));
  near(h.seconds(), .8);
  h.player.pause();
  await h.player.play(next, 450);
  near(output.currentTime, .8);
});


test("restoring word practice preserves its selection and removes legacy custom volume", () => {
  const previous = {
    defaultsVersion: 2, title: "Bob's 77-word reference", text: "RR THE RR QTH",
    settings: { ...settings, wpm: 42, spokenAnswers: true }, volume: 0.23,
    used: ["Bob's 77-word reference: 4 entries, 42 WPM", "Custom words: 2 entries, 30 WPM"],
  };
  const restored = structuredClone(previous);
  restoreWordPractice(restored);
  assert.equal(restored.title, "Common QSO words");
  assert.equal(restored.text, previous.text);
  assert.deepEqual(restored.settings, previous.settings);
  assert.equal(restored.volume, undefined);
  assert.deepEqual(restored.used, ["Common QSO words: 4 entries, 42 WPM", previous.used[1]]);
  const next = createWordPracticeBlock("2026-09-25T12:00:00Z", "renamed", previous).wordPractice;
  assert.equal(next.title, restored.title);
  assert.equal(next.text, previous.text);
  assert.deepEqual(next.settings, previous.settings);
  assert.equal(next.volume, undefined);
  assert.equal(previous.title, "Bob's 77-word reference");
});


test("prepared native controls can start audio without a separate play button", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS THE OF", settings);
  h.player.prepare(round, 450);
  const output = h.outputs[0];
  assert.equal(output.controls, true);
  assert.notEqual(output.hidden, true);
  assert.equal(output.paused, true);
  assert.equal(output.playCalls, 0);
  await output.play();
  assert.equal(h.statuses.at(-1), "playing");
  output.currentTime = 0.5;
  output.pause();
  await Promise.resolve();
  near(h.seconds(), 0.5);
  assert.equal(h.statuses.at(-1), "paused");
  output.volume = 0.2;
  h.player.setSpeed(40);
  assert.equal(output.paused, true);
  assert.equal(output.volume, 0.2);
  await output.play();
  near(output.currentTime, 0.5);
  h.player.clearRound();
  assert.equal(output.src, undefined);
  assert.equal(output.paused, true);
  assert.ok(h.revoked.length > 0);
});

test("native seeks update the word position without awarding skipped or paused time", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS THE OF THE PARIS", settings);
  h.player.prepare(round, 450);
  const output = h.outputs[0];
  await output.play();
  output.currentTime = 1.2;
  output.ontimeupdate();
  function seek(at) {
    output.currentTime = at;
    output.seeking = true;
    output.ontimeupdate(); // Even a timeupdate preceding seeking cannot earn credit.
    output.onseeking();
    output.seeking = false;
    output.onseeked();
    output.ontimeupdate();
  }
  seek(8);
  near(h.seconds(), 1.2);
  near(h.positions.at(-1), 8);
  output.currentTime = 8.5;
  h.player.pause();
  near(h.seconds(), 1.7);
  seek(2);
  near(h.positions.at(-1), 2);
  near(h.seconds(), 1.7);
  await output.play();
  output.currentTime = 2.3;
  output.ontimeupdate();
  near(h.seconds(), 2);
  seek(round.duration);
  output.finish(round.duration);
  near(h.seconds(), 2);
});

test("rewind and word jumps preserve playback and count heard audio instead of skipped time", async t => {
  const h = harness(t);
  const round = createWordRound("PARIS ".repeat(20), settings);
  await h.player.play(round, 450);
  const output = h.outputs[0];
  const source = output.src;
  output.currentTime = 14.4;
  h.player.seekBy(-10);
  near(output.currentTime, 4.4);
  near(h.seconds(), 14.4);
  assert.equal(output.paused, false);
  assert.equal(output.src, source);
  assert.equal(output.playCalls, 1);
  output.ontimeupdate();
  near(h.seconds(), 14.4);

  output.currentTime = 4.9;
  h.player.seekWord(8);
  near(output.currentTime, round.starts[8]);
  near(h.positions.at(-1), round.starts[8]);
  near(h.seconds(), 14.9);
  output.onseeking();
  output.onseeked();
  output.ontimeupdate();
  near(h.seconds(), 14.9);

  output.currentTime += 0.5;
  h.player.pause();
  near(h.seconds(), 15.4);
  h.player.seekWord(3);
  near(output.currentTime, round.starts[3]);
  assert.equal(output.paused, true);
  near(h.seconds(), 15.4);
  await h.player.play(round, 450);
  output.currentTime += 0.6;
  h.player.pause();
  near(h.seconds(), 16);
});

test("paused MP3 word jumps survive metadata loading, clamp to the recording, and ignore invalid targets", t => {
  const h = harness(t);
  h.player.seekBy(-10); // No recording yet.
  const round = { ...createWordRound("THE THE <AR> THE", settings), recordingUrl: "/practice.mp3" };
  h.player.prepare(round, 450);
  const output = h.outputs[0];
  h.player.seekWord(3); // The selected occurrence, not the first identical word.
  near(output.currentTime, round.starts[3]);
  output.onloadedmetadata();
  near(output.currentTime, round.starts[3]);
  assert.equal(output.playCalls, 0);
  assert.equal(output.paused, true);
  assert.equal(h.seconds(), 0);
  assert.equal(h.recordings.size, 0);
  h.player.seekBy(-1000);
  near(output.currentTime, 0);
  h.player.seekBy(1000);
  near(output.currentTime, round.duration);
  for (const invalid of [NaN, Infinity, -Infinity]) h.player.seek(invalid);
  for (const invalid of [-1, 99, 1.5, NaN]) h.player.seekWord(invalid);
  near(output.currentTime, round.duration);
  assert.equal(h.seconds(), 0);
  h.player.clearRound();
  h.player.seekWord(0);
  h.player.seekBy(-10);
  assert.equal(output.src, undefined);
});

test("word jumps follow the updated timeline after a live speed change", async t => {
  const h = harness(t);
  const original = createWordRound("PARIS THE THE <AR> OF", settings);
  await h.player.play(original, 450);
  const output = h.outputs[0];
  output.currentTime = 0.5;
  const updated = h.player.setSpeed(40);
  await Promise.resolve();
  assert.notEqual(updated.starts[3], original.starts[3]);
  h.player.seekWord(3);
  near(output.currentTime, updated.starts[3]);
  near(h.positions.at(-1), updated.starts[3]);
  near(h.seconds(), 0.5);
  assert.equal(output.paused, false);
});

test("native play observes the same eligibility check as lock-screen playback", async t => {
  let allowed = false;
  const h = harness(t, Promise.resolve(), () => allowed);
  h.player.prepare(createWordRound("PARIS", settings), 450);
  await assert.rejects(h.outputs[0].play(), /cancelled/);
  assert.equal(h.outputs[0].paused, true);
  assert.equal(h.seconds(), 0);
  allowed = true;
  await h.outputs[0].play();
  assert.equal(h.statuses.at(-1), "playing");
});


test("native playback rate credits listening time rather than accelerated media time", async t => {
  const h = harness(t);
  h.player.prepare(createWordRound("PARIS THE", settings), 450);
  const output = h.outputs[0];
  output.playbackRate = 2;
  await output.play();
  output.currentTime = 0.8;
  output.ontimeupdate();
  near(h.seconds(), 0.4);
  assert.equal(h.player.playbackRate, 2);
  output.playbackRate = 1;
  output.onratechange();
  output.currentTime = 1.8;
  h.player.pause();
  near(h.seconds(), 1.4);
});

test("replacing QSO audio preserves pause state and credits only listening across a remapped word", async t => {
  const h = harness(t);
  const qso = { id: 'test', title: 'Test', stations: ['A', 'B'], lines: ['THE THE THE', 'THE THE THE'] };
  const before = createQsoRound(qso, 20);
  const next = createQsoRound(qso, 35);
  await h.player.play(before, 450);
  const output = h.outputs[0];
  h.player.seekWord(4);
  output.currentTime += 0.2;
  const at = h.player.checkpoint();
  assert.equal(h.player.paused, false);
  h.player.pause();
  h.player.clearRound();
  h.player.prepare(next, 450);
  h.player.seek(retimedQsoPosition(before, next, at));
  near(h.seconds(), 0.2);
  assert.equal(h.player.paused, true);
  near(output.currentTime, next.starts[4]);
  await h.player.play(next, 450);
  assert.equal(h.player.paused, false);
  near(output.currentTime, next.starts[4]);
  output.currentTime += 0.3;
  h.player.pause();
  near(h.seconds(), 0.5);
  assert.equal(h.player.paused, true);
  assert.equal(h.recordings.size, 2);
  assert.equal(h.revoked.length, 1);
});

test("Farnsworth stretches only character and word gaps using the upstream PARIS standard", () => {
  const normal = createWordRound("PARIS PARIS", { ...settings, wpm: 30, gapSeconds: 0 });
  const spaced = createWordRound("PARIS PARIS", { ...settings, wpm: 30, fwpm: 15, gapSeconds: 0 });
  near(spaced.starts[1], 4);
  near(spaced.duration, 8);
  assert.deepEqual(spaced.timings.filter(ms => ms > 0), normal.timings.filter(ms => ms > 0));
  assert.deepEqual(spaced.timings.filter(ms => ms === -40), normal.timings.filter(ms => ms === -40));
  for (const fwpm of [0, 4, 31, NaN, Infinity]) assert.throws(() => createWordRound("PARIS", { ...settings, wpm: 30, fwpm }));
  const clips = new Map([["PARIS", new Float32Array(11025).fill(.2)]]);
  const short = createWordRound("PARIS PARIS", { ...settings, fwpm: 15, gapSeconds: 0, spokenAnswers: true }, Math.random, clips);
  const long = createWordRound("PARIS PARIS", { ...settings, fwpm: 15, gapSeconds: 2, spokenAnswers: true }, Math.random, clips);
  near(long.speech[0].at - short.speech[0].at, 4);
  near(long.starts[1] - short.starts[1], 6);
  near(long.duration - short.duration, 12);
});

test("effective-speed-only MP3 edits preserve the current answer and listening credit", async t => {
  const h = harness(t);
  const clips = new Map([["PARIS", new Float32Array(2205).fill(.2)]]);
  const before = createWordRound("PARIS PARIS PARIS", { ...settings, spokenAnswers: true }, Math.random, clips);
  await h.player.play({ ...before, recordingUrl: '/practice.mp3', speech: [], timings: [], timingStarts: [], speechClips: undefined }, 450);
  const output = h.outputs[0];
  output.currentTime = .5;
  const next = h.player.setSpeed(30, clips, 15);
  await Promise.resolve();
  near(next.starts[1], before.starts[1]);
  assert.deepEqual(next.speech[0], before.speech[0]);
  assert.ok(next.starts[2] > before.starts[2]);
  near(output.currentTime, .5);
  near(h.seconds(), .5);
  assert.equal(output.paused, false);
});

test("QSO Farnsworth timing retains exact word ends and two-second station handoffs", () => {
  const qso = { id: 'test', title: 'Test', stations: ['A', 'B'], lines: ['PARIS PARIS', 'PARIS PARIS'] };
  const normal = createQsoRound(qso, 30);
  const spaced = createQsoRound(qso, 30, 15);
  near(spaced.starts[1], 4);
  near(spaced.lines[1].start - spaced.lines[0].end, 2);
  near(spaced.duration, spaced.wordEnds.at(-1));
  near(spaced.duration, spaced.timings.reduce((total, ms) => total + Math.abs(ms), 0) / 1000);
  assert.deepEqual(spaced.timings.filter(ms => ms > 0), normal.timings.filter(ms => ms > 0));
  near(retimedQsoPosition(normal, spaced, normal.starts[2] + .1), spaced.starts[2]);
});

test("the full Common QSO list supports two-second repeat pauses within the round limit", () => {
  const clips = new Map(parsePracticeWords(COMMON_QSO_WORDS).map(word => [word, new Float32Array(22050)]));
  const round = createWordRound(COMMON_QSO_WORDS, { ...settings, wpm: 40, gapSeconds: 2, spokenAnswers: true }, Math.random, clips);
  assert.equal(round.words.length, 70);
  assert.ok(round.duration > 600 && round.duration < 1200);
});
