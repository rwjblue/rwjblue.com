import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../src/data/cw-training/audio-variants.json" with { type: "json" };
import { indexAudioVariants } from "../scripts/cw-training/audio-variants.mjs";
import { audioRecordingNote, audioVariants, courseWithAudioVariants, selectAudioVariant } from "../src/lib/cw-training/audio-variants.ts";

const source = (overrides = {}) => ({ id: "assigned-recording", title: "WD101-10", url: "https://cwa.cwops.org/wp-content/uploads/WD101_10.mp3", format: "audio", durationSeconds: 443.2, ...overrides });
const task = (overrides = {}) => ({ id: "listening", kind: "audio", title: "WD101-10", instructions: "Synthetic listening assignment.", sourceUrl: "https://example.invalid/instructions", resourceId: "assigned-recording", speedWpm: 10, minimumPasses: 2, ...overrides });
const course = (tasks = [task()]) => ({
  id: "synthetic", title: "Synthetic course", version: "1", sourceUrl: "https://example.invalid/course", verifiedAt: "2026-09-07", timezone: "America/New_York", dailyGoalMinutes: 60, instructions: "Synthetic course instruction.", meetings: [],
  assignments: [{ id: "day-one", session: 1, day: 1, date: "2026-09-07", dueAt: "2026-09-07T19:30:00Z", instructions: "Synthetic day instruction.", sourceUrl: "https://example.invalid/day", tasks }],
  resources: [source()],
});

test("the official catalog contains only public recording metadata from the six short families", () => {
  assert.equal(catalog.sourceUrl, "https://cwops.org/intermediate-practice-files/");
  assert.match(catalog.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  const families = new Set();
  const urls = new Set();
  for (const group of catalog.groups) {
    assert.deepEqual(Object.keys(group).sort(), ["id", "variants"]);
    families.add(group.id.replace(/-[^-]+$/, ""));
    assert.ok(group.variants.length > 0);
    assert.deepEqual(group.variants.map((variant) => variant.speedWpm), [...group.variants.map((variant) => variant.speedWpm)].sort((a, b) => a - b));
    for (const variant of group.variants) {
      assert.ok(Object.keys(variant).every((key) => ["id", "title", "url", "format", "speedWpm", "durationSeconds"].includes(key)), "no curriculum instructions or text are published");
      assert.equal(variant.format, "audio");
      assert.ok([10, 13, 15, 18, 20, 25].includes(variant.speedWpm));
      const url = new URL(variant.url);
      assert.equal(url.protocol, "https:");
      assert.ok(["cwops.org", "cwa.cwops.org"].includes(url.hostname));
      assert.equal(urls.has(variant.url), false, "every source URL belongs to exactly one exercise family");
      urls.add(variant.url);
      assert.ok(Number.isFinite(variant.durationSeconds) && variant.durationSeconds > 0, "only playable, measured recordings are selectable");
    }
  }
  assert.deepEqual([...families].sort(), ["prefix", "short-phrase", "short-pota", "short-qso", "short-word", "suffix"]);
});

test("indexing keeps exact exercise IDs and excludes long QSO lookalikes and unsupported links", () => {
  const groups = indexAudioVariants(`
    <h2>Intermediate Long QSO Practice Files</h2><a href="https://cwops.org/wp-content/uploads/2022/07/qso201_10.mp3">10</a>
    <h2>Intermediate Short QSO Files</h2>
    <a href="https://cwa.cwops.org/wp-content/uploads/QSO_201_10.mp3">10</a>
    <a href="https://cwa.cwops.org/wp-content/uploads/QSO_201_13.mp3">13</a>
    <a href="https://cwa.cwops.org/wp-content/uploads/QSO_2010_13.mp3">13</a>
    <a href="https://example.invalid/QSO_201_15.mp3">15</a>
    <a href="http://cwa.cwops.org/wp-content/uploads/QSO_201_18.mp3">18</a>
    <a href="https://cwa.cwops.org/wp-content/uploads/QSO_201_30.mp3">30</a>
    <h2>Unrecognized new section</h2><a href="https://cwa.cwops.org/wp-content/uploads/QSO_201_25.mp3">25</a>`);
  assert.deepEqual(groups.map((group) => group.id), ["short-qso-qso201", "short-qso-qso2010"]);
  assert.deepEqual(groups[0].variants.map((variant) => variant.speedWpm), [10, 13]);
  assert.equal(groups[1].variants.length, 1);
  assert.ok(groups.flatMap((group) => group.variants).every((variant) => !variant.url.includes("2022/07")));
});

test("duplicate index links are deduplicated and contradictory identities fail closed", () => {
  const header = "<h2>Intermediate Short Word Files</h2>";
  const link = '<a href="https://cwa.cwops.org/wp-content/uploads/WD101_10.mp3">10</a>';
  assert.equal(indexAudioVariants(header + link + link)[0].variants.length, 1);
  assert.throws(() => indexAudioVariants(header + link + '<a href="https://cwops.org/wp-content/uploads/WD101_10.mp3">10</a>'), /Conflicting official links/);
});

test("variants anchor to the exact assigned URL and returned data cannot mutate the catalog", () => {
  const variants = audioVariants(source());
  assert.deepEqual(variants.map((variant) => variant.speedWpm), [10, 13, 15, 18, 20, 25]);
  assert.ok(variants.every((variant) => variant.title.startsWith("WD101-")));
  variants[0].title = "Changed locally";
  variants.pop();
  assert.equal(audioVariants(source())[0].title, "WD101-10");
  assert.equal(audioVariants(source()).length, 6);
  assert.deepEqual(audioVariants(undefined), []);
  assert.deepEqual(audioVariants(source({ url: "https://example.invalid/WD101_10.mp3" })), []);
  assert.deepEqual(audioVariants(source({ url: "https://cwa.cwops.org/wp-content/uploads/WD101_10.mp3?alternate=1" })), []);
  assert.deepEqual(audioVariants(source({ url: "https://cwops.org/wp-content/uploads/2022/07/qso201_10.mp3" })), [], "long QSO cannot select similarly named short QSO");
  assert.deepEqual(audioVariants(source({ url: "https://cwa.cwops.org/wp-content/uploads/WD405_10.mp3" })), [], "broken official links are not advertised as alternatives");
});

test("selection keeps assigned speed or chooses exactly the next verified faster recording", () => {
  assert.equal(selectAudioVariant(source(), 10, "assigned").url, source().url);
  assert.equal(selectAudioVariant(source(), 10, "next").speedWpm, 13);
  assert.equal(selectAudioVariant(source(), 10, "next", 20).speedWpm, 20);
  assert.equal(selectAudioVariant(source(), 10, "assigned", 25).speedWpm, 25);
  assert.equal(selectAudioVariant(source(), 10, "next", 10).url, source().url);
  const fastest = source({ url: "https://cwa.cwops.org/wp-content/uploads/WD101_25.mp3", title: "WD101-25" });
  assert.equal(selectAudioVariant(fastest, 25, "next"), fastest, "the maximum available speed never wraps slower");
});

test("unknown, unresolved, invalid, and slower overrides preserve the assigned recording", () => {
  for (const assigned of [source({ unresolved: "Ask the instructor." }), source({ format: "link" }), source({ url: "https://example.invalid/unlisted.mp3" })]) {
    assert.equal(selectAudioVariant(assigned, 10, "next", 13), assigned);
  }
  assert.equal(selectAudioVariant(undefined, 10, "next"), undefined);
  const assigned = source({ url: "https://cwa.cwops.org/wp-content/uploads/WD101_15.mp3", title: "WD101-15" });
  for (const override of [10, 13, 17, NaN, Infinity]) assert.equal(selectAudioVariant(assigned, 15, "next", override), assigned);
  for (const speed of [undefined, 0, -1, NaN]) assert.equal(selectAudioVariant(assigned, speed, "next"), assigned);
});

test("projected task overrides remain independent even when assignments share one resource", () => {
  const original = course([task({ id: "first" }), task({ id: "second" }), task({ id: "third" }), task({ id: "sending", kind: "sending" })]);
  const before = JSON.stringify(original);
  const projected = courseWithAudioVariants(original, "assigned", { first: 13, second: 25 });
  const tasks = projected.assignments[0].tasks;
  const resources = new Map(projected.resources.map((resource) => [resource.id, resource]));
  assert.match(resources.get(tasks[0].resourceId).url, /WD101_13\.mp3$/);
  assert.match(resources.get(tasks[1].resourceId).url, /WD101_25\.mp3$/);
  assert.equal(resources.get(tasks[2].resourceId).url, source().url);
  assert.equal(tasks[3], original.assignments[0].tasks[3]);
  for (let index = 0; index < tasks.length; index++) {
    const { resourceId: originalResource, ...expected } = original.assignments[0].tasks[index];
    const { resourceId: projectedResource, ...actual } = tasks[index];
    assert.deepEqual(actual, expected, "titles, assigned speeds, instructions, and task IDs stay unchanged");
  }
  assert.equal(JSON.stringify(original), before);
  assert.equal(projected.resources.find((resource) => resource.id === "assigned-recording").url, source().url);
  assert.match(resources.get(tasks[0].resourceId).id, /^cw-audio-/);
});

test("projected next preference supplies measured selected durations without changing requirements", () => {
  const original = course();
  const projected = courseWithAudioVariants(original, "next");
  const selected = projected.resources.find((resource) => resource.id === projected.assignments[0].tasks[0].resourceId);
  assert.match(selected.url, /WD101_13\.mp3$/);
  assert.ok(selected.durationSeconds > 0);
  assert.equal(selected.durationSeconds, audioVariants(source()).find((variant) => variant.speedWpm === 13).durationSeconds);
  assert.equal(projected.assignments[0].tasks[0].minimumPasses, 2);
  assert.equal(projected.assignments[0].tasks[0].speedWpm, 10);
});

test("recording notes distinguish actual and assigned speed and preserve the exact source URL", () => {
  const selected = selectAudioVariant(source(), 10, "next", 20);
  const note = audioRecordingNote(task(), selected);
  assert.match(note, /Audio recording: WD101-20 \(20 WPM\); assigned 10 WPM/);
  assert.ok(note.endsWith(selected.url));
  const unknown = source({ title: "Instructor recording", url: "https://example.invalid/recording.mp3" });
  assert.equal(audioRecordingNote(task(), unknown), "Audio recording: Instructor recording; assigned 10 WPM. Source: https://example.invalid/recording.mp3");
  assert.match(audioRecordingNote(task({ speedWpm: undefined }), undefined), /assigned speed not specified/);
  assert.equal(audioRecordingNote(task({ kind: "sending" }), source()), "");
});
