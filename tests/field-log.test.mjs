import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFieldLog,
  matchesFieldLogFilters,
} from "../src/lib/field-log.ts";

const park = {
  reference: "US-1234",
  name: "Example Park",
  href: "/radio/pota/US-1234/",
  latitude: 41.5,
  longitude: -71.5,
  activations: [
    {
      date: "2026-06-20",
      callsign: "N1RWJ",
      qsos: { total: 12, cw: 10, data: 0, phone: 2 },
      notes: [
        { id: "public", title: "Public report", href: "/notes/public/" },
        { id: "draft", title: "Draft report", href: "/notes/draft/" },
      ],
      projects: [],
    },
    {
      date: "2025-09-21",
      callsign: "N1RWJ",
      qsos: { total: 10, cw: 0, data: 10, phone: 0 },
      notes: [],
      projects: [],
    },
  ],
};

test("field log associates only public reports and reuses series metadata", () => {
  const entries = buildFieldLog([park], [
    {
      id: "public",
      series: { slug: "trip", title: "Trip" },
    },
  ]);

  assert.deepEqual(entries.map((entry) => entry.date), [
    "2026-06-20",
    "2025-09-21",
  ]);
  assert.deepEqual(entries[0].notes.map((note) => note.id), ["public"]);
  assert.equal(entries[0].series.slug, "trip");
  assert.equal(entries[0].trip, "trip");
});

test("field log filters combine year, mode, and trip", () => {
  const [entry] = buildFieldLog([park], [
    {
      id: "public",
      series: { slug: "trip", title: "Trip" },
    },
  ]);

  assert.equal(
    matchesFieldLogFilters(entry, {
      year: "2026",
      mode: "cw",
      trip: "trip",
    }),
    true,
  );
  assert.equal(matchesFieldLogFilters(entry, { mode: "data" }), false);
  assert.equal(matchesFieldLogFilters(entry, { year: "2025" }), false);
});
