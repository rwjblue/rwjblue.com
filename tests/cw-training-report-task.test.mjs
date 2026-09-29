import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, realpathSync, readFileSync, writeFileSync, statSync, existsSync, readdirSync, symlinkSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { prepareBackup, copyMeasurement } from "../scripts/cw-training/report-backup.ts";
import { prepareReport, createHandoff, recordSubmission, latestBackup } from "../scripts/cw-training/report.ts";
import { REPORT_FIELDS } from "../src/lib/cw-training/report-fields.ts";

const date = "2026-10-01";
const at = "2026-10-01T14:00:00Z";
const options = { session: 8, reportDate: date };
const entry = (id, extra = {}) => ({ id, date, kind: "icr", minutes: 1, createdAt: at, notes: "Private reflection", metadata: {}, ...extra });
const copy = (extra = {}) => ({ version: 1, scoringVersion: "native-copy-v2", status: "completed", createdAt: at, updatedAt: "2026-10-01T14:01:00Z",
  revealCount: 0, recipe: { mode: "groups", groupKind: "letters", groupLength: 3, characterWpm: 25, effectiveWpm: 15 },
  targets: ["ABC DEF"], trials: [{ answer: "ABC DEF", effectiveWpm: 15, characterWpm: 25, correct: true, points: 0 }], ...extra });
const backup = (sessions = [], extra = {}) => ({ format: "cwa-training-tracker", version: 1, evidenceVersion: 1, exportedAt: at,
  profile: { callsign: "W1TEST", displayName: "Alice Example", timezone: "America/New_York", firstClassDate: "2026-09-07", classDays: [1, 4] }, sessions,
  legacy: { data: { snapshot: { course: { timezone: "America/New_York", meetings: [{ session: 8, startsAt: "2026-10-01T19:30:00Z" }],
    assignments: ["2026-09-29", "2026-09-30", date].map((date, index) => ({ id: `day-${index}`, date, session: 8, tasks: [] })) }, reports: [], attempts: [], lcwo: { runs: [] } } } }, ...extra });
const result = sessions => prepareBackup(backup(sessions), options);
const withDirectory = (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cw-report-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));

test("group evidence preserves scoring versions, counts extra groups, and has no 256-group cutoff", () => {
  const v2 = copy({ trials: [{ ...copy().trials[0], answer: "ABC DEF XYZ" }] });
  assert.equal(copyMeasurement(v2).result.errorPercent, 50);
  assert.equal(copyMeasurement({ ...v2, scoringVersion: "native-copy-v1" }).result.errorPercent, 66.6);
  const sent = Array(300).fill("ABC").join(" ");
  const many = copy({ targets: [sent], trials: [{ ...copy().trials[0], answer: `${sent} XYZ` }] });
  assert.equal(copyMeasurement(many).result.errorPercent, 0.3);
  assert.throws(() => copyMeasurement({ ...v2, scoringVersion: "future" }), /version/);
});

test("native words use actual successful speeds and points from one attempt, with partial/reveal warnings", () => {
  const words = copy({ status: "abandoned", revealCount: 1,
    recipe: { mode: "words", adaptive: true, maxSpeed: 50, maxWordLength: 3 }, targets: ["AB", "CAT", "DOG"],
    trials: [{ answer: "A B", effectiveWpm: 15, characterWpm: 25, correct: true, points: 999 },
      { answer: "NO", effectiveWpm: 16, characterWpm: 25, correct: false, points: 0 }] });
  const measured = copyMeasurement(words);
  assert.deepEqual(measured.result, { kind: "words", speedWpm: 15, maximumLength: 3, score: 32, errorCount: 1 });
  assert.equal(measured.warnings.length, 2);
  const later = { ...words, updatedAt: "2026-10-01T16:00:00Z", targets: ["CAT"], trials: [{ answer: "CAT", effectiveWpm: 20, characterWpm: 25, correct: true, points: 63 }] };
  const draft = result([entry("first", { metadata: { copyAttempt: words } }), entry("last", { metadata: { copyAttempt: later } })]);
  assert.equal(draft.answers.wordsScore, "63");
  assert.equal(draft.answers.wordsWpm, "20");
  assert.deepEqual(draft.sourceAttemptIds, ["last"]);
  assert.equal(copyMeasurement({ ...later, recipe: { ...later.recipe, mode: "callsigns" } }).result.kind, "callsign");
});

test("group averages match actual settings, include provenance, and do not mutate the backup", () => {
  const group = (id, time, recipe, answer) => entry(id, { metadata: { copyAttempt: copy({ updatedAt: time,
    recipe: { ...copy().recipe, ...recipe }, trials: [{ ...copy().trials[0], answer }] }) } });
  const data = backup([
    group("first", at, {}, "ABC DEZ"), group("latest", "2026-10-01T16:00:00Z", {}, "ABC DEF"),
    group("different-speed", "2026-10-01T12:00:00Z", { effectiveWpm: 13 }, "ZZZ ZZZ"),
    group("different-length", "2026-10-01T12:00:00Z", { groupLength: 2 }, "ZZZ ZZZ"),
  ]);
  data.sessions[2].metadata.copyAttempt.trials[0].effectiveWpm = 13;
  const original = structuredClone(data), draft = prepareBackup(data, options);
  assert.equal(draft.answers.lettersErrorPercent, "8.3");
  assert.equal(draft.answers.lettersLength, "3");
  assert.deepEqual(new Set(draft.sourceAttemptIds), new Set(["first", "latest"]));
  assert.deepEqual(data, original);
});

test("unanswered, mixed, and plaintext rounds never fill instructor fields; random length stays blank", () => {
  assert.equal(copyMeasurement(copy({ status: "active" })), undefined);
  assert.equal(copyMeasurement(copy({ trials: [] })), undefined);
  assert.equal(copyMeasurement(copy({ recipe: { ...copy().recipe, groupKind: "mixed" } })), undefined);
  assert.equal(copyMeasurement(copy({ recipe: { ...copy().recipe, mode: "plaintext" } })), undefined);
  const measured = copyMeasurement(copy({ recipe: { ...copy().recipe, groupLength: "random" } }));
  assert.equal(measured.result.groupLength, undefined);
  assert.match(measured.warnings[0], /manual/);
  const none = copyMeasurement(copy({ recipe: { mode: "words", adaptive: false, maxWordLength: 3 }, targets: ["ABC"],
    trials: [{ ...copy().trials[0], answer: "XYZ" }] }));
  assert.equal(none.result.speedWpm, undefined);
  assert.equal(none.result.score, 0);
  assert.equal(none.result.errorCount, 1);
});

test("Runner uses highest actual verified points, speed changes, conditions, and saved date", () => {
  const runner = (points, speed, seconds) => ({ version: 1, type: "runner", run: {
    settings: { mode: "SingleCall", wpm: speed, durationSeconds: seconds, conditions: { qrm: true } },
    status: "completed", elapsedSeconds: seconds, runStartedAt: "2026-10-02T14:00:00Z", runEndedAt: "2026-10-02T14:05:00Z",
    speedHistory: [{ elapsedSeconds: 0, wpm: speed }, { elapsedSeconds: 20, wpm: speed + 2 }], summary: { verifiedPoints: points, score: 999 } } });
  const draft = result([entry("better", { kind: "simulator", metadata: { evidence: runner(15, 20, 300) } }),
    entry("longer", { kind: "simulator", metadata: { evidence: runner(10, 15, 600) } })]);
  assert.equal(draft.answers.runnerVerifiedPoints, "15");
  assert.equal(draft.answers.runnerWpm, "20");
  assert.deepEqual(draft.sourceAttemptIds, ["better"]);
  assert.match(draft.warnings.join(" "), /5-minute.*20, 22 WPM/);
});

test("actual audio fills file/speed fields; assigned URLs, difficulty and private prose do not", () => {
  const draft = result([entry("audio", { kind: "listening", metadata: { scratchpad: "Learned: rig\nPrivate prose", evidence: {
    version: 1, type: "timed", measurement: { seconds: 70, recallSeconds: 10 }, recordings: [
      { url: "https://cwa.cwops.org/wp-content/uploads/WD302_18.mp3", effectiveWpm: 18, speedWpm: 15, seconds: 60 },
      { url: "https://cwa.cwops.org/wp-content/uploads/PR302_15.mp3", effectiveWpm: 15, seconds: 0 },
    ] } } }), entry("assigned", { metadata: { assignedRecordingUrl: "https://example.com/WD999_30.mp3", difficulty: "easy" } })]);
  assert.equal(draft.answers.shortWordsFiles, "WD302 18");
  assert.equal(draft.answers.shortPhrasesFiles, "");
  assert.equal(draft.answers.shortWordsRating, "");
  assert.equal(draft.answers.learnedWords, "rig");
  assert.doesNotMatch(JSON.stringify(draft.answers), /Private|999/);
});

test("active exported history controls legacy deduplication, deletions, and class/window exclusions", () => {
  const lcwo = { id: "lcwo-1", kind: "letters", sourceType: "groups", recordedAt: at, characterWpm: 25, effectiveWpm: 15, accuracyPercent: 90 };
  const data = backup([entry("legacy", { metadata: { legacyAttempt: { id: "old-id", taskId: "words", startedAt: at, endedAt: at,
    lcwoResult: { kind: "words", score: 120, speedWpm: 13, maximumLength: 3, errorCount: 0 } } } }),
    entry("lcwo", { metadata: { legacyLcwoRun: lcwo } }),
    entry("outside", { date: "2026-09-28", metadata: { copyAttempt: { version: 99 } } }),
    entry("class", { context: "class", metadata: { copyAttempt: { version: 99 } } }),
  ]);
  data.legacy.data.snapshot.attempts = [{ id: "deleted", lcwoResult: { kind: "words", score: 99999 } }];
  data.legacy.data.snapshot.lcwo.runs = [lcwo, { ...lcwo, id: "deleted-lcwo", kind: "figures" }];
  const draft = prepareBackup(data, options);
  assert.equal(draft.answers.wordsScore, "120");
  assert.equal(draft.answers.lettersErrorPercent, "10");
  assert.equal(draft.answers.figuresErrorPercent, "");
  assert.deepEqual(draft.sourceAttemptIds, ["legacy"]);
  assert.deepEqual(draft.sourceLcwoIds, ["lcwo-1"]);
});

test("backup validation rejects duplicate IDs, future versions and invalid dates", () => {
  assert.throws(() => result([entry("same"), entry("same")]), /duplicate/);
  assert.throws(() => prepareBackup({ ...backup(), version: 2 }, options), /supported/);
  assert.throws(() => result([entry("bad", { date: "2026-02-30" })]), /invalid/);
  assert.throws(() => prepareBackup(backup(), { ...options, fromDate: "2026-10-02", toDate: date }), /ordered/);
});

test("profile-only backups derive class windows and defaults without archived curriculum", () => {
  const data = backup([], { legacy: undefined });
  const draft = prepareBackup(data, { reportDate: date });
  assert.equal(draft.session, 8);
  assert.equal(draft.fromDate, "2026-09-29");
  assert.equal(draft.toDate, date);
  assert.equal(draft.answers.firstName, "Alice");
  data.profile.classDays = [9];
  assert.throws(() => prepareBackup(data, { reportDate: date }), /weekdays/);
});

test("private workflow retains deliberate edits/blanks, freezes handoffs, and confirms exact snapshots", t => {
  const root = withDirectory(t), file = join(root, "backup.json"), directory = join(root, "private");
  writeJson(file, backup([entry("learned", { metadata: { scratchpad: "Learned: rig" } })]));
  const bytes = readFileSync(file, "utf8");
  const draft = prepareReport(file, directory, options);
  assert.equal(draft.answers.learnedWords, "rig");
  assert.throws(() => createHandoff(directory, 8), /scalesRating/);
  const overrides = join(directory, "answers-session-8.json");
  writeJson(overrides, { scalesRating: "Good", problems: "", wordsErrors: "0" });
  const edited = prepareReport(file, directory, options);
  assert.equal(edited.answers.wordsErrors, "0");
  assert.equal(edited.answers.problems, "");
  const handoff = createHandoff(directory, 8);
  assert.equal(existsSync(join(directory, "submitted")), false);
  assert.equal(prepareReport(file, directory, options).answers.learnedWords, "rig");
  writeJson(overrides, { scalesRating: "Fair", learnedWords: "new word" });
  assert.throws(() => createHandoff(directory, 8), /changed/);
  const later = prepareReport(file, directory, options);
  assert.equal(later.answers.scalesRating, "Fair");
  const confirmed = recordSubmission(directory, handoff.id);
  assert.equal(confirmed.report.answers.scalesRating, "Good");
  assert.equal(confirmed.report.answers.learnedWords, "rig");
  assert.equal(confirmed.report.status, "submitted");
  assert.deepEqual(recordSubmission(directory, handoff.id), confirmed);
  writeJson(overrides, { scalesRating: "Good" });
  assert.equal(prepareReport(file, directory, options).answers.learnedWords, "");
  assert.equal(readFileSync(file, "utf8"), bytes);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.equal(statSync(join(directory, "draft-session-8.json")).mode & 0o777, 0o600);
  const url = new URL(readFileSync(join(directory, "handoffs", `${handoff.id}.url`), "utf8").trim());
  assert.equal(url.pathname.endsWith("/viewform"), true);
  assert.equal(url.searchParams.get(`entry.${REPORT_FIELDS.find(field => field.key === "scalesRating").entryId}`), "Good");
  assert.doesNotMatch(JSON.stringify(edited), /Private reflection/);
});

test("matching archived manual edits survive first prepare, including blank answers", t => {
  const root = withDirectory(t), file = join(root, "backup.json"), directory = join(root, "private"), data = backup();
  data.legacy.data.snapshot.reports = [{ session: 8, status: "draft", createdAt: at, editedAnswerKeys: ["scalesRating", "problems", "reportDate"],
    answers: { scalesRating: "Good", problems: "", reportDate: "2026-09-01", wordsScore: "9999" } }];
  writeJson(file, data);
  const draft = prepareReport(file, directory, options);
  assert.equal(draft.answers.scalesRating, "Good");
  assert.equal(draft.answers.problems, "");
  assert.equal(draft.answers.wordsScore, "");
  assert.equal(draft.reportDate, date);
});

test("unknown manual keys and invalid ratings fail before a form can open", t => {
  const root = withDirectory(t), file = join(root, "backup.json"), directory = join(root, "private");
  writeJson(file, backup()); prepareReport(file, directory, options);
  const path = join(directory, "answers-session-8.json");
  writeJson(path, { scalesRating: "Excellent" });
  assert.throws(() => prepareReport(file, directory, options), /listed ratings/);
  writeJson(path, { surprise: "Private note" });
  assert.throws(() => prepareReport(file, directory, options), /Unknown/);
  assert.throws(() => recordSubmission(directory, "../../anything"), /UUID/);
});

test("private storage rejects symlinks instead of overwriting unrelated files", t => {
  const root = withDirectory(t), file = join(root, "backup.json"), directory = join(root, "private");
  writeJson(file, backup()); prepareReport(file, directory, options);
  const draftPath = join(directory, "draft-session-8.json");
  rmSync(draftPath); symlinkSync(file, draftPath);
  assert.throws(() => prepareReport(file, directory, options), /symlinks/);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).format, "cwa-training-tracker");
});

test("auto-discovery chooses only matching backup files across both Downloads locations", t => {
  const root = withDirectory(t);
  const directory = join(root, "Downloads"); mkdirSync(directory);
  writeJson(join(directory, "unrelated-private.json"), {});
  assert.throws(() => latestBackup(root), /No Companion/);
  writeJson(join(directory, "cw-academy-backup-2026-10-01.json"), {});
  assert.equal(latestBackup(root), join(directory, "cw-academy-backup-2026-10-01.json"));
});

test("CLI help and malformed commands never open a browser or leak personal answers", () => {
  const script = "scripts/cw-training/report.ts";
  const help = spawnSync(process.execPath, ["--experimental-strip-types", script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /never submits/i);
  const invalid = spawnSync(process.execPath, ["--experimental-strip-types", script, "open", "--session", "0"], { encoding: "utf8" });
  assert.equal(invalid.status, 1); assert.doesNotMatch(invalid.stdout + invalid.stderr, /entry\./);
});
