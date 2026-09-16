import assert from "node:assert/strict";
import test from "node:test";
import { parseFragment } from "parse5";
import { sendingReadingHtml, sendingScaleSections } from "../src/lib/cw-training/sending-reading.ts";

// Synthetic material only; the imported course remains private.
test("scales omit the prelude and revision date, retaining selected sections in uppercase", () => {
  const sections = sendingScaleSections("Fixture title\nPractice instructions\nWarm Up\nzzzzz yyyyy\nDrill\nSend a test\nNov – 2018");
  assert.deepEqual(sections, [
    { title: "Warm-up", rows: [{ kind: "groups", groups: [{ text: "ZZZZZ" }, { text: "YYYYY" }] }] },
    { title: "Drill", rows: [{ kind: "prose", groups: [{ text: "SEND A TEST" }] }] },
  ]);
  assert.deepEqual(sendingScaleSections("Warm-up\nxxxxx\nExercise\n99999").map(section => section.title), ["Warm-up", "Exercise"]);
  assert.deepEqual(sendingScaleSections("Drill\nSend a test\nNov – 2018\nExercise\n99999")[0], sections[1]);
});

test("punctuation runs retain five characters and keep each prosign on its own group", () => {
  const sections = sendingScaleSections("Drill\n/ / / / / , , , , , . . . . . ? ? ? ? ? * * * * * + + + + + = = = = =\n<DN> <sk> <ar> <BT>");
  assert.deepEqual(sections[0].rows, [{ kind: "groups", groups: [
    { text: "/////", annotation: "DN" }, { text: ",,,,," }, { text: "....." }, { text: "?????" },
    { text: "*****", annotation: "SK" }, { text: "+++++", annotation: "AR" }, { text: "=====", annotation: "BT" },
  ] }]);
  assert.equal(sendingScaleSections("Drill\n///// ***** +++++ =====\n<DN> <SK> <AR> <BT>")[0].rows.length, 1);
});

test("repeated phrases are separate units without changing their count or words", () => {
  const [section] = sendingScaleSections("Drill\nTest this wire/7 Test this wire/7 Test this wire/7");
  assert.deepEqual(section.rows, [{ kind: "phrases", groups: Array.from({ length: 3 }, () => ({ text: "TEST THIS WIRE/7" })) }]);
});

test("unknown annotation lines are retained instead of silently attached or lost", () => {
  const [section] = sendingScaleSections("Drill\n/ / /\n<DN> <XYZ>");
  assert.equal(section.rows.length, 2);
  assert.equal(section.rows[1].groups[0].text, "<DN> <XYZ>");
});

test("reader uses semantic headings and places escaped annotations inside their group", () => {
  const html = sendingReadingHtml("Warm Up\nxxxxx\nDrill\n* * * * *\n<sk>", true);
  const root = parseFragment(html);
  assert.deepEqual(root.childNodes.map(node => node.tagName), ["section", "section"]);
  assert.equal(root.childNodes[0].childNodes[0].tagName, "h3");
  const group = root.childNodes[1].childNodes[1].childNodes[0];
  assert.equal(group.childNodes[0].childNodes[0].value, "*****");
  assert.equal(group.childNodes[1].tagName, "small");
  assert.equal(group.childNodes[1].childNodes[0].value, "SK");
  assert.doesNotMatch(sendingReadingHtml('Warm Up\n<img src=x onerror="bad()">', true), /<img/);
});

test("custom material and unrecognized scales retain text, whitespace, and casing safely", () => {
  const text = 'Warm Up\nMixed case   <example> & "quoted"';
  for (const html of [sendingReadingHtml(text), sendingReadingHtml("Unknown\n" + text.split("\n")[1], true)]) {
    const fragment = parseFragment(html);
    assert.equal(fragment.childNodes[0].tagName, "div");
    assert.match(fragment.childNodes[0].childNodes[0].value, /Mixed case   <example> & "quoted"/);
  }
});
