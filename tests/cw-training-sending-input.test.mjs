import assert from "node:assert/strict";
import test from "node:test";
import { connectSendingKeyboard, requestSendingMidi } from "../src/lib/cw-training/sending-input.ts";

function event(type, properties = {}) {
  const value = new Event(type, { cancelable: true });
  for (const [key, property] of Object.entries(properties)) {
    Object.defineProperty(value, key, { value: property, configurable: true });
  }
  return value;
}

class Port extends EventTarget {
  constructor(id, name = "Vail Adapter", manufacturer = "Vail") {
    super();
    Object.assign(this, { id, name, manufacturer, state: "connected", sent: [], opens: 0, closes: 0 });
  }
  async open() { this.opens++; }
  async close() { this.closes++; }
  send(data) { this.sent.push([...data]); }
  note(down, at, note = 0, status = down ? 0x90 : 0x80, velocity = down ? 127 : 0) {
    this.dispatchEvent(event("midimessage", { data: new Uint8Array([status, note, velocity]), timeStamp: at }));
  }
}

function midiFixture() {
  const input = new Port("vail-input");
  const output = new Port("vail-output");
  const otherInput = new Port("other-input", "Other instrument");
  const otherOutput = new Port("other-output", "Other instrument");
  const access = Object.assign(new EventTarget(), {
    inputs: new Map([input, otherInput].map(port => [port.id, port])),
    outputs: new Map([output, otherOutput].map(port => [port.id, port])),
  });
  const requests = [];
  return {
    input, output, otherInput, otherOutput, access, requests,
    request: async options => { requests.push(options); return access; },
  };
}

function recorder() {
  const edges = [], interruptions = [], unsupported = [];
  return {
    edges, interruptions, unsupported,
    handlers: {
      onEdge: (down, at) => edges.push([down, at]),
      onInterrupted: reason => interruptions.push(reason),
      onUnsupported: reason => unsupported.push(reason),
    },
  };
}

function keyboardFixture() {
  const view = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: view, activeElement: null, hidden: false });
  const target = Object.assign(new EventTarget(), { ownerDocument: document });
  return {
    view, document, target,
    focus() { document.activeElement = target; target.dispatchEvent(event("focus")); },
    key(type, code, at, properties = {}) {
      const value = event(type, { code, timeStamp: at, repeat: false, ...properties });
      target.dispatchEvent(value);
      return value;
    },
  };
}

test("MIDI access is explicit, requests no SysEx, and leaves every output untouched before selection", async () => {
  const fixture = midiFixture();
  assert.deepEqual(fixture.requests, []);
  const session = await requestSendingMidi(fixture.request);
  assert.deepEqual(fixture.requests, [{ sysex: false }]);
  assert.deepEqual(session.inputs, [
    { id: "vail-input", name: "Vail Adapter" }, { id: "other-input", name: "Other instrument" },
  ]);
  assert.deepEqual(fixture.output.sent, []);
  assert.deepEqual(fixture.otherOutput.sent, []);
  session.dispose();
  assert.deepEqual(session.inputs, []);
  await assert.rejects(session.connect("vail-input", recorder().handlers), /closed/);
});

test("selected MIDI input captures timestamped keyed edges and touches only its paired output", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  const connection = await session.connect(fixture.input.id, capture.handlers);
  assert.deepEqual(fixture.output.sent, [[0xB0, 0, 0]]);
  assert.equal(fixture.input.opens, 1);
  assert.equal(fixture.output.opens, 1);
  assert.equal(fixture.otherInput.opens, 0);
  fixture.otherInput.note(true, 100);
  fixture.input.note(false, 100); // A stray release is not a mark.
  fixture.input.note(true, 123.5);
  fixture.input.note(true, 124); // A duplicated packet is not another edge.
  fixture.input.note(false, 183.5);
  fixture.input.note(true, 244);
  fixture.input.note(true, 424, 0, 0x90, 0); // Standard note-on with zero velocity is a release.
  fixture.input.note(true, 500, 0, 0x91); // Other channel.
  fixture.input.note(true, 600, 60); // Unrelated note.
  fixture.input.dispatchEvent(event("midimessage", { data: new Uint8Array([0x90]), timeStamp: 700 }));
  assert.deepEqual(capture.edges, [[true, 123.5], [false, 183.5], [true, 244], [false, 424]]);
  assert.deepEqual(capture.interruptions, []);
  connection.disconnect();
  connection.disconnect();
  session.dispose();
  fixture.input.note(true, 1000);
  assert.equal(capture.edges.length, 4);
  assert.deepEqual(fixture.output.sent, [[0xB0, 0, 0], [0xB0, 0, 127]], "only output mode changes, never persistent settings");
  assert.deepEqual(fixture.otherOutput.sent, []);
  assert.equal(fixture.input.closes, 1);
  assert.equal(fixture.output.closes, 1);
});

test("raw paddle notes are reported once and never mistaken for already-keyed elements", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  await session.connect(fixture.input.id, capture.handlers);
  fixture.input.note(true, 10, 1);
  fixture.input.note(false, 20, 1);
  fixture.input.note(true, 30, 2);
  fixture.input.note(true, 40, 0);
  assert.deepEqual(capture.edges, []);
  assert.equal(capture.unsupported.length, 1);
  assert.match(capture.unsupported[0], /raw paddle.*onboard keyer/);
  session.dispose();
});

test("physical MIDI removal interrupts once and discards a pending mark without a synthetic release", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  await session.connect(fixture.input.id, capture.handlers);
  fixture.input.note(true, 100);
  fixture.input.state = "disconnected";
  fixture.access.dispatchEvent(event("statechange"));
  fixture.access.dispatchEvent(event("statechange"));
  fixture.input.note(false, 1000000);
  assert.deepEqual(capture.edges, [[true, 100]]);
  assert.equal(capture.interruptions.length, 1);
  assert.match(capture.interruptions[0], /unfinished mark/);
  assert.deepEqual(fixture.output.sent, [[0xB0, 0, 0], [0xB0, 0, 127]]);
  session.dispose();
});

test("idle MIDI removal and output-only removal are reported, while unrelated devices do not interrupt", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  await session.connect(fixture.input.id, capture.handlers);
  fixture.otherInput.state = "disconnected";
  fixture.access.dispatchEvent(event("statechange"));
  assert.deepEqual(capture.interruptions, []);
  fixture.output.state = "disconnected";
  fixture.access.dispatchEvent(event("statechange"));
  assert.equal(capture.interruptions.length, 1);
  assert.deepEqual(capture.edges, []);
});

test("MIDI permission failure preserves its error without attempting fallback hardware configuration", async () => {
  const denial = new DOMException("Permission denied", "NotAllowedError");
  await assert.rejects(requestSendingMidi(async options => {
    assert.deepEqual(options, { sysex: false });
    throw denial;
  }), error => error === denial);
});

test("missing or ambiguous output pairing never opens or writes to any device", async () => {
  for (const problem of ["missing", "ambiguous", "manufacturer"]) {
    const fixture = midiFixture();
    if (problem === "missing") fixture.access.outputs.delete(fixture.output.id);
    if (problem === "ambiguous") fixture.access.outputs.set("duplicate", new Port("duplicate"));
    if (problem === "manufacturer") fixture.output.manufacturer = "Another manufacturer";
    const session = await requestSendingMidi(fixture.request);
    await assert.rejects(session.connect(fixture.input.id, recorder().handlers), /unique matching MIDI output/);
    assert.equal(fixture.input.opens, 0);
    assert.deepEqual(fixture.output.sent, []);
    assert.deepEqual(fixture.otherOutput.sent, []);
  }
});

test("a failed open and a disposed pending connection clean up without enabling MIDI mode", async () => {
  const fixture = midiFixture();
  fixture.input.open = async () => { throw new Error("USB unavailable"); };
  const session = await requestSendingMidi(fixture.request);
  await assert.rejects(session.connect(fixture.input.id, recorder().handlers), /USB unavailable/);
  assert.deepEqual(fixture.output.sent, []);
  assert.equal(fixture.output.closes, 1);
  let finish;
  fixture.input.open = () => new Promise(resolve => { finish = resolve; });
  const pending = session.connect(fixture.input.id, recorder().handlers);
  await Promise.resolve();
  session.dispose();
  finish();
  await assert.rejects(pending, /connection closed/);
  assert.deepEqual(fixture.output.sent, []);
});

test("MIDI reconnect avoids duplicate listeners and refuses a concurrent active connection", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  const first = await session.connect(fixture.input.id, capture.handlers);
  await assert.rejects(session.connect(fixture.input.id, capture.handlers), /Disconnect/);
  first.disconnect();
  await session.connect(fixture.input.id, capture.handlers);
  fixture.access.dispatchEvent(event("statechange"));
  fixture.input.note(true, 1);
  fixture.input.note(false, 61);
  assert.deepEqual(capture.edges, [[true, 1], [false, 61]]);
  session.dispose();
});

test("keyboard capture is scoped to the focused area and ignores fields and unrelated shortcuts", () => {
  const fixture = keyboardFixture();
  const capture = recorder();
  const connection = connectSendingKeyboard(fixture.target, capture.handlers);
  assert.equal(fixture.key("keydown", "ControlLeft", 1).defaultPrevented, false);
  fixture.focus();
  assert.equal(fixture.key("keydown", "KeyA", 2).defaultPrevented, false);
  assert.equal(fixture.key("keydown", "ControlLeft", 3, { target: new EventTarget() }).defaultPrevented, false);
  assert.equal(fixture.key("keydown", "ControlLeft", 10).defaultPrevented, true);
  fixture.key("keyup", "ControlLeft", 70);
  assert.deepEqual(capture.edges, [[true, 10], [false, 70]]);
  fixture.document.activeElement = { tagName: "TEXTAREA" };
  assert.equal(fixture.key("keydown", "ControlRight", 100).defaultPrevented, false);
  assert.equal(capture.edges.length, 2);
  connection.disconnect();
});

test("keyboard autorepeat and overlapping controls produce one mark until every key releases", () => {
  const fixture = keyboardFixture();
  const capture = recorder();
  const connection = connectSendingKeyboard(fixture.target, capture.handlers);
  fixture.focus();
  fixture.key("keydown", "ControlLeft", 100);
  fixture.key("keydown", "ControlLeft", 110, { repeat: true });
  fixture.key("keydown", "ControlLeft", 120);
  fixture.key("keydown", "ControlRight", 130);
  fixture.key("keyup", "ControlLeft", 150);
  fixture.key("keyup", "ControlRight", 160);
  fixture.key("keyup", "ControlRight", 170);
  assert.deepEqual(capture.edges, [[true, 100], [false, 160]]);
  connection.disconnect();
  assert.deepEqual(capture.interruptions, [], "stopping after a complete mark is a clean disconnect");
});

test("disconnecting keyboard capture mid-mark interrupts once, including reentrant cleanup", () => {
  const fixture = keyboardFixture();
  const capture = recorder();
  const connection = connectSendingKeyboard(fixture.target, {
    ...capture.handlers,
    onInterrupted(reason) { capture.interruptions.push(reason); connection.disconnect(); },
  });
  fixture.focus();
  fixture.key("keydown", "ControlLeft", 20);
  connection.disconnect();
  fixture.key("keyup", "ControlLeft", 1000000);
  assert.deepEqual(capture.edges, [[true, 20]]);
  assert.equal(capture.interruptions.length, 1);
});

test("blur discards held keys, does not synthesize a long mark, and permits a fresh focused attempt", () => {
  const fixture = keyboardFixture();
  const capture = recorder();
  const connection = connectSendingKeyboard(fixture.target, capture.handlers);
  fixture.focus();
  fixture.key("keydown", "ControlRight", 100);
  fixture.target.dispatchEvent(event("blur"));
  fixture.view.dispatchEvent(event("blur"));
  fixture.key("keyup", "ControlRight", 1000000);
  fixture.key("keydown", "ControlLeft", 1000001);
  assert.deepEqual(capture.edges, [[true, 100]]);
  assert.equal(capture.interruptions.length, 1);
  fixture.focus();
  fixture.key("keydown", "ControlLeft", 1000010);
  fixture.key("keyup", "ControlLeft", 1000070);
  assert.deepEqual(capture.edges.slice(1), [[true, 1000010], [false, 1000070]]);
  connection.disconnect();
  const afterDisconnect = capture.interruptions.length;
  connection.disconnect();
  fixture.focus();
  fixture.key("keydown", "ControlLeft", 2000000);
  fixture.target.dispatchEvent(event("blur"));
  assert.equal(capture.edges.length, 3);
  assert.equal(capture.interruptions.length, afterDisconnect);
});

test("hiding the keyboard page interrupts capture even between marks", () => {
  const fixture = keyboardFixture();
  const capture = recorder();
  const connection = connectSendingKeyboard(fixture.target, capture.handlers);
  fixture.focus();
  fixture.document.hidden = true;
  fixture.document.dispatchEvent(event("visibilitychange"));
  assert.equal(capture.interruptions.length, 1);
  assert.deepEqual(capture.edges, []);
  connection.disconnect();
});

test("invalid and reversed MIDI timestamps are interruptions rather than misleading durations", async () => {
  const fixture = midiFixture();
  const capture = recorder();
  const session = await requestSendingMidi(fixture.request);
  await session.connect(fixture.input.id, capture.handlers);
  fixture.input.note(true, 100);
  fixture.input.note(false, 90);
  fixture.input.note(true, NaN);
  fixture.input.note(true, 200);
  fixture.input.note(false, 260);
  assert.deepEqual(capture.edges, [[true, 100], [true, 200], [false, 260]]);
  assert.equal(capture.interruptions.length, 2);
  session.dispose();
});
