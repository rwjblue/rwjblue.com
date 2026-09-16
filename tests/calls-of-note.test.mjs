import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRefreshSafe, createOutputs, downloadRoster, parseCsv, parseRoster,
} from "../scripts/calls-of-note/update-cwops.mjs";

const header = 'Paid\nThru,Callsign,Number,First or\nNick Name,W/VE'.split(",");
const csvRow = (row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",");
const rosterCsv = (rows, columns = header) => [
  "CWops MEMBER ROSTER,,,,", csvRow(columns), ...rows.map(csvRow), "",
].join("\r\n");

test("CSV handles BOM, CRLF, quoted commas/newlines and escaped quotes", () => {
  assert.deepEqual(parseCsv('\uFEFFName,Note\r\n"A, B","Line 1\nLine ""2"""\r\n'), [
    ["Name", "Note"], ["A, B", 'Line 1\nLine "2"'],
  ]);
  assert.deepEqual(parseCsv('A,""'), [["A", ""]]);
  assert.throws(() => parseCsv('A,"unterminated'), /unterminated/);
  assert.throws(() => parseCsv('A,"closed"extra'), /closing quote/);
  assert.throws(() => parseCsv('A,un"quoted'), /unquoted field/);
});

test("roster preserves separate alternate calls, names and membership identity", () => {
  const roster = parseRoster(rosterCsv([
    ["LIFE", " ki2d ", "123", " Sebast\u00e1n ", "--"],
    ["2026", "EA1/KI2D", "123", "Sebast\u00e1n", "--"],
    ["LIFE", "VE5ABC", "456", "Pat /\nSam", "SK"],
    ["2026", "EA1/KI2D", "123", "Sebast\u00e1n", "--"],
  ]));
  assert.equal(roster.memberCount, 2);
  assert.equal(roster.callsignCount, 3);
  assert.equal(roster.excludedSilentKeys, 0);
  assert.deepEqual(roster.entries, [
    { call: "EA1/KI2D", name: "Sebast\u00e1n", number: "123", note: "Sebast\u00e1n | CWops #123" },
    { call: "KI2D", name: "Sebast\u00e1n", number: "123", note: "Sebast\u00e1n | CWops #123" },
    { call: "VE5ABC", name: "Pat / Sam", number: "456", note: "Pat / Sam | CWops #456" },
  ]);
});

test("explicit silent-key status excludes a member's alternate calls too", () => {
  const roster = parseRoster(rosterCsv([
    ["LIFE", "K1ABC", "123", "Alex", "--"],
    ["SK", "W1ABC", "123", "Alex", "--"],
    ["Silent Key", "N1ABC", "123", "Alex", "--"],
    ["Club", "W1XYZ", "456", "Club", "--"],
  ]));
  assert.deepEqual(roster.entries.map(({ call }) => call), ["W1XYZ"]);
  assert.equal(roster.excludedSilentKeys, 1);
});

test("roster rejects unknown layouts and invalid records instead of silently dropping them", () => {
  const valid = ["LIFE", "K1ABC", "123", "Alex", "--"];
  assert.throws(() => parseRoster("<html>Login required</html>"), /layout/);
  assert.throws(() => parseRoster(rosterCsv([valid], ["Paid Thru", "Call", "Number", "First or Nick Name", "W/VE"])), /layout/);
  assert.throws(() => parseRoster(rosterCsv([valid], [...header, "Number"])), /duplicate Number/);
  assert.throws(() => parseRoster(rosterCsv([valid, header])), /header row/);
  assert.throws(() => parseRoster(rosterCsv([valid.slice(0, 4)])), /columns/);
  for (const [column, value, pattern] of [
    [0, "Deceased", /Unknown membership status/],
    [1, "K1ABC, W1ABC", /Invalid callsign/],
    [2, "123?", /Invalid membership number/],
    [3, "", /Invalid membership number or name/],
  ]) {
    const row = [...valid];
    row[column] = value;
    assert.throws(() => parseRoster(rosterCsv([row])), pattern);
  }
});

test("conflicting callsign ownership or display names require review", () => {
  for (const alternate of [["456", "Alex"], ["123", "Other"]]) {
    assert.throws(() => parseRoster(rosterCsv([
      ["LIFE", "K1ABC", "123", "Alex", "--"],
      ["2026", "K1ABC", ...alternate, "--"],
    ])), /Conflicting CWops entries/);
  }
});

test("PoLo output is plain text, one note per callsign, with provenance comments", () => {
  const roster = parseRoster(rosterCsv([["LIFE", "K1ABC", "123", "Alex", "--"]]));
  const { metadata, notes } = createOutputs(roster, "2026-09-16T12:00:00.000Z");
  assert.equal(metadata.retrievedAt, "2026-09-16T12:00:00.000Z");
  assert.deepEqual(metadata.samples, roster.entries);
  assert.match(notes, /# Source: https:\/\/cwops\.org\//);
  assert.deepEqual(notes.split("\n").filter((line) => line && !line.startsWith("#")), ["K1ABC Alex | CWops #123"]);
});

test("refresh rejects an incomplete roster or a sudden loss of members or aliases", () => {
  assert.throws(() => assertRefreshSafe({ memberCount: 999, callsignCount: 1000 }), /fewer than/);
  assert.throws(() => assertRefreshSafe({ memberCount: 2500, callsignCount: 3300 }, { memberCount: 3000, callsignCount: 3400 }), /memberCount fell/);
  assert.throws(() => assertRefreshSafe({ memberCount: 3000, callsignCount: 3000 }, { memberCount: 3000, callsignCount: 3400 }), /callsignCount fell/);
  assert.doesNotThrow(() => assertRefreshSafe({ memberCount: 3000, callsignCount: 3392 }, { memberCount: 3020, callsignCount: 3400 }));
});

test("download rejects HTTP errors and non-roster responses", async () => {
  await assert.rejects(downloadRoster(async () => new Response("Unavailable", { status: 503 })), /HTTP 503/);
  await assert.rejects(downloadRoster(async () => new Response("<html>Login required</html>")), /layout/);
});
