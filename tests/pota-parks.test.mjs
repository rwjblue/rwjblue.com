import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPotaParkPages } from "../src/lib/pota/parks.ts";

const parks = [
  {
    reference: "US-6992",
    name: "JL Curran State Park",
    latitude: 41.7448,
    longitude: -71.5488,
    grid: "FN41fr",
    locationDesc: "US-RI",
    attempts: 120,
    activations: 118,
    qsos: 4021,
  },
  {
    reference: "US-0516",
    name: "Sachuest Point National Wildlife Refuge",
    latitude: 41.4798,
    longitude: -71.2436,
    grid: "FN41jl",
    locationDesc: "US-RI",
  },
];

const activations = [
  {
    reference: "US-6992",
    park: "JL Curran State Park",
    date: "2026-05-28",
    callsign: "N1RWJ",
    qsos: { total: 11, cw: 11, data: 0, phone: 0 },
    source: "profile",
  },
  {
    reference: "US-6992",
    park: "JL Curran State Park",
    date: "2026-05-20",
    callsign: "N1RWJ",
    qsos: { total: 23, cw: 23, data: 0, phone: 0 },
    source: "profile",
  },
];

const notes = [
  {
    id: "2026-06-03-jl-curran-state-park-pota",
    title: "JL Curran State Park Pack Mule Activation",
    date: "2026-05-28",
    tags: ["radio", "pota", "us-6992"],
  },
];

test("buildPotaParkPages lists all activations newest first", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.equal(curran.href, "/radio/pota/US-6992/");
  assert.deepEqual(
    curran.activations.map((activation) => activation.date),
    ["2026-05-28", "2026-05-20"],
  );
  assert.equal(curran.activationCount, 2);
  assert.equal(curran.qsoTotal, 34);
});

test("buildPotaParkPages attaches field notes by matching date and tag", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.deepEqual(curran.activations[0].notes, [
    {
      id: "2026-06-03-jl-curran-state-park-pota",
      title: "JL Curran State Park Pack Mule Activation",
      date: "2026-05-28",
      href: "/notes/2026-06-03-jl-curran-state-park-pota/",
    },
  ]);
  assert.deepEqual(curran.activations[1].notes, []);
});

test("buildPotaParkPages labels RI challenge qualifying activations", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [
      {
        id: "2026-ri-pota",
        label: "2026 RI POTA Challenge",
        href: "/projects/2026-activate-all-ri-pota/",
        references: ["US-6992"],
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        minimumQsos: 10,
      },
    ],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.deepEqual(curran.activations[0].projects, [
    {
      id: "2026-ri-pota",
      label: "2026 RI POTA Challenge",
      href: "/projects/2026-activate-all-ri-pota/",
    },
  ]);
});
