import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertBkgRosterSize,
  buildBkgFiles,
  parseBkgRoster,
} from "../scripts/calls-of-note/update-bkg.mjs";

function card(call, number, badges = "", extraClass = "") {
  return `<div class="member-card ${extraClass}">${badges}<div class="member-info"><a class="member-callsign">${call}</a><div class="member-number">BKG #${number}</div><div class="member-name">Unrelated personal name</div></div></div>`;
}

function roster(cards) {
  return `<section id="roster"><div class="roster-grid">${cards}</div></section>`;
}

test("BKG uses explicit state/country titles, generic OG text, and omits absent badges and ghost cards", () => {
  const members = parseBkgRoster(roster([
    card("N1RWJ", "256", '<div class="state-og-badge" title="RI OG">RI OG</div>'),
    card("W1VES", "002", '<div class="og-badge">OG</div>'),
    card("DL9SCO", "053", '<div class="state-og-badge" title="Germany OG">🇩🇪 OG</div>'),
    card("N8JMS", "019"),
    card("??????", "486", "", "ghost"),
  ].join("")));

  assert.deepEqual(members, [
    { call: "DL9SCO", number: "053", note: "BKG #053 | Germany OG" },
    { call: "N1RWJ", number: "256", note: "BKG #256 | RI OG" },
    { call: "N8JMS", number: "019", note: "BKG #019" },
    { call: "W1VES", number: "002", note: "BKG #002 | OG" },
  ]);
  const { text, metadata } = buildBkgFiles(members, "2026-09-16T12:00:00.000Z");
  assert.match(text, /^N1RWJ BKG #256 \| RI OG$/m);
  assert.match(text, /^N8JMS BKG #019$/m);
  assert.doesNotMatch(text, /Unrelated|No OG|486/);
  assert.equal(metadata.memberCount, 4);
  assert.deepEqual(metadata.samples.map((member) => member.call), ["N1RWJ", "W1VES", "N8JMS"]);
});

test("BKG rejects malformed pages, missing fields, invalid badges, and conflicting assignments", () => {
  assert.throws(() => parseBkgRoster("<html>Access denied</html>"), /roster section/);
  assert.throws(() => parseBkgRoster(roster('<div class="member-card"><div class="member-number">BKG #001</div></div>')), /member-callsign/);
  assert.throws(() => parseBkgRoster(roster(card("N1RWJ", "256", '<div class="og-badge">New!</div>'))), /Invalid BKG OG badge/);
  assert.throws(() => parseBkgRoster(roster(card("N1RWJ", "256") + card("N1RWJ", "257"))), /Conflicting BKG entries/);
  assert.throws(() => parseBkgRoster(roster(card("N1RWJ", "256") + card("W1VES", "256"))), /multiple callsigns/);
  assert.throws(() => parseBkgRoster(`<!-- MEMBER_COUNT:START -->2<!-- MEMBER_COUNT:END -->${roster(card("N1RWJ", "256"))}`), /advertises 2 members but parsed 1/);
});

test("BKG deduplicates identical cards and blocks empty or catastrophically smaller updates", () => {
  assert.equal(parseBkgRoster(roster(card("N1RWJ", "256") + card("N1RWJ", "256"))).length, 1);
  assert.throws(() => assertBkgRosterSize(0, 485), /only 0/);
  assert.throws(() => assertBkgRosterSize(100, 485), /shrank from 485 to 100/);
  assert.throws(() => assertBkgRosterSize(485, Number.NaN), /Previous BKG member count is invalid/);
  assert.doesNotThrow(() => assertBkgRosterSize(485, 481));
});
