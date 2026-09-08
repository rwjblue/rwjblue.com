import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isMorseRunner,
  morseRunnerSetup,
  MORSE_RUNNER_BASICS_URL,
  MORSE_RUNNER_DOWNLOAD_URL,
  MORSE_RUNNER_GUIDE_URL,
  WEB_MORSE_RUNNER_URL,
  WEB_MORSE_RUNNER_HELP_URL,
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
  assert.match(setup.mode, /Mode that matches the original exercise instructions/);
  assert.doesNotMatch(setup.mode, /WPX Contest|Single Call|Run menu/);
});

test("explicit Single Calls remains distinct from the CQ WPX contest selector", () => {
  for (const instructions of [
    "Select the CQ WPX contest, then choose Single Calls in the Run menu.",
    "Use single-calls for this synthetic exercise.",
    "Use the same settings as Session 1 for this synthetic exercise.",
  ]) {
    const setup = morseRunnerSetup(task({ instructions }));
    assert.match(setup.mode, /Mode: Single Call, then Run/);
    assert.match(setup.mode, /Stations call you automatically/);
    assert.doesNotMatch(setup.mode, /WPX Contest|Run menu/);
  }
});

test("explicit WPX Competition and activity settings are extracted from instructions or settings", () => {
  for (const candidate of [
    task({ instructions: "Use WPX Competition with Activity level 2." }),
    task({ settings: "WPX Competition; Activity 4." }),
  ]) {
    const setup = morseRunnerSetup(candidate);
    assert.match(setup.mode, /Mode: WPX Contest, then Run/);
    assert.doesNotMatch(setup.mode, /Run menu/);
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
      assert.equal(setup.run, `${speedWpm} WPM starting speed · ${minutes} minutes total across saved runs`);
    }
  }
});

test("missing or invalid speed and duration defer to the assignment without inventing numbers", () => {
  for (const missing of [undefined, 0, -1, NaN, Infinity]) {
    assert.equal(morseRunnerSetup(task({ speedWpm: missing, minutes: missing })).run, "the assigned starting speed · the total assigned practice time");
  }
  assert.equal(morseRunnerSetup(task({ speedWpm: undefined, minutes: 9 })).run, "the assigned starting speed · 9 minutes total across saved runs");
  assert.equal(morseRunnerSetup(task({ speedWpm: 18, minutes: undefined })).run, "18 WPM starting speed · the total assigned practice time");
});

test("an unknown run mode defers to original instructions and setup never mutates the task", () => {
  const candidate = Object.freeze(task({ settings: "Use the advisor's custom configuration." }));
  const before = JSON.stringify(candidate);
  const setup = morseRunnerSetup(candidate);
  assert.equal(setup.mode, "Choose the Mode that matches the original exercise instructions; ask your instructor if unclear.");
  assert.equal(JSON.stringify(candidate), before);
});

test("web app, help, guide, basics, and download links use the intended official HTTPS destinations", () => {
  assert.equal(WEB_MORSE_RUNNER_URL, "https://fritzsche.github.io/WebMorseRunner/");
  assert.equal(WEB_MORSE_RUNNER_HELP_URL, "https://github.com/fritzsche/WebMorseRunner#usage");
  assert.equal(MORSE_RUNNER_GUIDE_URL, "https://cwops.org/wp-content/uploads/2025/01/Morse-Runner-CE.pdf");
  assert.equal(MORSE_RUNNER_BASICS_URL, "https://cwops.org/cwa/Using%20Morse%20Runner.pdf");
  assert.equal(MORSE_RUNNER_DOWNLOAD_URL, "https://github.com/w7sst/MorseRunner/releases");
  for (const link of [WEB_MORSE_RUNNER_URL, WEB_MORSE_RUNNER_HELP_URL, MORSE_RUNNER_GUIDE_URL, MORSE_RUNNER_BASICS_URL, MORSE_RUNNER_DOWNLOAD_URL]) {
    const url = new URL(link);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
  }
});

test("Web WPX Contest keeps the selected duration without imposing desktop timer or band overrides", () => {
  const competition = morseRunnerSetup(task({ instructions: "WPX Competition; Activity 2." }));
  assert.match(competition.run, /15 minutes total across saved runs/);
  assert.doesNotMatch(competition.run, /uninterrupted/);
  assert.match(competition.conditions, /keeps your selected duration/);
  assert.match(competition.conditions, /does not force band conditions on/);
  assert.match(competition.conditions, /assigned activity level.*instructor's band settings/);
  assert.doesNotMatch(competition.conditions, /60 minutes|enables band conditions|reset its timer/);
  assert.doesNotMatch(competition.conditions, /unchecked/);
  const singleCalls = morseRunnerSetup(task({ instructions: "Practice in Single Calls mode." }));
  assert.match(singleCalls.conditions, /unchecked unless.*instructor/);
  assert.doesNotMatch(singleCalls.conditions, /60 minutes|Competition/);
  assert.equal(morseRunnerSetup(task()).conditions, "Use the band conditions specified in the original instructions.");
});

test("the client chooses the primary web link before any imported CE resource URL fallback", () => {
  const client = readFileSync(new URL("../src/lib/cw-training/client.ts", import.meta.url), "utf8");
  assert.match(client, /const runner = morseRunnerSetup\(active\.task\)/);
  // Imported course records can still carry a desktop CE resource URL. This
  // branch must choose the web app from the task before consulting that URL.
  assert.match(client, /\$\("training-focus-resource"\)\.innerHTML = runner[\s\S]*?link\(WEB_MORSE_RUNNER_URL, "Open standalone Web Morse Runner", "training-button"\)[\s\S]*?: active\.resource\?\.unresolved/);
  assert.match(client, /link\(active\.resource\?\.url \|\|/);
});
