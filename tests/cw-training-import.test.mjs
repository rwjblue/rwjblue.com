import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { courseMeetings, courseSql, courseSqlStatements, decodeHtml, documentBlocks, importCourse, zonedDateTime } from "../scripts/cw-training/import.mjs";

// Deliberately synthetic source: no CWops course or sending text is checked in.
const scalesHtml = `<p>Fixture sending instructions.</p><h2>Warm Up</h2><p>AAA BBB<br>CCC DDD</p><h2>Exercise</h2><p>EEE FFF</p><h2>Drill</h2><p>GGG HHH</p>`;
const indexHtml = `<a href="https://example.invalid/other-path/ZZ999_18.mp3">18</a><a href="https://example.invalid/other-path/ZZ888_20.mp3">20</a>`;
function fixture({ firstDay, secondDay, thirdDay, sessions = 16 } = {}) {
  let html = `<h1>Fixture version</h1><p>Version 2.2 - fixture</p><p>Session 1: 5</p><h1>Introduction</h1><p>Original fixture introduction &amp; context.</p><p><a href="https://example.invalid/mcw">MCW ICR guide</a><a href="https://example.invalid/runner">Morse Runner</a></p><h1>Assignments</h1>`;
  for (let session = 1; session <= sessions; session++) {
    html += `<p>Objectives for Sessions ${session}: fixture goal.</p><h2>Session ${session}:</h2>`;
    for (const [index, day] of ["one", "two", "three"].entries()) {
      const custom = [firstDay, secondDay, thirdDay][index];
      html += `<h3>Day ${day}:</h3>${custom ?? `<p>Complete the sending Warm Up Scales. Marker ${session}-${day}.</p>`}`;
    }
  }
  return html + `<h1>Appendix A: fixture log</h1><p>Not an assignment.</p>`;
}
const options = (curriculumHtml) => ({ curriculumHtml, scalesHtml, indexHtml, verifiedAt: "2026-09-05T12:00:00Z" });

test("full import preserves source wording and produces all 48 correctly dated assignments", () => {
  const course = importCourse(options(fixture()));
  assert.equal(course.assignments.length, 48);
  assert.equal(course.assignments[0].date, "2026-09-05");
  assert.equal(course.assignments[2].dueAt, "2026-09-07T19:30:00.000Z");
  assert.equal(course.assignments[3].date, "2026-09-08");
  assert.equal(course.assignments.at(-1).date, "2026-10-29");
  assert.match(course.instructions, /Original fixture introduction & context\./);
  assert.equal(course.assignments[0].tasks[0].instructions, "Complete the sending Warm Up Scales. Marker 1-one.");
  assert.match(course.assignments[0].instructions, /Objectives for Sessions 1: fixture goal\./);
  assert.equal(new Set(course.assignments.flatMap((assignment) => assignment.tasks.map((task) => task.id))).size, 48);
});

test("HTML extraction honors character encoding, entities, and explicit line breaks", () => {
  const bytes = Uint8Array.from([...Buffer.from('<meta charset="windows-1252"><p>'), 0x93, ...Buffer.from("fixture"), 0x94, ...Buffer.from("</p>")]);
  assert.deepEqual(documentBlocks(decodeHtml(bytes)), ["“fixture”"]);
  assert.deepEqual(documentBlocks("<p>A &amp; B<br>C D</p><script>not instructions</script>"), ["A & B\nC D"]);
});

test("audio URLs come only from the observed index, with requested-speed discrepancies unresolved", () => {
  const course = importCourse(options(fixture({ firstDay: "<p>Copy ZZ999-18 at least two times. Synthetic listening cue.</p><p>CWT practice ZZ888-18. Synthetic open-ended cue.</p>" })));
  const [known, missing] = course.assignments[0].tasks;
  assert.equal(known.minimumPasses, 2);
  const knownResource = course.resources.find((resource) => resource.id === known.resourceId);
  assert.equal(knownResource.url, "https://example.invalid/other-path/ZZ999_18.mp3");
  assert.equal(knownResource.durationSeconds, undefined);
  const missingResource = course.resources.find((resource) => resource.id === missing.resourceId);
  assert.match(missingResource.unresolved, /ZZ888-18/);
  assert.match(missingResource.unresolved, /ZZ888_20\.mp3/);
  assert.equal(missing.minimumPasses, undefined);
  assert.equal(missingResource.url, "https://cwops.org/intermediate-practice-files/");
});

test("later task variants retain bounds, precise simulator settings, live alternatives, and optional status", () => {
  const course = importCourse(options(fixture({
    firstDay: "<p>Short Story ZZ999-18. Listen once or twice.</p><p>Morse Runner: WPX fixture; starting speed of 18, activity 2.</p><p>Note: fixture instruction.</p>",
    secondDay: "<p>CWT, any sessions fixture</p><p>Try to work 5 QSOs or at least copy fixture exchanges.</p><p>Practice other fixture material.</p>",
    thirdDay: "<p>Using LCWO, speed at 15 fixture.</p>",
  })));
  const [story, simulator] = course.assignments[0].tasks;
  assert.equal(story.minimumPasses, 1);
  assert.equal(story.maximumPasses, 2);
  assert.equal(simulator.speedWpm, 18);
  assert.equal(simulator.minutes, 15);
  assert.match(simulator.settings, /WPX fixture; starting speed of 18, activity 2\./);
  assert.match(simulator.instructions, /\nNote: fixture instruction\./);
  const [live, review] = course.assignments[1].tasks;
  assert.equal(live.kind, "live");
  assert.equal(live.objectiveCount, 5);
  assert.equal(live.alternative, "at least copy fixture exchanges.");
  assert.equal(review.optional, true);
  assert.equal(course.assignments[2].tasks[0].speedWpm, 15);
});

test("sending combines only the selected source sections with their original introduction", () => {
  const course = importCourse(options(fixture({ firstDay: "<p>Complete the sending Warm Up and Drill Scales.</p>" })));
  const task = course.assignments[0].tasks[0];
  const resource = course.resources.find((resource) => resource.id === task.resourceId);
  assert.match(resource.text, /Fixture sending instructions\./);
  assert.match(resource.text, /AAA BBB\nCCC DDD/);
  assert.match(resource.text, /GGG HHH/);
  assert.doesNotMatch(resource.text, /EEE FFF/);
});

test("unknown source structure or missing assignments fails closed instead of dropping work", () => {
  assert.throws(() => importCourse(options(fixture({ firstDay: "<p>A new unsupported requirement.</p>" }))), /Unclassified/);
  assert.throws(() => importCourse(options(fixture({ sessions: 15 }))), /48/);
});

test("a phase objective after a line break belongs to the next session, not the prior task", () => {
  const source = fixture({ sessions: 2 })
    .replace("<p>Objectives for Sessions 2: fixture goal.</p>", "")
    .replace("Marker 1-three.</p>", "Marker 1-three.<br>Objectives for Sessions 2: next phase goal.</p>");
  const course = importCourse({ ...options(source), expectedSessions: 2 });
  assert.doesNotMatch(course.assignments[2].tasks[0].instructions, /next phase/);
  assert.match(course.assignments[3].instructions, /^Objectives for Sessions 2: next phase goal\./);
  assert.match(course.instructions, /Objectives for Sessions 2: next phase goal\./);
});

test("meeting times use the course time zone through daylight-saving changes", () => {
  const meetings = courseMeetings();
  assert.equal(meetings.length, 16);
  assert.equal(meetings.at(-1).startsAt, "2026-10-29T19:30:00.000Z");
  assert.equal(meetings.at(-1).endsAt, "2026-10-29T20:30:00.000Z");
  assert.equal(zonedDateTime("2026-11-09", "15:30", "America/New_York"), "2026-11-09T20:30:00.000Z");
  assert.throws(() => courseMeetings({ firstClassDate: "2026-09-08" }), /Monday/);
});

test("private SQL upserts escape apostrophes in source text", () => {
  const sql = courseSql({ id: "fixture", instructions: "Student's example" });
  assert.match(sql, /Student''s example/);
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE/);
});

test("large private imports use bounded statements and publish atomically without touching other courses", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE training_courses(id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)))");
    db.prepare("INSERT INTO training_courses VALUES (?, ?)").run("fixture", JSON.stringify({ id: "fixture", version: "old" }));
    db.prepare("INSERT INTO training_courses VALUES (?, ?)").run("other", JSON.stringify({ id: "other" }));
    const course = { id: "fixture", instructions: "Student's synthetic message 🐦. ".repeat(10_000) };
    const statements = courseSqlStatements(course);
    assert.ok(statements.length > 10);
    assert.ok(statements.every((statement) => Buffer.byteLength(statement) < 100_000));
    statements.slice(0, -2).forEach((statement) => db.exec(statement));
    assert.equal(JSON.parse(db.prepare("SELECT payload FROM training_courses WHERE id='fixture'").get().payload).version, "old");
    statements.slice(-2).forEach((statement) => db.exec(statement));
    assert.deepEqual(JSON.parse(db.prepare("SELECT payload FROM training_courses WHERE id='fixture'").get().payload), course);
    statements.forEach((statement) => db.exec(statement));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM training_courses").get().count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM training_course_import_chunks").get().count, 0);
    assert.equal(JSON.parse(db.prepare("SELECT payload FROM training_courses WHERE id='other'").get().payload).id, "other");
    statements.slice(0, 3).forEach((statement) => db.exec(statement));
    assert.throws(() => db.exec(statements.at(-2)), /NOT NULL/);
    assert.deepEqual(JSON.parse(db.prepare("SELECT payload FROM training_courses WHERE id='fixture'").get().payload), course);
  } finally { db.close(); }
});
