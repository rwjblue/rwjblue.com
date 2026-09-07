import assert from "node:assert/strict";
import test from "node:test";
import {
  isMorseRunner,
  morseRunnerSetup,
  MORSE_RUNNER_BASICS_URL,
  MORSE_RUNNER_DOWNLOAD_URL,
  MORSE_RUNNER_GUIDE_URL,
} from "../src/lib/cw-training/morse-runner.ts";

const task = (overrides = {}) => ({
  id: "synthetic-simulator",
  kind: "simulator",
  title: "Morse Runner exercise",
  instructions: "Use the assigned simulator settings.",
  sourceUrl: "https://example.invalid/assignment",
  speedWpm: 13,
  minutes: 15,
  ...overrides,
});

test("Morse Runner setup is gated to the named simulator, not audio or other tools", () => {
  assert.equal(isMorseRunner(task()), true);
  assert.equal(isMorseRunner(task({ title: "Simulator exercise", instructions: "Practice with Morse-Runner." })), true);
  for (const candidate of [
    task({ kind: "audio" }),
    task({ kind: "sending" }),
    task({ kind: "icr" }),
    task({ title: "RufzXP exercise", instructions: "Practice with the assigned callsign simulator." }),
  ]) {
    assert.equal(isMorseRunner(candidate), false);
    assert.equal(morseRunnerSetup(candidate), undefined);
  }
});

test("the CQ WPX contest selector or an abbreviated title does not imply WPX Competition mode", () => {
  const setup = morseRunnerSetup(task({
    title: "Morse Runner WPX exercise",
    instructions: "Select the CQ WPX contest. Follow the assigned run settings.",
  }));
  assert.match(setup.mode, /Run mode specified in the original exercise instructions/);
  assert.doesNotMatch(setup.mode, /WPX Competition|Single Calls/);
});

test("explicit Single Calls remains distinct from the CQ WPX contest selector", () => {
  for (const instructions of [
    "Select the CQ WPX contest, then choose Single Calls in the Run menu.",
    "Use single-calls for this synthetic exercise.",
    "Use the same settings as Session 1 for this synthetic exercise.",
  ]) {
    const setup = morseRunnerSetup(task({ instructions }));
    assert.match(setup.mode, /Run menu: Single Calls/);
    assert.match(setup.mode, /separate from the contest selector/);
    assert.doesNotMatch(setup.mode, /WPX Competition/);
  }
});

test("explicit WPX Competition and activity settings are extracted from instructions or settings", () => {
  for (const candidate of [
    task({ instructions: "Use WPX Competition with Activity level 2." }),
    task({ settings: "WPX Competition; Activity 4." }),
  ]) {
    const setup = morseRunnerSetup(candidate);
    assert.match(setup.mode, /Run menu: WPX Competition/);
    assert.match(setup.mode, /CQ \(F1\)/);
    assert.match(setup.run, /Activity [24]$/);
  }
  assert.match(morseRunnerSetup(task({ instructions: "WPX Competition; Activity level 2." })).run, /Activity 2$/);
  assert.match(morseRunnerSetup(task({ settings: "WPX Competition; Activity 4." })).run, /Activity 4$/);
  assert.doesNotMatch(morseRunnerSetup(task({ instructions: "Use WPX Competition." })).run, /Activity/);
});

test("all assigned course speeds and unusual durations are preserved instead of guide defaults", () => {
  for (const speedWpm of [10, 13, 15, 18, 20, 25]) {
    for (const minutes of [7.5, 17, 23]) {
      const setup = morseRunnerSetup(task({ speedWpm, minutes }));
      assert.equal(setup.run, `${speedWpm} WPM starting speed · ${minutes} uninterrupted minutes`);
    }
  }
});

test("missing or invalid speed and duration defer to the assignment without inventing numbers", () => {
  for (const missing of [undefined, 0, -1, NaN, Infinity]) {
    assert.equal(morseRunnerSetup(task({ speedWpm: missing, minutes: missing })).run, "the assigned starting speed · the full assigned duration");
  }
  assert.equal(morseRunnerSetup(task({ speedWpm: undefined, minutes: 9 })).run, "the assigned starting speed · 9 uninterrupted minutes");
  assert.equal(morseRunnerSetup(task({ speedWpm: 18, minutes: undefined })).run, "18 WPM starting speed · the full assigned duration");
});

test("an unknown run mode defers to original instructions and setup never mutates the task", () => {
  const candidate = Object.freeze(task({ settings: "Use the advisor's custom configuration." }));
  const before = JSON.stringify(candidate);
  const setup = morseRunnerSetup(candidate);
  assert.equal(setup.mode, "Choose the Run mode specified in the original exercise instructions.");
  assert.equal(JSON.stringify(candidate), before);
});

test("guide, basics, and download links use the intended official HTTPS destinations", () => {
  assert.equal(MORSE_RUNNER_GUIDE_URL, "https://cwops.org/wp-content/uploads/2025/01/Morse-Runner-CE.pdf");
  assert.equal(MORSE_RUNNER_BASICS_URL, "https://cwops.org/cwa/Using%20Morse%20Runner.pdf");
  assert.equal(MORSE_RUNNER_DOWNLOAD_URL, "https://github.com/w7sst/MorseRunner/releases");
  for (const link of [MORSE_RUNNER_GUIDE_URL, MORSE_RUNNER_BASICS_URL, MORSE_RUNNER_DOWNLOAD_URL]) {
    const url = new URL(link);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
  }
});

test("competition warns about the external timer and conditions without changing assignment duration", () => {
  const competition = morseRunnerSetup(task({ instructions: "WPX Competition; Activity 2." }));
  assert.match(competition.run, /15 uninterrupted minutes/);
  assert.match(competition.conditions, /enables band conditions.*reset its timer to 60 minutes/);
  assert.match(competition.conditions, /Stop manually at the assigned duration.*instructor/);
  assert.doesNotMatch(competition.conditions, /unchecked/);
  const singleCalls = morseRunnerSetup(task({ instructions: "Practice in Single Calls mode." }));
  assert.match(singleCalls.conditions, /unchecked unless.*instructor/);
  assert.doesNotMatch(singleCalls.conditions, /60 minutes|Competition/);
  assert.equal(morseRunnerSetup(task()).conditions, "Use the band conditions specified in the original instructions.");
});
