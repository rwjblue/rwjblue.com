import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildTrackerData,
  mergeProfileActivations,
} from "../src/lib/pota/ri-tracker.ts";

const parks = [
  {
    reference: "US-7865",
    name: "East State Beach",
    latitude: 41.3481,
    longitude: -71.6733,
    grid: "FN41di",
    locationDesc: "US-RI",
    attempts: 61,
    activations: 61,
    qsos: 1948,
  },
  {
    reference: "US-4582",
    name: "Washington-Rochambeau Revolutionary Route National Historic Trail",
    latitude: 41.312,
    longitude: -73.9709,
    grid: "FN31ah",
    locationDesc: "US-CT,US-DC,US-DE,US-MA,US-MD,US-NJ,US-NY,US-PA,US-RI,US-VA",
    attempts: 2518,
    activations: 2471,
    qsos: 102631,
  },
  {
    reference: "US-0515",
    name: "Ninigret National Wildlife Refuge",
    latitude: 41.3682,
    longitude: -71.6716,
    grid: "FN41di",
    locationDesc: "US-RI",
    attempts: 145,
    activations: 129,
    qsos: 3723,
  },
];

const profile = {
  callsign: "N1RWJ",
  other_callsigns: ["KC1YDM", "KB9SMK"],
  recent_activity: {
    activations: [
      {
        date: "2026-05-25",
        reference: "US-7865",
        park: "East State Beach",
        location: "US-RI",
        cw: 15,
        data: 0,
        phone: 0,
        total: 15,
      },
    ],
  },
};

const ledger = {
  activations: [
    {
      reference: "US-0515",
      park: "Ninigret National Wildlife Refuge",
      date: "2025-12-30",
      callsign: "KC1YDM",
      qsos: { total: 11, cw: 11, data: 0, phone: 0 },
      source: "backfill",
    },
  ],
};

const notes = [
  {
    id: "2026-05-25-pota-rove",
    title: "2026-05-25 POTA Rove",
    date: "2026-05-25",
    tags: ["radio", "pota", "us-7865", "US-0515"],
  },
];

test("profile activity merges into the durable activation ledger", () => {
  const merged = mergeProfileActivations(ledger, profile);

  assert.deepEqual(
    merged.activations.map((activation) => activation.reference).sort(),
    ["US-0515", "US-7865"],
  );

  const profileActivation = merged.activations.find(
    (activation) => activation.reference === "US-7865",
  );

  assert.equal(profileActivation.callsign, "N1RWJ");
  assert.equal(profileActivation.qsos.total, 15);
  assert.equal(profileActivation.source, "profile");
});

test("tracker data includes all parks and keeps multi-state references", () => {
  const tracker = buildTrackerData({
    parks,
    ledger,
    profile,
    notes,
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  assert.equal(tracker.summary.total, 3);
  assert.deepEqual(
    tracker.references.map((reference) => reference.reference),
    ["US-4582", "US-7865", "US-0515"],
  );
  assert.equal(
    tracker.references.find((reference) => reference.reference === "US-4582")
      .locationDesc,
    "US-CT,US-DC,US-DE,US-MA,US-MD,US-NJ,US-NY,US-PA,US-RI,US-VA",
  );
});

test("completion can come from any known callsign and old ledger entries remain", () => {
  const tracker = buildTrackerData({
    parks,
    ledger,
    profile,
    notes: [],
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  const ninigret = tracker.references.find(
    (reference) => reference.reference === "US-0515",
  );

  assert.equal(ninigret.status, "completed");
  assert.equal(ninigret.firstActivation.date, "2025-12-30");
  assert.equal(ninigret.firstActivation.callsign, "KC1YDM");
  assert.equal(tracker.summary.completed, 2);
});

test("sub-10 QSO attempts do not complete a reference", () => {
  const tracker = buildTrackerData({
    parks,
    ledger: {
      activations: [
        {
          reference: "US-4582",
          park: "Washington-Rochambeau Revolutionary Route National Historic Trail",
          date: "2026-03-29",
          callsign: "N1RWJ",
          qsos: { total: 9, cw: 9, data: 0, phone: 0 },
          source: "backfill",
        },
      ],
    },
    profile: { ...profile, recent_activity: { activations: [] } },
    notes: [],
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  const route = tracker.references.find(
    (reference) => reference.reference === "US-4582",
  );

  assert.equal(route.status, "remaining");
  assert.equal(route.firstActivation, null);
  assert.equal(route.latestActivation, null);
  assert.equal(route.activationCount, 0);
  assert.equal(tracker.summary.completed, 0);
});

test("first and latest activations use only single-day 10-plus QSO activations", () => {
  const tracker = buildTrackerData({
    parks,
    ledger: {
      activations: [
        {
          reference: "US-0515",
          park: "Ninigret National Wildlife Refuge",
          date: "2025-12-30",
          callsign: "KC1YDM",
          qsos: { total: 4, cw: 4, data: 0, phone: 0 },
          source: "backfill",
        },
        {
          reference: "US-0515",
          park: "Ninigret National Wildlife Refuge",
          date: "2026-01-02",
          callsign: "KC1YDM",
          qsos: { total: 11, cw: 11, data: 0, phone: 0 },
          source: "backfill",
        },
        {
          reference: "US-0515",
          park: "Ninigret National Wildlife Refuge",
          date: "2026-01-03",
          callsign: "KC1YDM",
          qsos: { total: 2, cw: 2, data: 0, phone: 0 },
          source: "backfill",
        },
      ],
    },
    profile: { ...profile, recent_activity: { activations: [] } },
    notes: [],
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  const ninigret = tracker.references.find(
    (reference) => reference.reference === "US-0515",
  );

  assert.equal(ninigret.status, "completed");
  assert.equal(ninigret.firstActivation.date, "2026-01-02");
  assert.equal(ninigret.latestActivation.date, "2026-01-02");
  assert.equal(ninigret.activationCount, 1);
  assert.equal(tracker.summary.completed, 1);
});

test("note tags link field notes to matching references", () => {
  const tracker = buildTrackerData({
    parks,
    ledger,
    profile,
    notes,
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  const eastBeach = tracker.references.find(
    (reference) => reference.reference === "US-7865",
  );
  const ninigret = tracker.references.find(
    (reference) => reference.reference === "US-0515",
  );

  assert.deepEqual(eastBeach.notes, [
    {
      id: "2026-05-25-pota-rove",
      title: "2026-05-25 POTA Rove",
      date: "2026-05-25",
      href: "/notes/2026-05-25-pota-rove/",
    },
  ]);
  assert.deepEqual(ninigret.notes, eastBeach.notes);
});

test("tracker references expose local canonical park hrefs", () => {
  const tracker = buildTrackerData({
    parks,
    ledger,
    profile,
    notes,
    generatedAt: "2026-05-26T12:00:00.000Z",
  });

  const eastBeach = tracker.references.find(
    (reference) => reference.reference === "US-7865",
  );

  assert.equal(eastBeach.href, "/radio/pota/US-7865/");
  assert.equal(eastBeach.potaUrl, "https://pota.app/#/park/US-7865");
});
