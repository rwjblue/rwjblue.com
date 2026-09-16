import assert from "node:assert/strict";
import test from "node:test";
import { REPORT_FIELDS, REPORT_FORM_URL, buildPrefilledReportUrl, validateReportAnswers } from "../src/lib/cw-training/report-fields.ts";
import { applyReportSuggestions, buildReportDraft, learnedWordsFromScratchpad, legacyAudioResults, legacyRunnerResult,
  reportAttemptsInWindow, reportLcwoRunsInWindow, reportWindowForSession, selectReportRunner } from "../src/lib/cw-training/report.ts";

const course = () => ({
  timezone: "America/New_York", resources: [],
  meetings: [{ session: 2, startsAt: "2026-09-10T23:00:00.000Z", endsAt: "2026-09-11T00:00:00.000Z" }],
  assignments: [8, 9, 10].map((day, index) => ({
    id: `day-${day}`, session: 2, day: index + 1, date: `2026-09-${day.toString().padStart(2, "0")}`,
    tasks: index ? [] : [
      { id: "scales", kind: "sending", title: "Scales", instructions: "Daily scales." },
      { id: "words", kind: "audio", title: "WD201-10", instructions: "Short words." },
      { id: "prefix", kind: "audio", title: "DIS4-10", instructions: "Prefix practice." },
      { id: "suffix", kind: "audio", title: "ING4-10", instructions: "Suffix practice." },
    ],
  })),
});
const options = (extra = {}) => ({ session: 2, fromDate: "2026-09-08", toDate: "2026-09-10", reportDate: "2026-09-10", ...extra });
const attempt = (id, extra = {}) => ({
  id, assignmentId: "day-8", taskId: "runner", context: "practice", startedAt: "2026-09-08T14:00:00.000Z",
  endedAt: "2026-09-08T14:10:00.000Z", activeSeconds: 600, completed: false, ...extra,
});
const runner = (extra = {}) => ({
  version: 1, mode: "SingleCall", wpm: 15, durationSeconds: 900, elapsedSeconds: 600,
  status: "stopped", verifiedPoints: 10, qsoCount: 12, score: 50, speeds: [15], conditions: false, source: "embedded", ...extra,
});
const audio = (title, speedWpm, extra = {}) => ({
  title, url: `https://cwa.cwops.org/wp-content/uploads/${title.replace("-", "_")}.mp3`, speedWpm,
  activeSeconds: 60, completedPasses: 1, ...extra,
});
const draft = (attempts, extra = {}) => buildReportDraft(course(), attempts, options(extra));
const required = () => ({ callsign: "N1RWJ", firstName: "Robert", session: "2", reportDate: "2026-09-10", scalesRating: "Good" });

test("CWT sessions fill report answers in order, deduplicate entries, and keep private notes out", () => {
  const first = attempt("cwt-first", { taskId: "other:cwt", review: true,
    cwtResult: { qsoCount: 12, workedCallsigns: "W1AAA\nK2BBB", workedNames: "Al\nBob", comments: "40m; copying improved." },
    note: "Private reflection", scratchpad: "Private scratchpad" });
  const second = attempt("cwt-second", { taskId: "other:cwt", startedAt: "2026-09-10T03:00:00.000Z",
    cwtResult: { qsoCount: 0, heardCallsigns: "N3CCC", heardExchanges: "Carol 1234", comments: "Only monitored." } });
  const outside = attempt("old-cwt", { taskId: "other:cwt", startedAt: "2026-09-08T03:00:00.000Z", cwtResult: { qsoCount: 100 } });
  const result = draft([second, first, outside, first, attempt("class-cwt", { ...second, id: "class-cwt", context: "class" })]);
  assert.equal(result.answers.workedCallsigns, "W1AAA\nK2BBB");
  assert.equal(result.answers.workedNames, "Al\nBob");
  assert.equal(result.answers.heardCallsigns, "N3CCC");
  assert.equal(result.answers.heardExchanges, "Carol 1234");
  assert.match(result.answers.eventComments, /CWT Sep 8, 10:00 AM EDT: 12 QSOs\n40m; copying improved\./);
  assert.match(result.answers.eventComments, /CWT Sep 9, 11:00 PM EDT: 0 QSOs\nOnly monitored\./);
  assert.doesNotMatch(JSON.stringify(result.answers), /Private|100 QSOs/);
  assert.deepEqual(result.sourceAttemptIds, [first.id, second.id]);
  const refreshed = applyReportSuggestions({ answers: { eventComments: "My edited summary", workedNames: "" } }, result, ["eventComments", "workedNames"]);
  assert.equal(refreshed.answers.eventComments, "My edited summary");
  assert.equal(refreshed.answers.workedNames, "");
  assert.equal(refreshed.answers.workedCallsigns, result.answers.workedCallsigns);
});

test("CWT never invents counts or promotes freeform notes and bounds long report suggestions", () => {
  const result = draft([attempt("legacy-cwt", { taskId: "other:cwt", note: "Made 20 QSOs" }),
    attempt("heard-only", { taskId: "other:cwt", cwtResult: { heardCallsigns: "W1AAA" } })]);
  assert.equal(result.answers.eventComments, "");
  assert.equal(result.answers.workedCallsigns, "");
  assert.deepEqual(result.sourceAttemptIds, ["heard-only"]);
  const long = draft([attempt("long", { taskId: "other:cwt", cwtResult: { comments: "x".repeat(4000) } })]);
  assert.equal(long.answers.eventComments.length, 4000);
  assert.ok(long.warnings.some(warning => warning.includes("shortened")));
});

test("POTA and other on-air counts appear as dated report sources without becoming CWT results", () => {
  const pota = attempt("pota", { taskId: "other:pota", qsoCount: 23, note: "Private field notes" });
  const onAir = attempt("on-air", { taskId: "other:on-air", qsoCount: 0 });
  const old = attempt("old-other", { taskId: "other:general", note: "POTA 50 QSOs" });
  const unknown = attempt("unrecorded", { taskId: "other:pota" });
  const outside = attempt("outside", { taskId: "other:on-air", qsoCount: 20, startedAt: "2026-09-08T03:59:00.000Z" });
  const result = draft([pota, onAir, old, unknown, outside, pota]);
  assert.equal(result.sources.length, 2);
  assert.ok(result.sources.some(source => source.attemptId === "pota" && source.description === "POTA (Parks on the Air) (2026-09-08): 23 QSOs"));
  assert.ok(result.sources.some(source => source.attemptId === "on-air" && source.description === "On-air (other) (2026-09-08): 0 QSOs"));
  assert.equal(result.answers.eventComments, "");
  assert.equal(result.answers.workedCallsigns, "");
  assert.doesNotMatch(JSON.stringify(result), /Private field notes|50 QSOs/);
});
const lcwo = (id, extra = {}) => ({ id, kind: "words", sourceType: "words", sourceUserId: "123", sourceResultId: id,
  recordedAt: "2026-09-09T14:00:00.000Z", sourceTime: "2026-09-09 14:00:00", ...extra });

test("all 42 instructor fields have unique entry IDs and the exact required/rating values", () => {
  assert.equal(REPORT_FIELDS.length, 42);
  assert.equal(new Set(REPORT_FIELDS.map(field => field.key)).size, 42);
  assert.equal(new Set(REPORT_FIELDS.map(field => field.entryId)).size, 42);
  assert.deepEqual(REPORT_FIELDS.filter(field => field.required).map(field => field.key),
    ["callsign", "firstName", "session", "reportDate", "scalesRating"]);
  assert.equal(REPORT_FIELDS.find(field => field.key === "scalesRating").options[0], "Very good");
  assert.equal(REPORT_FIELDS.find(field => field.key === "suffixRating").options[0], "Very good");
  assert.equal(REPORT_FIELDS.find(field => field.key === "shortWordsRating").options[0], "Very Good");
  assert.equal(REPORT_FIELDS.find(field => field.key === "runnerVerifiedPoints").entryId, 1945917634);
  assert.equal(REPORT_FIELDS.find(field => field.key === "problems").entryId, 2010417226);
});

test("prefill encodes every field, dates, multiline text, zero, and exact choices without submitting", () => {
  const answers = Object.fromEntries(REPORT_FIELDS.map(field => [field.key,
    field.type === "rating" ? field.options[0] : field.type === "date" ? "2026-09-10" : field.type === "number" ? "0" : "CQ & TEST\nsecond line"]));
  const url = new URL(buildPrefilledReportUrl(answers));
  assert.equal(url.origin + url.pathname, REPORT_FORM_URL);
  assert.equal(url.searchParams.get("usp"), "pp_url");
  assert.equal([...url.searchParams.keys()].filter(key => key.startsWith("entry.")).length, 42);
  for (const field of REPORT_FIELDS) assert.equal(url.searchParams.get(`entry.${field.entryId}`), answers[field.key]);
  const blanks = new URL(buildPrefilledReportUrl({ runnerVerifiedPoints: "0", wordsScore: "", problems: "  ", unknown: "ignored" }));
  assert.deepEqual([...blanks.searchParams], [["usp", "pp_url"], ["entry.1945917634", "0"]]);
  assert.equal(answers.runnerVerifiedPoints, "0");
});

test("validation preserves optional blanks and zeros and reflects live bounds without a fabricated points cap", () => {
  assert.deepEqual(validateReportAnswers({}), ["callsign", "firstName", "session", "reportDate", "scalesRating"].map(key => ({ key, message: "An answer is required." })));
  assert.deepEqual(validateReportAnswers({}, { requireComplete: false }), []);
  assert.deepEqual(validateReportAnswers({ ...required(), runnerVerifiedPoints: "0", callsignErrors: "0", lettersErrorPercent: "0", wordsScore: "0" }), []);
  assert.deepEqual(validateReportAnswers({ ...required(), runnerVerifiedPoints: "61", runnerWpm: "11", lettersLength: "9", figuresLength: "8", customLength: "8", wordsMaximumLength: "3" }), []);
  const errors = validateReportAnswers({ ...required(), runnerWpm: "10", lettersLength: "10", figuresLength: "9", customLength: "9", wordsMaximumLength: "2",
    lettersErrorPercent: "29.4%", figuresErrorPercent: "-1", customErrorPercent: "NaN", reportDate: "2026-02-30", scalesRating: "Very Good" });
  assert.deepEqual(new Set(errors.map(error => error.key)), new Set(["runnerWpm", "lettersLength", "figuresLength", "customLength", "wordsMaximumLength", "lettersErrorPercent", "figuresErrorPercent", "customErrorPercent", "reportDate", "scalesRating"]));
  assert.equal(validateReportAnswers({ runnerWpm: "10" }, { requireComplete: false }).length, 1);
  const malformedMetrics = { runnerVerifiedPoints: "-1", callsignErrors: "0.5", wordsScore: "-5", session: "0",
    lettersLength: "0", figuresLength: "1.5", wordsMaximumLength: "3.5", lettersErrorPercent: "100.1" };
  assert.deepEqual(new Set(validateReportAnswers(malformedMetrics, { requireComplete: false }).map(error => error.key)), new Set(Object.keys(malformedMetrics)));
  assert.deepEqual(validateReportAnswers({ lettersErrorPercent: "100", customErrorPercent: "29.4" }, { requireComplete: false }), []);
});

test("report defaults follow preparation dates and the course timezone, with an editable early-report end", () => {
  assert.deepEqual(reportWindowForSession(course(), 2), { fromDate: "2026-09-08", toDate: "2026-09-10" });
  assert.deepEqual(reportWindowForSession(course(), 2, "2026-09-09"), { fromDate: "2026-09-08", toDate: "2026-09-09" });
  assert.deepEqual(reportWindowForSession({ ...course(), assignments: [] }, 2), { fromDate: "2026-09-08", toDate: "2026-09-10" });
  const records = [
    attempt("before", { startedAt: "2026-09-08T03:59:59.000Z" }),
    attempt("first", { startedAt: "2026-09-08T04:00:00.000Z" }),
    attempt("review", { review: true }), attempt("class", { context: "class" }),
    attempt("last", { startedAt: "2026-09-11T03:59:59.000Z" }),
    attempt("after", { startedAt: "2026-09-11T04:00:00.000Z" }), attempt("invalid", { startedAt: "bad" }),
  ];
  assert.deepEqual(reportAttemptsInWindow(records, options(), course().timezone).map(item => item.id), ["first", "review", "last"]);
  assert.deepEqual(reportAttemptsInWindow(records, { fromDate: "invalid", toDate: "2026-09-10" }, course().timezone), []);
});

test("actual runner start date wins over delayed saving; duplicate attempts resolve before filtering", () => {
  const actual = attempt("actual", { startedAt: "2026-09-12T12:00:00.000Z", runnerResult: runner({ runStartedAt: "2026-09-09T12:00:00.000Z" }) });
  const moved = attempt("moved", { context: "class" });
  assert.deepEqual(reportAttemptsInWindow([attempt("moved"), actual, moved], options(), course().timezone), [actual]);
});

test("five minutes with 15 verified points beats ten minutes with 10 points without summing or scaling", () => {
  const records = [attempt("ten", { runnerResult: runner() }),
    attempt("five", { review: true, runnerResult: runner({ elapsedSeconds: 300, durationSeconds: 300, verifiedPoints: 15, qsoCount: 16, wpm: 18, speeds: [18], status: "completed" }) })];
  const before = structuredClone(records);
  const result = draft(records);
  assert.equal(result.answers.runnerVerifiedPoints, "15");
  assert.equal(result.answers.runnerWpm, "18");
  assert.deepEqual(result.sourceAttemptIds, ["five"]);
  assert.match(result.sources[0].description, /15 Verified Pts; 5 minutes/);
  assert.equal(result.runner.attemptId, "five");
  assert.match(result.warnings[0], /without scaling/);
  assert.deepEqual(records, before);
});

test("ties prefer duration, then latest actual start; only individual measured runs up to 900 seconds qualify", () => {
  const records = [
    attempt("long", { runnerResult: runner({ elapsedSeconds: 900, status: "completed" }) }),
    attempt("short", { runnerResult: runner({ elapsedSeconds: 300 }) }),
    attempt("too-long", { runnerResult: runner({ elapsedSeconds: 901, verifiedPoints: 50 }) }),
    attempt("error", { runnerResult: runner({ status: "error", verifiedPoints: 50 }) }),
    attempt("missing", { runnerResult: runner({ verifiedPoints: undefined }) }),
    attempt("empty", { runnerResult: runner({ elapsedSeconds: 0, verifiedPoints: 50 }) }),
    attempt("time-only", { completed: true, activeSeconds: 900 }),
  ];
  assert.equal(selectReportRunner(records).attemptId, "long");
  assert.equal(selectReportRunner([records[0], attempt("later", { startedAt: "2026-09-09T14:00:00.000Z", runnerResult: runner({ elapsedSeconds: 900 }) })]).attemptId, "later");
  assert.equal(draft([attempt("zero", { runnerResult: runner({ verifiedPoints: 0 }) })]).answers.runnerVerifiedPoints, "0");
  assert.equal(draft([]).answers.runnerVerifiedPoints, "");
});

test("WPX, band conditions, and mixed speeds remain eligible with explicit review details", () => {
  const result = draft([attempt("mixed", { runnerResult: runner({ mode: "WPX", conditions: true, speeds: [15, 18, 13] }) })]);
  assert.equal(result.answers.runnerWpm, "15");
  assert.equal(result.answers.runnerVerifiedPoints, "10");
  assert.match(result.sources[0].description, /WPX.*band conditions on; speeds used 15, 18, 13 WPM/);
  assert.ok(result.warnings.some(message => /Review the suggested starting speed/.test(message)));
});

test("recent generated runner notes remain reportable but plain score prose is never reinterpreted", () => {
  const saved = attempt("legacy", { note: "Web Morse Runner: stopped (partial); 450 seconds; Single Call; 13 WPM starting speed; run duration 900 seconds; band conditions off; speed changes: 18 WPM at 0:12, 23 WPM at 0:31; 12 QSOs; Verified Pts 0; verified score 0; NR 1; NIL 1. Upstream old-revision. Synthetic practice calls (not on-air contacts).\nI had 100 points on something else." });
  const parsed = legacyRunnerResult(saved);
  assert.equal(parsed.verifiedPoints, 0);
  assert.deepEqual(parsed.speeds, [13, 18, 23]);
  assert.equal(parsed.conditions, false);
  const result = draft([saved]);
  assert.equal(result.answers.runnerVerifiedPoints, "0");
  assert.equal(result.answers.runnerWpm, "13");
  assert.match(result.sources[0].description, /recovered from saved note/);
  assert.equal(legacyRunnerResult(attempt("prose", { note: "Morse Runner: 55 score, 25 points, 20 WPM" })), undefined);
  assert.equal(legacyRunnerResult({ ...saved, note: saved.note.replace("stopped (partial)", "interrupted (partial)") }), undefined);
});

test("audio suggestions use actual per-file speed and only practiced files across all six categories", () => {
  const records = [attempt("audio", { taskId: "words", audioResults: [
    audio("WD201-15", 15), audio("WD201-18", 18), audio("WD201-15", 15), audio("WD202-10", 10, { activeSeconds: 0, completedPasses: 1 }),
    audio("PR201-13", 13), audio("QSO104-15", 15), audio("POTA104-13", 13), audio("DIS4-15", 15), audio("ING4-18", 18),
  ] })];
  const result = draft(records);
  assert.equal(result.answers.shortWordsFiles, "WD201 15, WD201 18");
  assert.equal(result.answers.shortPhrasesFiles, "PR201 13");
  assert.equal(result.answers.shortQsoFiles, "QSO104 15");
  assert.equal(result.answers.shortPotaFiles, "POTA104 13");
  assert.equal(result.answers.prefixFiles, "DIS4 15");
  assert.equal(result.answers.suffixFiles, "ING4 18");
  assert.deepEqual(result.sourceAttemptIds, ["audio"]);
});

test("legacy audio parsing retains mixed speeds, uses URL catalog evidence, and skips zero usage or assigned-only metadata", () => {
  const note = [
    "Audio recording: DIS4-10 (10 WPM); assigned 10 WPM. Source: https://cwa.cwops.org/wp-content/uploads/DIS4_10.mp3. Practice: 0 seconds (includes 0 seconds recall); 0 completed passes.",
    "Audio recording: DIS4-15 (15 WPM); assigned 10 WPM. Source: https://cwa.cwops.org/wp-content/uploads/DIS4_15.mp3. Practice: 120 seconds (includes 10 seconds recall); 1 completed pass.",
  ].join("\n");
  assert.equal(legacyAudioResults(attempt("mixed", { note })).length, 2);
  const result = draft([
    attempt("mixed", { note }),
    attempt("old", { note: "Audio recording: ING4-13; assigned 10 WPM. Source: https://cwa.cwops.org/wp-content/uploads/ING4_13.mp3" }),
    attempt("assigned-only", { taskId: "words", note: "Assigned WD201-10, 10 WPM" }),
    attempt("unknown-speed", { note: "Audio recording: QSO999; assigned 25 WPM. Source: https://example.com/QSO999.mp3" }),
  ]);
  assert.equal(result.answers.prefixFiles, "DIS4 15");
  assert.equal(result.answers.suffixFiles, "ING4 13");
  assert.equal(result.answers.shortWordsFiles, "");
  assert.equal(result.answers.shortQsoFiles, "QSO999 (speed not recorded)");
  assert.ok(result.warnings.some(message => /practiced speed was not recorded/.test(message)));
});

test("performance ratings use the latest explicit category rating and never translate difficulty", () => {
  const records = [
    attempt("scale-first", { taskId: "scales", performanceRating: "poor" }),
    attempt("scale-latest", { taskId: "scales", startedAt: "2026-09-09T14:00:00.000Z", performanceRating: "very-good" }),
    attempt("words", { taskId: "words", performanceRating: "very-good" }),
    attempt("suffix", { taskId: "suffix", performanceRating: "very-good" }),
    attempt("difficulty", { taskId: "prefix", difficulty: "easy" }),
    attempt("class", { taskId: "scales", context: "class", startedAt: "2026-09-10T14:00:00.000Z", performanceRating: "poor" }),
  ];
  const result = draft(records);
  assert.equal(result.answers.scalesRating, "Very good");
  assert.equal(result.answers.shortWordsRating, "Very Good");
  assert.equal(result.answers.suffixRating, "Very good");
  assert.equal(result.answers.prefixRating, "");
  assert.ok(!result.sourceAttemptIds.includes("scale-first"));
});

test("LCWO takes the latest result per trainer, preserves zero, and never mixes older metrics into it", () => {
  const result = draft([
    attempt("calls-old", { lcwoResult: { kind: "callsign", speedWpm: 15, score: 800, errorCount: 3 } }),
    attempt("calls-new", { startedAt: "2026-09-09T14:00:00.000Z", lcwoResult: { kind: "callsign", speedWpm: 18, errorCount: 0 } }),
    attempt("letters", { lcwoResult: { kind: "letters", groupLength: 3, speedWpm: 15, errorPercent: 0 } }),
    attempt("words", { lcwoResult: { kind: "words", maximumLength: 4, speedWpm: 18, errorCount: 0, score: 0 } }),
    attempt("figures", { lcwoResult: { kind: "figures", groupLength: 3, speedWpm: 13, errorPercent: 25 } }),
    attempt("custom", { lcwoResult: { kind: "custom", groupLength: 2, speedWpm: 18, errorPercent: 10 } }),
  ]);
  assert.equal(result.answers.callsignWpm, "18");
  assert.equal(result.answers.callsignScore, "");
  assert.equal(result.answers.callsignErrors, "0");
  assert.equal(result.answers.lettersLength, "3");
  assert.equal(result.answers.lettersErrorPercent, "0");
  assert.equal(result.answers.wordsMaximumLength, "4");
  assert.equal(result.answers.wordsScore, "0");
  assert.equal(result.answers.wordsErrors, "0");
  assert.equal(result.answers.figuresErrorPercent, "25");
  assert.equal(result.answers.customLength, "2");
  assert.ok(!result.sourceAttemptIds.includes("calls-old"));
});

test("learned words require explicit confirmation, deduplicate case-insensitively, and only submitted snapshots remove them", () => {
  assert.deepEqual(learnedWordsFromScratchpad("CQ sounded familiar\nLEARNED: Rig, QTH, another word\n learned: rig, GET"), ["Rig", "QTH", "another word", "GET"]);
  const records = [
    attempt("one", { scratchpad: "Need to learn NAME.\nLearned: Rig, QTH, Get" }),
    attempt("two", { scratchpad: "learned: RIG, name", startedAt: "2026-09-09T14:00:00.000Z" }),
    attempt("class", { context: "class", scratchpad: "Learned: class-only" }),
  ];
  const reports = [
    { status: "submitted", answers: { learnedWords: "qth" } },
    { status: "draft", answers: { learnedWords: "rig, name" } },
  ];
  const result = draft(records, { reports });
  assert.equal(result.answers.learnedWords, "Rig, Get, name");
  assert.equal(draft(records, { reports: [...reports, { status: "submitted", answers: { learnedWords: "RIG, GET; name" } }] }).answers.learnedWords, "");
  assert.equal(result.answers.heardCallsigns, "");
  assert.equal(result.answers.workedCallsigns, "");
  assert.equal(result.answers.problems, "");
  assert.ok(!JSON.stringify(result).includes("Need to learn NAME"));
});

test("LCWO API history uses course-local dates and deduplicates before choosing runs", () => {
  const runs = [
    lcwo("before", { recordedAt: "2026-09-08T03:59:59.000Z" }),
    lcwo("first", { recordedAt: "2026-09-08T04:00:00.000Z" }),
    lcwo("last", { recordedAt: "2026-09-11T03:59:59.000Z" }),
    lcwo("after", { recordedAt: "2026-09-11T04:00:00.000Z" }),
    lcwo("invalid", { recordedAt: "bad" }),
    lcwo("moved"), lcwo("moved", { recordedAt: "2026-09-12T14:00:00.000Z" }),
  ];
  assert.deepEqual(reportLcwoRunsInWindow(runs, options(), course().timezone).map(run => run.id), ["first", "last"]);
  assert.deepEqual(reportLcwoRunsInWindow(runs, options({ fromDate: "2026-09-11" }), course().timezone), []);
});

test("LCWO imports fill only matching measurements and retain maximum WPM and accuracy as evidence", () => {
  const runs = [
    lcwo("words", { score: 0, maximumWpm: 21 }),
    lcwo("calls", { kind: "callsign", sourceType: "callsigns", score: 700, maximumWpm: 26 }),
    ...["letters", "figures", "custom"].map(kind => lcwo(kind, { kind, sourceType: "groups", effectiveWpm: 15, characterWpm: 25, accuracyPercent: 70.6 })),
  ];
  const records = [];
  const result = draft(records, { lcwoRuns: runs });
  assert.equal(result.answers.wordsScore, "0");
  assert.equal(result.answers.callsignScore, "700");
  for (const key of ["wordsWpm", "callsignWpm", "wordsMaximumLength", "wordsErrors", "callsignErrors"]) assert.equal(result.answers[key], "");
  for (const kind of ["letters", "figures", "custom"]) {
    assert.equal(result.answers[`${kind}Wpm`], "15");
    assert.equal(result.answers[`${kind}Length`], "");
    assert.equal(result.answers[`${kind}ErrorPercent`], "");
    assert.equal(result.lcwoSources.find(source => source.run.kind === kind).run.accuracyPercent, 70.6);
  }
  assert.equal(result.lcwoSources.find(source => source.run.kind === "words").run.maximumWpm, 21);
  assert.deepEqual(new Set(result.sourceLcwoIds), new Set(runs.map(run => run.id)));
  assert.deepEqual(result.sourceAttemptIds, []);
  assert.deepEqual(records, []);
});

test("latest LCWO run wins across API and manual sources without carrying forward unrelated missing values", () => {
  const result = draft([
    attempt("manual-words", { lcwoResult: { kind: "words", speedWpm: 13, maximumLength: 3, errorCount: 2, score: 1200 } }),
    attempt("manual-letters", { startedAt: "2026-09-10T14:00:00.000Z", endedAt: "2026-09-10T14:10:00.000Z", lcwoResult: { kind: "letters", groupLength: 3, errorPercent: 0 } }),
  ], { lcwoRuns: [
    lcwo("new-words", { score: 300, maximumWpm: 18 }),
    lcwo("old-words", { recordedAt: "2026-09-08T12:00:00.000Z", score: 1500, maximumWpm: 30 }),
    lcwo("imported-letters", { kind: "letters", sourceType: "groups", effectiveWpm: 15, characterWpm: 25, accuracyPercent: 100 }),
  ] });
  assert.equal(result.answers.wordsScore, "300");
  assert.equal(result.answers.wordsErrors, "");
  assert.equal(result.answers.wordsMaximumLength, "");
  assert.equal(result.answers.wordsWpm, "");
  assert.equal(result.answers.lettersLength, "3");
  assert.equal(result.answers.lettersErrorPercent, "0");
  assert.equal(result.answers.lettersWpm, "");
  assert.deepEqual(result.sourceLcwoIds, ["new-words"]);
  assert.deepEqual(result.sourceAttemptIds, ["manual-letters"]);
});

test("Koch lessons do not silently fill custom character practice", () => {
  const result = draft([], { lcwoRuns: [lcwo("lesson", { kind: "koch", sourceType: "koch", lesson: 5, effectiveWpm: 18, characterWpm: 25, accuracyPercent: 100 })] });
  assert.equal(result.answers.customWpm, "");
  assert.equal(result.answers.customLength, "");
  assert.equal(result.answers.customErrorPercent, "");
  assert.deepEqual(result.sourceLcwoIds, []);
  assert.match(result.warnings.join(" "), /Koch lesson results.*separate/);
});

test("an exported completion inside a manually logged block preserves that block's details", () => {
  const manual = attempt("manual", { startedAt: "2026-09-09T14:00:00.000Z", endedAt: "2026-09-09T14:10:00.000Z",
    lcwoResult: { kind: "words", speedWpm: 15, score: 300, maximumLength: 3, errorCount: 2 } });
  const imported = lcwo("same-run", { recordedAt: "2026-09-09T14:09:00.000Z", score: 300, maximumWpm: 20 });
  const result = draft([manual], { lcwoRuns: [imported] });
  assert.equal(result.answers.wordsWpm, "15");
  assert.equal(result.answers.wordsMaximumLength, "3");
  assert.equal(result.answers.wordsErrors, "2");
  assert.deepEqual(result.sourceAttemptIds, ["manual"]);
  assert.deepEqual(result.sourceLcwoIds, []);
  const later = draft([manual], { lcwoRuns: [imported, lcwo("later-run", { recordedAt: "2026-09-09T14:11:00.000Z", score: 350 })] });
  assert.equal(later.answers.wordsScore, "350");
  assert.equal(later.answers.wordsMaximumLength, "");
  assert.equal(later.answers.wordsErrors, "");
  assert.deepEqual(later.sourceAttemptIds, []);
  assert.deepEqual(later.sourceLcwoIds, ["later-run"]);
});

test("report refresh updates imported sources while preserving deliberate answers and blanks", () => {
  const original = { id: "draft", session: 2, fromDate: "2026-09-08", toDate: "2026-09-10", reportDate: "2026-09-10",
    createdAt: "2026-09-10T15:00:00.000Z", status: "draft", sourceAttemptIds: ["old-manual"], sourceLcwoIds: ["old-import"],
    answers: { ...required(), wordsScore: "100", wordsWpm: "13", wordsErrors: "0", lettersWpm: "", problems: "Ask Bob about this run." } };
  const untouched = structuredClone(original);
  const suggestions = draft([], { lcwoRuns: [lcwo("new", { score: 800 }), lcwo("letters", { kind: "letters", effectiveWpm: 15 })] });
  const refreshed = applyReportSuggestions(original, suggestions, ["wordsWpm", "wordsErrors", "lettersWpm", "problems"]);
  assert.equal(refreshed.answers.wordsScore, "800");
  assert.equal(refreshed.answers.wordsWpm, "13");
  assert.equal(refreshed.answers.wordsErrors, "0");
  assert.equal(refreshed.answers.lettersWpm, "");
  assert.equal(refreshed.answers.problems, original.answers.problems);
  assert.deepEqual(refreshed.sourceAttemptIds, []);
  assert.deepEqual(refreshed.sourceLcwoIds, suggestions.sourceLcwoIds);
  assert.deepEqual(original, untouched);
});
