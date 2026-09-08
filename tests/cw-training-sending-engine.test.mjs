import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SENDING_ENGINE_VERSION, createSendingPlayer, decodeSendingTimings, sendingTextTimings,
} from "../src/lib/cw-training/sending-engine.ts";

test("the real engine imports and decodes without a browser or audio permission", () => {
  assert.equal(typeof window, "undefined");
  assert.deepEqual(decodeSendingTimings([60], 20), { text: "E", morse: "." });
  assert.deepEqual(decodeSendingTimings([180], 20), { text: "T", morse: "-" });
  assert.deepEqual(decodeSendingTimings([60, -60, 180], 20), { text: "A", morse: ".-" });
  assert.deepEqual(decodeSendingTimings([60, -180, 180], 20), { text: "ET", morse: ". -" });
  assert.deepEqual(decodeSendingTimings([60, -420, 180], 20), { text: "E T", morse: ". / -" });
});

test("real generator and decoder roundtrip characters, words, punctuation and prosigns at several speeds", () => {
  for (const speed of [5, 13, 20, 35, 60]) {
    for (const text of ["SOS", "CQ CQ DE N1RWJ", "PARIS", "0123456789", "READY?", "<AR>", "<SK>"]) {
      const timings = sendingTextTimings(text, speed);
      assert.equal(decodeSendingTimings(timings, speed).text, text, `${text} at ${speed} WPM`);
      assert.ok(timings[0] > 0, "no invented initial waiting interval");
      assert.ok(timings.at(-1) > 0, "final character decodes without a synthetic trailing gap");
    }
  }
  assert.deepEqual(sendingTextTimings("ET E", 20), [60, -180, 180, -420, 60]);
  assert.equal(sendingTextTimings("PARIS", 20).reduce((sum, duration) => sum + Math.abs(duration), 0) + 420, 3000,
    "PARIS including its standard word gap is 50 dits");
});

test("decoding preserves irregular raw marks and gaps, including contact noise", () => {
  const raw = Object.freeze([63, -58, 175, -210, 61, -445, 177]);
  assert.deepEqual(decodeSendingTimings(raw, 20), { text: "AE T", morse: ".- . / -" });
  assert.deepEqual(raw, [63, -58, 175, -210, 61, -445, 177]);
  const noisy = Object.freeze([60, -2, 3, -60, 180]);
  decodeSendingTimings(noisy, 20);
  assert.deepEqual(noisy, [60, -2, 3, -60, 180], "upstream noise merging does not rewrite recorded evidence");
});

test("unrecognised Morse remains visibly unknown instead of being silently repaired", () => {
  const sevenDahs = Array.from({ length: 13 }, (_, index) => index % 2 ? -60 : 180);
  const decoded = decodeSendingTimings(sevenDahs, 20);
  assert.ok(decoded.text.includes("#"), decoded.text);
  assert.equal(decoded.morse, "-------");
});

test("empty inputs and invalid values have explicit outcomes", async () => {
  for (const timings of [[], [-300], [0, -300, 0]]) {
    assert.deepEqual(decodeSendingTimings(timings, 20), { text: "", morse: "" });
  }
  assert.deepEqual(sendingTextTimings(" \n ", 20), []);
  for (const speed of [0, -1, NaN, Infinity]) {
    assert.throws(() => sendingTextTimings("E", speed), RangeError);
    assert.throws(() => decodeSendingTimings([60], speed), RangeError);
  }
  assert.throws(() => sendingTextTimings("HELLO 🐈", 20), /cannot be sent/);
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => decodeSendingTimings([60, bad], 20), RangeError);
  }
  const player = createSendingPlayer();
  await player.play([]);
  await assert.rejects(player.play([60]), /does not support Web Audio/);
  await assert.rejects(player.play([NaN]), RangeError);
  player.stop();
  player.dispose();
  player.dispose();
  await assert.rejects(player.play([60]), /disposed/);
});

function audioHarness(resumeWait = Promise.resolve()) {
  const contexts = [];
  class Param {
    events = [];
    setValueAtTime(value, time) { this.events.push({ method: "set", value, time }); }
    linearRampToValueAtTime(value, time) { this.events.push({ method: "linear", value, time }); }
    exponentialRampToValueAtTime(value, time) { this.events.push({ method: "exponential", value, time }); }
    cancelScheduledValues() {}
    setValueCurveAtTime(values, time, duration) { this.events.push({ method: "curve", values, time, duration }); }
  }
  class Context {
    state = "suspended";
    destination = {};
    sampleRate = 48000;
    gains = [];
    started = performance.now();
    constructor() { contexts.push(this); }
    get currentTime() { return (performance.now() - this.started) / 1000; }
    async resume() { await resumeWait; if (this.state !== "closed") this.state = "running"; }
    async close() { this.state = "closed"; }
    createOscillator() { return { frequency: new Param(), start() {}, connect() {}, disconnect() {} }; }
    createGain() {
      const node = { gain: new Param(), connect() {}, disconnect() {} };
      this.gains.push(node);
      return node;
    }
  }
  return { Context, contexts };
}

test("upstream audio replays the recorded intervals and closes only its own context", async t => {
  const { Context, contexts } = audioHarness();
  const previous = globalThis.window;
  globalThis.window = { AudioContext: Context };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const unrelated = new Context();
  unrelated.state = "running";
  const player = createSendingPlayer();
  t.after(() => player.dispose());
  const raw = Object.freeze([30, -25, 90]);
  await player.play(raw);
  assert.equal(contexts.length, 2);
  assert.equal(unrelated.state, "running", "main training audio is independent");
  assert.equal(contexts[1].state, "closed");
  const curves = contexts[1].gains[0].gain.events.filter(event => event.method === "curve");
  assert.equal(curves.length, 4, "upstream schedules two original tone envelopes");
  const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} vs ${expected}`);
  approximately(curves[1].time - curves[0].time, 0.030);
  approximately(curves[2].time - curves[1].time, 0.025);
  approximately(curves[3].time - curves[2].time, 0.090);
  assert.deepEqual(raw, [30, -25, 90]);
});

test("stop while audio is unlocking prevents delayed playback and settles its promise", async t => {
  let release;
  const { Context, contexts } = audioHarness(new Promise(resolve => { release = resolve; }));
  const previous = globalThis.window;
  globalThis.window = { AudioContext: Context };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const player = createSendingPlayer();
  const playing = player.play([60, -60, 180]);
  assert.equal(contexts.length, 1, "context opens within the caller's user gesture");
  player.stop();
  await playing;
  assert.equal(contexts[0].state, "closed");
  release();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(contexts[0].gains.length, 0, "cancelled import/unlock never constructs a sounding player");
  player.dispose();
});

test("replacing an active replay cannot let old completion callbacks stop the new replay", async t => {
  const { Context, contexts } = audioHarness();
  const previous = globalThis.window;
  globalThis.window = { AudioContext: Context };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const player = createSendingPlayer();
  t.after(() => player.dispose());
  const first = player.play([30]);
  await new Promise(resolve => setTimeout(resolve, 10));
  const second = player.play([180]);
  await first;
  assert.equal(contexts[0].state, "closed");
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(contexts[1].state, "running", "old sequence-end timers have no authority over the new replay");
  await second;
  assert.equal(contexts[1].state, "closed");
});

test("package and lockfile pin the tested source archive and ship its original license notices", async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const pkg = JSON.parse(await read("package.json"));
  const lock = JSON.parse(await read("package-lock.json"));
  assert.match(SENDING_ENGINE_VERSION, /^[a-f0-9]{40}$/);
  const archive = `https://gitlab.com/scphillips/morse-pro/-/archive/${SENDING_ENGINE_VERSION}/morse-pro-${SENDING_ENGINE_VERSION}.tar.gz`;
  assert.equal(pkg.dependencies["morse-pro"], archive);
  assert.equal(lock.packages[""].dependencies["morse-pro"], archive);
  assert.equal(lock.packages["node_modules/morse-pro"].resolved, archive);
  assert.match(lock.packages["node_modules/morse-pro"].integrity, /^sha512-/);
  assert.equal(lock.packages["node_modules/ebnf"].version, "1.9.0");
  assert.equal(pkg.overrides["morse-pro"].ebnf, "1.9.0");
  for (const [notice, dependency] of [["LICENSE", "morse-pro/LICENSE"], ["UPSTREAM-README.md", "morse-pro/README.md"], ["EBNF-LICENSE", "ebnf/LICENSE"]]) {
    assert.equal(await read(`public/vendor/morse-pro/${notice}`), await read(`node_modules/${dependency}`), notice);
  }
  const notice = await read("public/vendor/morse-pro/README.md");
  assert.ok(notice.includes(archive), "public notice provides the exact corresponding source archive");
  assert.match(notice, /extension of article 5/);
});
