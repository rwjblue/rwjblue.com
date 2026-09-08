import assert from "node:assert/strict";
import test from "node:test";
import {
  createRunnerRun, isRunnerSettings, parseRunnerEvent, reduceRunnerEvent,
  runnerConfigureCommand, runnerMeetsAssignment, runnerResultNote, runnerSettings, runnerStopCommand,
  RUNNER_CHANNEL, RUNNER_PROTOCOL_VERSION,
} from "../src/lib/cw-training/runner-bridge.ts";
import {
  installRunnerBridge, parseRunnerCommand, readRunnerSummary,
} from "../public/vendor/web-morse-runner/integration/bridge.js";

const task = (overrides = {}) => ({
  id: "synthetic-runner", kind: "simulator", title: "Morse Runner practice",
  instructions: "Use Single Calls.", sourceUrl: "https://example.invalid/exercise",
  speedWpm: 13, minutes: 15, ...overrides,
});
const settings = () => runnerSettings(task());
const summary = () => ({ qsoCount: 12, verifiedPoints: 10, score: 80, nrErrors: 1, nilErrors: 1 });
const event = (type, sequence, elapsedSeconds = 0, rest = {}) => ({
  channel: RUNNER_CHANNEL, version: RUNNER_PROTOCOL_VERSION, runId: "synthetic-run-1",
  type, sequence, elapsedSeconds, ...(type === "started" ? { settings: settings() } : {}), ...rest,
});
const run = () => createRunnerRun("synthetic-run-1", settings());
const started = () => reduceRunnerEvent(reduceRunnerEvent(run(), event("ready", 0)), event("started", 1));

test("assigned settings derive explicit run mode, speed, duration and activity without WPX title inference", () => {
  for (const speedWpm of [10, 13, 15, 18, 20, 25]) {
    const actual = runnerSettings(task({ speedWpm, minutes: 7.5 }));
    assert.equal(actual.wpm, speedWpm);
    assert.equal(actual.durationSeconds, 450);
    assert.equal(actual.mode, "SingleCall");
    assert.equal(actual.activity, 2);
    assert.ok(Object.values(actual.conditions).every(value => value === false));
  }
  assert.equal(runnerSettings(task({ instructions: "Same settings as Session 1." })).mode, "SingleCall");
  assert.equal(runnerSettings(task({ instructions: "Choose CQ WPX contest.", title: "Morse Runner WPX" })), undefined);
  assert.equal(runnerSettings(task({ settings: "WPX Competition; Activity level 1." })).mode, "WPX");
  assert.equal(runnerSettings(task({ settings: "WPX Competition; Activity level 1." })).activity, 1);
  assert.equal(runnerSettings(task({ instructions: "WPX Competition; Activity 2." })).activity, 2);
});

test("unsupported or ambiguous assignments fail closed, without changing their values", () => {
  for (const overrides of [
    { kind: "audio" }, { title: "Other simulator", instructions: "Single Calls." },
    { instructions: "Follow the advisor's configuration." }, { speedWpm: undefined },
    { speedWpm: NaN }, { speedWpm: Infinity }, { speedWpm: 9 }, { speedWpm: 61 },
    { minutes: undefined }, { minutes: 0 }, { minutes: 101 }, { minutes: Infinity },
    { instructions: "Single Calls; Activity 10." },
  ]) assert.equal(runnerSettings(task(overrides)), undefined);
  const input = Object.freeze(task());
  assert.equal(runnerSettings(input).wpm, 13);
  assert.equal(isRunnerSettings({ ...settings(), unexpected: true }), false);
  assert.equal(isRunnerSettings({ ...settings(), conditions: { qrm: false } }), false);
});

test("commands carry only configuration and run identity, and never start playback", () => {
  const state = run();
  assert.deepEqual(runnerConfigureCommand(state), {
    channel: RUNNER_CHANNEL, version: RUNNER_PROTOCOL_VERSION, type: "configure", runId: state.runId, settings: settings(),
  });
  assert.deepEqual(runnerStopCommand(state), { channel: RUNNER_CHANNEL, version: RUNNER_PROTOCOL_VERSION, type: "stop", runId: state.runId });
  const command = runnerConfigureCommand(state);
  command.settings.conditions.qrm = true;
  assert.equal(state.settings.conditions.qrm, false);
  assert.throws(() => createRunnerRun("", settings()), TypeError);
  assert.throws(() => createRunnerRun("a".repeat(101), settings()), TypeError);
  assert.throws(() => createRunnerRun("run", { ...settings(), wpm: NaN }), TypeError);
});

test("events require a versioned exact bounded numeric schema", () => {
  for (const invalid of [
    null, [], "ready", event("unknown", 0), event("ready", 0, 0, { version: 1 }),
    event("ready", 0, 0, { channel: "other" }), event("ready", 0, 0, { runId: "x".repeat(101) }),
    event("ready", -1), event("ready", 0.1), event("ready", 1_000_001),
    event("progress", 1, NaN), event("progress", 1, Infinity), event("progress", 1, -1),
    event("progress", 1, 6_001), event("ready", 0, 0, { curriculum: "not allowed" }),
    event("error", 1, 0, { code: "unbounded raw error" }),
    event("results", 2, 900, { reason: "paused", summary: summary() }),
    event("started", 1, 0, { settings: undefined }), event("started", 1, 0, { settings: { ...settings(), wpm: 9 } }),
    event("speed", 2, 10), event("speed", 2, 10, { wpm: NaN }), event("speed", 2, 10, { wpm: 61 }),
    event("speed", 2, 10, { wpm: 20, settings: settings() }),
  ]) assert.equal(parseRunnerEvent(invalid), undefined);
  assert.equal(parseRunnerEvent(event("error", 0, 0, { code: "audio" })).code, "audio");
  assert.equal(parseRunnerEvent(event("progress", 2, 12.25)).elapsedSeconds, 12.25);
});

test("result summaries exclude logs and reject unbounded or inconsistent counts", () => {
  for (const invalid of [
    { ...summary(), qsoCount: 100_001 }, { ...summary(), verifiedPoints: 13 },
    { ...summary(), score: 10_000_000_001 }, { ...summary(), score: NaN },
    { ...summary(), nrErrors: -1 }, { ...summary(), nilErrors: 0.5 },
    { ...summary(), nrErrors: 12, nilErrors: 1 }, { ...summary(), calls: ["SYNTHETIC"] },
  ]) assert.equal(parseRunnerEvent(event("results", 2, 900, { reason: "completed", summary: invalid })), undefined);
  const input = event("results", 2, 900, { reason: "completed", summary: summary() });
  const parsed = parseRunnerEvent(input);
  input.summary.qsoCount = 999;
  assert.equal(parsed.summary.qsoCount, 12);
});

test("only started uninterrupted engine time reaching the chosen duration completes one run", () => {
  let state = run();
  assert.equal(state.status, "loading");
  assert.equal(state.elapsedSeconds, 0);
  assert.equal(reduceRunnerEvent(state, event("started", 1)), state);
  state = reduceRunnerEvent(state, event("ready", 0));
  assert.equal(state.status, "ready");
  state = reduceRunnerEvent(state, event("started", 1));
  assert.equal(state.status, "running");
  state = reduceRunnerEvent(state, event("progress", 2, 450.75));
  assert.equal(state.elapsedSeconds, 450.75);
  assert.equal(state.status, "running");
  state = reduceRunnerEvent(state, event("progress", 3, 900));
  assert.equal(state.status, "running", "elapsed time alone is not a results/completion signal");
  state = reduceRunnerEvent(state, event("results", 4, 900, { reason: "completed", summary: summary() }));
  assert.equal(state.status, "completed");
  assert.equal(state.elapsedSeconds, 900);
  assert.match(runnerResultNote(state), /completed; 900 seconds; Single Call; 13 WPM starting speed; run duration 900 seconds; band conditions off; 12 QSOs; Verified Pts 10; verified score 80; NR 1; NIL 1/);
  assert.equal(runnerMeetsAssignment(state, task()), true);
});

test("stopped or undersized completed runs remain partial and two short attempts never combine", () => {
  for (const reason of ["completed", "stopped"]) {
    const state = reduceRunnerEvent(started(), event("results", 2, 450, { reason, summary: summary() }));
    assert.equal(state.status, "stopped");
    assert.equal(state.elapsedSeconds, 450);
    assert.match(runnerResultNote(state), /stopped \(partial\)/);
    assert.equal(reduceRunnerEvent(state, event("started", 3)), state);
    assert.equal(reduceRunnerEvent(state, event("results", 4, 900, { reason: "completed", summary: summary() })), state);
  }
  assert.equal(createRunnerRun("synthetic-run-2", settings()).elapsedSeconds, 0);
  assert.equal(reduceRunnerEvent(started(), event("results", 2, 900, { reason: "stopped", summary: summary() })).status, "stopped");
});

test("duplicate, out-of-order, reset, wrong-run and regressing events are ignored", () => {
  const state = reduceRunnerEvent(started(), event("progress", 3, 500));
  for (const invalid of [
    event("progress", 3, 500), event("progress", 2, 600), event("ready", 0),
    event("started", 4), event("progress", 4, 499), event("progress", 4, 901),
    event("progress", 4, 600, { runId: "another-run" }),
  ]) assert.equal(reduceRunnerEvent(state, invalid), state);
  assert.equal(reduceRunnerEvent(state, event("progress", 8, 500)).elapsedSeconds, 500, "sequence gaps do not add time");
  assert.equal(runnerResultNote(state), undefined);
});

test("errors preserve only reported engine time and cannot be restarted or upgraded to complete", () => {
  const state = reduceRunnerEvent(started(), event("error", 2, 123.5, { code: "interrupted" }));
  assert.equal(state.status, "error");
  assert.equal(state.elapsedSeconds, 123.5);
  assert.equal(state.errorCode, "interrupted");
  assert.equal(reduceRunnerEvent(state, event("started", 3)), state);
  assert.equal(reduceRunnerEvent(state, event("results", 4, 900, { reason: "completed", summary: summary() })), state);
  assert.match(runnerResultNote(state), /interrupted \(partial\); 123 seconds; Single Call; 13 WPM starting speed; run duration 900 seconds; band conditions off; results unavailable/);
  const beforeStart = reduceRunnerEvent(run(), event("error", 0, 0, { code: "configuration" }));
  assert.equal(beforeStart.status, "error");
  assert.match(runnerResultNote(beforeStart), /configuration error \(partial\); 0 seconds/);
});

test("result notes always include mode and actual settings, with WPX activity and explicit conditions", () => {
  const config = runnerSettings(task({ instructions: "WPX Competition; Activity level 1.", speedWpm: 18 }));
  config.conditions.qrm = true;
  config.conditions.flutter = true;
  let state = createRunnerRun("synthetic-run-1", config);
  state = reduceRunnerEvent(state, event("ready", 0));
  state = reduceRunnerEvent(state, event("started", 1, 0, { settings: config }));
  state = reduceRunnerEvent(state, event("results", 2, 210, { reason: "stopped", summary: summary() }));
  assert.match(runnerResultNote(state), /stopped \(partial\); 210 seconds; WPX Contest; 18 WPM starting speed; run duration 900 seconds; Activity 1; band conditions QRM, FLUTTER/);
  assert.doesNotMatch(runnerResultNote({ ...state, settings: settings() }), /Activity/);
  assert.match(runnerResultNote({ ...state, summary: undefined }), /results unavailable/);
  for (const status of ["loading", "ready", "running"]) assert.equal(runnerResultNote({ ...state, status }), undefined);
});

test("starting records chosen settings, without mutating defaults or accepting later reconfiguration", () => {
  const defaults = run();
  const selected = { ...settings(), wpm: 20, durationSeconds: 180, mode: "WPX", activity: 4,
    conditions: { ...settings().conditions, qrm: true } };
  const startEvent = event("started", 1, 0, { settings: selected });
  const actual = reduceRunnerEvent(reduceRunnerEvent(defaults, event("ready", 0)), startEvent);
  assert.deepEqual(actual.settings, selected);
  assert.deepEqual(actual.speedHistory, [{ elapsedSeconds: 0, wpm: 20 }]);
  selected.conditions.qrm = false;
  assert.equal(actual.settings.conditions.qrm, true, "parsed settings are copied");
  assert.equal(defaults.settings.wpm, 13);
  assert.equal(defaults.settings.durationSeconds, 900);
  assert.equal(reduceRunnerEvent(actual, event("started", 2, 0, { settings: settings() })), actual);
});

test("the chosen run can finish without incorrectly finishing a shorter or differently configured assignment", () => {
  for (const [selected, expected] of [
    [{ ...settings(), durationSeconds: 180 }, false],
    [{ ...settings(), durationSeconds: 1200 }, true],
    [{ ...settings(), mode: "WPX" }, false],
    [{ ...settings(), wpm: 25 }, true],
    [{ ...settings(), wpm: 10 }, true],
  ]) {
    let state = reduceRunnerEvent(reduceRunnerEvent(run(), event("ready", 0)), event("started", 1, 0, { settings: selected }));
    state = reduceRunnerEvent(state, event("results", 2, selected.durationSeconds, { reason: "completed", summary: summary() }));
    assert.equal(state.status, "completed", "each chosen run completed its own continuous duration");
    assert.equal(runnerMeetsAssignment(state, task()), expected);
    assert.equal(runnerMeetsAssignment({ ...state, status: "stopped" }, task()), false);
    assert.equal(runnerMeetsAssignment({ ...state, status: "error" }, task()), false);
    assert.equal(runnerMeetsAssignment(state, task({ instructions: "Unknown exercise" })), false);
  }
});

test("speed events retain engine timestamps and actual starting speed without requiring fixed assignment WPM", () => {
  let state = started();
  state = reduceRunnerEvent(state, event("speed", 2, 12.5, { wpm: 18 }));
  state = reduceRunnerEvent(state, event("speed", 3, 31.75, { wpm: 23 }));
  state = reduceRunnerEvent(state, event("speed", 4, 32, { wpm: 23 }));
  state = reduceRunnerEvent(state, event("speed", 5, 120, { wpm: 15 }));
  assert.deepEqual(state.speedHistory, [
    { elapsedSeconds: 0, wpm: 13 }, { elapsedSeconds: 12.5, wpm: 18 },
    { elapsedSeconds: 31.75, wpm: 23 }, { elapsedSeconds: 120, wpm: 15 },
  ]);
  assert.equal(state.settings.wpm, 13, "settings remain the starting configuration");
  for (const invalid of [
    event("speed", 5, 120, { wpm: 20 }), event("speed", 6, 119, { wpm: 20 }),
    event("speed", 6, 901, { wpm: 20 }), event("speed", 6, 120, { wpm: 0 }),
  ]) assert.equal(reduceRunnerEvent(state, invalid), state);
  state = reduceRunnerEvent(state, event("results", 6, 900, { reason: "completed", summary: summary() }));
  assert.equal(runnerMeetsAssignment(state, task()), true);
  assert.match(runnerResultNote(state), /13 WPM starting speed/);
  assert.match(runnerResultNote(state), /speed changes: 18 WPM at 0:12, 23 WPM at 0:31, 15 WPM at 2:00/);
  assert.equal(reduceRunnerEvent(state, event("speed", 7, 900, { wpm: 20 })), state);
  assert.equal(reduceRunnerEvent(run(), event("speed", 0, 0, { wpm: 20 })).status, "loading");
});

test("automatic notes stay bounded for frequent adjustments and retain every actual WPM used", () => {
  let state = started();
  for (let index = 0; index < 120; index++) {
    state = reduceRunnerEvent(state, event("speed", index + 2, index + 1, { wpm: 10 + index % 51 }));
  }
  state = reduceRunnerEvent(state, event("results", 123, 180, { reason: "stopped", summary: summary() }));
  const note = runnerResultNote(state);
  assert.ok(note.length < 2000);
  assert.match(note, /96 other changes/);
  assert.match(note, /WPM used: 10, 11, 12, 13/);
  assert.match(note, /58, 59, 60/);
  assert.equal(state.speedHistory.length, 121);
  const legacy = { ...started(), speedHistory: undefined };
  assert.deepEqual(reduceRunnerEvent(legacy, event("speed", 2, 5, { wpm: 20 })).speedHistory,
    [{ elapsedSeconds: 0, wpm: 13 }, { elapsedSeconds: 5, wpm: 20 }]);
});

test("the static adapter accepts the typed commands and rejects extra data or invalid settings", () => {
  assert.deepEqual(parseRunnerCommand(runnerConfigureCommand(run())), runnerConfigureCommand(run()));
  assert.deepEqual(parseRunnerCommand(runnerStopCommand(run())), runnerStopCommand(run()));
  for (const invalid of [
    { ...runnerConfigureCommand(run()), lesson: "not part of the protocol" },
    { ...runnerConfigureCommand(run()), settings: { ...settings(), wpm: NaN } },
    { ...runnerConfigureCommand(run()), settings: { ...settings(), mode: "CWT" } },
    { ...runnerConfigureCommand(run()), settings: { ...settings(), conditions: { qrm: false } } },
    { ...runnerStopCommand(run()), type: "start" },
    { ...runnerStopCommand(run()), runId: "" },
    { ...runnerStopCommand(run()), version: 1 },
  ]) assert.equal(parseRunnerCommand(invalid), undefined);
});

test("the adapter extracts verified numeric results without copying the simulated log", () => {
  const actual = readRunnerSummary({
    data: [{ Check: "" }, { Check: "NR" }, { Check: "Nil" }, { Check: "DUP" }],
    ConfCalls: new Set(["synthetic-a"]), ConfPrefix: new Set(["synthetic-prefix"]),
  });
  assert.deepEqual(actual, { qsoCount: 4, verifiedPoints: 1, score: 1, nrErrors: 1, nilErrors: 1 });
  assert.throws(() => readRunnerSummary({ data: [], ConfCalls: new Set(["impossible"]), ConfPrefix: new Set() }));
});

function fakeSurface() {
  const messages = [];
  const timers = new Map();
  const timeouts = new Map();
  const microtasks = [];
  const eventTarget = () => ({
    listeners: new Map(),
    addEventListener(type, fn) { this.listeners.set(type, fn); },
    removeEventListener(type) { this.listeners.delete(type); },
    dispatch(type, event = {}) { return this.listeners.get(type)?.(event); },
  });
  const parent = { postMessage(message, origin) { messages.push({ message, origin }); } };
  const win = {
    ...eventTarget(), parent, location: { origin: "https://example.invalid" },
    queueMicrotask(fn) { microtasks.push(fn); },
    setTimeout(fn) { const id = timeouts.size + 1; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  };
  const elements = new Map();
  const doc = {
    ...eventTarget(), visibilityState: "visible",
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { ...eventTarget(), disabled: false, textContent: "", value: "", classList: { remove() {} } });
      return elements.get(id);
    },
    querySelectorAll() { return [doc.getElementById("F1"), doc.getElementById("F2")]; },
  };
  const mode = doc.getElementById("mode");
  mode.options = ["single", "pileup", "wpx", "hst", "cwa", "awt", "cwt", "iaru"].map(value => ({
    value, remove() { mode.options = mode.options.filter(option => option !== this); },
  }));
  const ctx = {
    ...eventTarget(), state: "running", currentTime: 100,
    close() { this.state = "closed"; return Promise.resolve(); },
  };
  const view = {
    running: false, ctx, start_time: 100,
    calls: { calls: [["SYNTHETIC"]] },
    log: { data: [], ConfCalls: new Set(), ConfPrefix: new Set() },
    clock: doc.getElementById("clock"),
    _config: {
      _config: { farnsworth: true, contest_start_offset_min: 999 },
      update_dom() {
        for (const id of ["wpm", "time", "activity"]) doc.getElementById(id).value = String(this._config[id]);
        for (const id of ["qrm", "qrn", "qsb", "flutter", "lids"]) doc.getElementById(id).checked = this._config[id];
        mode.value = this._config.contest_id;
      },
      read_dom() {
        for (const id of ["wpm", "time", "activity"]) this._config[id] = doc.getElementById(id).value;
        for (const id of ["qrm", "qrn", "qsb", "flutter", "lids"]) this._config[id] = doc.getElementById(id).checked;
        this._config.contest_id = mode.value;
      },
      update() { this.read_dom(); },
      updateWPM(delta) {
        const wpm = Number(doc.getElementById("wpm").value) + delta;
        if (wpm >= 10 && wpm <= 60) { doc.getElementById("wpm").value = String(wpm); this.update(); }
      },
    },
    async startContest() { this.running = true; this.ContestNode = { ...eventTarget(), disconnect() {} }; },
    toggleNoRunFields() {}, stopTX() {}, formatTimer(value) { return String(value); },
  };
  const bridge = installRunnerBridge(view, { window: win, document: doc });
  return {
    view, win, doc, bridge, messages, timers, parent,
    async configure(command = runnerConfigureCommand(run()), overrides = {}) {
      await win.dispatch("message", { data: command, source: parent, origin: win.location.origin, ...overrides });
    },
    async clickRun(trusted = true, betweenListeners = false) {
      doc.getElementById("run").dispatch("click", { isTrusted: trusted });
      // Native browser events can perform a microtask checkpoint between
      // capture and upstream bubble listeners, unlike a simple fake dispatch.
      if (betweenListeners) for (const callback of microtasks.splice(0)) callback();
      await view.startContest();
      for (const callback of microtasks.splice(0)) callback();
      for (const [id, callback] of [...timeouts]) { timeouts.delete(id); callback(); }
    },
    tick() { for (const callback of [...timers.values()]) callback(); },
  };
}

test("adapter readiness needs trusted parent/source, settings apply before Run, and commands cannot start audio", async () => {
  const surface = fakeSurface();
  await surface.configure(undefined, { source: {} });
  await surface.configure(undefined, { origin: "https://other.invalid" });
  assert.equal(surface.messages.length, 0);
  await surface.configure();
  assert.equal(surface.messages[0].message.type, "ready");
  assert.equal(surface.messages[0].message.sequence, 0);
  assert.equal(surface.view.running, false);
  assert.equal(surface.view._config._config.wpm, "13");
  assert.equal(surface.view._config._config.time, "15");
  assert.equal(surface.view._config._config.contest_id, "single");
  assert.equal(surface.view._config._config.farnsworth, false);
  assert.equal(surface.view._config._config.contest_start_offset_min, 0);
  assert.equal(surface.doc.getElementById("wpm").disabled, false);
  for (const id of ["mode", "time", "activity", "qrm", "qrn", "qsb", "flutter", "lids"]) {
    assert.equal(surface.doc.getElementById(id).disabled, false, `${id} is editable before Run`);
  }
  assert.deepEqual(surface.doc.getElementById("mode").options.map(option => option.value), ["single", "wpx"]);
  assert.equal(surface.doc.getElementById("expert_config").disabled, true);
  assert.match(surface.doc.getElementById("expert_config").title, /not supported/);
  await surface.clickRun(false);
  assert.equal(surface.view.running, false);
  await surface.view.startContest();
  assert.equal(surface.view.running, false, "F1 auto-start is not a trusted Run click");
  await surface.clickRun();
  assert.equal(surface.view.running, true);
  assert.equal(surface.messages[1].message.type, "started");
  assert.equal(surface.messages[1].message.elapsedSeconds, 0);
  assert.deepEqual(surface.messages[1].message.settings, settings());
  assert.equal(surface.doc.getElementById("wpm").disabled, false);
  for (const id of ["mode", "time", "activity", "qrm", "qrn", "qsb", "flutter", "lids"]) {
    assert.equal(surface.doc.getElementById(id).disabled, true, `${id} is fixed after Run`);
  }
  surface.bridge.destroy();
});

test("adapter heartbeats report absolute engine time and a stopped frame cannot restart or change ID", async () => {
  const surface = fakeSurface();
  await surface.configure();
  await surface.clickRun();
  surface.view.ctx.currentTime = 130.5;
  surface.tick();
  surface.tick();
  assert.deepEqual(surface.messages.slice(-2).map(item => item.message.elapsedSeconds), [30.5, 30.5]);
  await surface.configure(runnerStopCommand(run()));
  assert.equal(surface.messages.at(-1).message.reason, "stopped");
  assert.equal(surface.messages.at(-1).message.elapsedSeconds, 30.5);
  assert.equal(surface.view.ctx.state, "closed");
  const count = surface.messages.length;
  await surface.configure(runnerConfigureCommand(createRunnerRun("synthetic-run-2", settings())));
  await surface.clickRun();
  assert.equal(surface.messages.length, count);
  assert.equal(surface.doc.getElementById("run").disabled, true);
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.equal(reduced.status, "stopped");
  assert.equal(reduced.elapsedSeconds, 30.5);
});

test("adapter captures edited fields at Run and uses the selected duration for engine completion", async () => {
  const surface = fakeSurface();
  await surface.configure();
  surface.doc.getElementById("wpm").value = "18";
  surface.doc.getElementById("time").value = "3";
  surface.doc.getElementById("mode").value = "wpx";
  surface.doc.getElementById("activity").value = "4";
  surface.doc.getElementById("qrm").checked = true;
  surface.doc.getElementById("qsb").checked = true;
  await surface.clickRun();
  assert.deepEqual(surface.messages[1].message.settings, {
    ...settings(), wpm: 18, durationSeconds: 180, mode: "WPX", activity: 4,
    conditions: { ...settings().conditions, qrm: true, qsb: true },
  });
  surface.view.ctx.currentTime = 281;
  surface.tick();
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.equal(reduced.status, "completed");
  assert.equal(reduced.elapsedSeconds, 180);
  assert.equal(runnerMeetsAssignment(reduced, task()), false);
  assert.match(runnerResultNote(reduced), /180 seconds; WPX Contest; 18 WPM starting speed; run duration 180 seconds; Activity 4; band conditions QRM, QSB/);
});

test("adapter speed input and native keyboard changes reach the engine and save timed changes", async () => {
  const surface = fakeSurface();
  await surface.configure();
  await surface.clickRun();
  surface.view.ctx.currentTime = 112.5;
  surface.doc.getElementById("wpm").value = "18";
  surface.view._config.update();
  assert.equal(surface.view._config._config.wpm, "18");
  assert.deepEqual(surface.messages.at(-1).message, event("speed", 2, 12.5, { wpm: 18 }));
  surface.view.ctx.currentTime = 123;
  surface.view._config.updateWPM(5);
  assert.equal(surface.view._config._config.wpm, "23");
  assert.deepEqual(surface.messages.at(-1).message, event("speed", 3, 23, { wpm: 23 }));
  const count = surface.messages.length;
  for (const value of ["", "0", "99", "12.5"]) {
    surface.doc.getElementById("wpm").value = value;
    surface.view._config.update();
  }
  assert.equal(surface.messages.length, count, "intermediate invalid input never reaches the engine or history");
  assert.equal(surface.view._config._config.wpm, "23");
  await surface.configure(runnerStopCommand(run()));
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.deepEqual(reduced.speedHistory, [
    { elapsedSeconds: 0, wpm: 13 }, { elapsedSeconds: 12.5, wpm: 18 }, { elapsedSeconds: 23, wpm: 23 },
  ]);
  assert.match(runnerResultNote(reduced), /speed changes: 18 WPM at 0:12, 23 WPM at 0:23/);
});

test("invalid setup can be corrected before Run instead of consuming a block or starting invalid audio", async () => {
  const surface = fakeSurface();
  await surface.configure();
  surface.doc.getElementById("time").value = "0";
  await surface.clickRun();
  assert.equal(surface.view.running, false);
  assert.equal(surface.messages.length, 1);
  assert.equal(surface.doc.getElementById("run").disabled, false);
  surface.doc.getElementById("time").value = "5";
  await surface.clickRun();
  assert.equal(surface.messages.at(-1).message.type, "started");
  assert.equal(surface.messages.at(-1).message.settings.durationSeconds, 300);
  surface.bridge.destroy();
});

test("a trusted Run click survives a native microtask checkpoint between capture and bubble", async () => {
  const surface = fakeSurface();
  await surface.configure();
  await surface.clickRun(true, true);
  assert.equal(surface.view.running, true);
  assert.equal(surface.messages.at(-1).message.type, "started");
  assert.equal(surface.messages.filter(item => item.message.type === "started").length, 1);
  surface.bridge.destroy();
});

test("adapter engine completion caps overshoot, emits results once, and works with the typed reducer", async () => {
  const surface = fakeSurface();
  await surface.configure();
  await surface.clickRun();
  surface.view.ctx.currentTime = 1000.3;
  surface.tick();
  assert.equal(surface.messages.at(-1).message.reason, "completed");
  assert.equal(surface.messages.at(-1).message.elapsedSeconds, 900);
  assert.equal(surface.timers.size, 0);
  surface.view.stopContest();
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.equal(reduced.status, "completed");
  assert.equal(surface.messages.filter(item => item.message.type === "results").length, 1);
  assert.ok(surface.messages.every(item => item.origin === "https://example.invalid"));
});

test("suspended audio ends the run with measured partial time, not a resumable accumulated timer", async () => {
  const surface = fakeSurface();
  await surface.configure();
  await surface.clickRun();
  surface.view.ctx.currentTime = 160;
  surface.view.ctx.state = "suspended";
  surface.view.ctx.dispatch("statechange");
  const last = surface.messages.at(-1).message;
  assert.equal(last.type, "error");
  assert.equal(last.code, "interrupted");
  assert.equal(last.elapsedSeconds, 60);
  assert.equal(surface.timers.size, 0);
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.equal(reduced.status, "error");
  assert.equal(reduced.elapsedSeconds, 60);
  await surface.clickRun();
  assert.equal(surface.messages.at(-1).message, last);
});

test("hiding the document stops an active run once even when parent stop and pagehide also arrive", async () => {
  const surface = fakeSurface();
  await surface.configure();
  surface.doc.visibilityState = "hidden";
  surface.doc.dispatch("visibilitychange");
  assert.equal(surface.messages.length, 1, "merely configured frames have no active run to interrupt");
  surface.doc.visibilityState = "visible";
  await surface.clickRun();
  surface.view.ctx.currentTime = 145.5;
  surface.doc.visibilityState = "hidden";
  surface.doc.dispatch("visibilitychange");
  await surface.configure(runnerStopCommand(run()));
  surface.win.dispatch("pagehide");
  assert.equal(surface.messages.filter(item => item.message.type === "results").length, 1);
  assert.equal(surface.messages.at(-1).message.reason, "stopped");
  assert.equal(surface.messages.at(-1).message.elapsedSeconds, 45.5);
  assert.equal(surface.view.ctx.state, "closed");
  const reduced = surface.messages.reduce((state, item) => reduceRunnerEvent(state, item.message), run());
  assert.equal(reduced.status, "stopped");
  assert.match(runnerResultNote(reduced), /45 seconds; Single Call; 13 WPM/);
  surface.bridge.destroy();
  assert.equal(surface.doc.listeners.has("visibilitychange"), false);
});
