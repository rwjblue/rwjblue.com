import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRiPotaPublicStats,
  readRiPotaParks,
} from "../src/lib/pota/ri-park-source.ts";

const apiParks = () =>
  readRiPotaParks().map((park, index) => ({
    reference: park.reference,
    name: park.name,
    latitude: park.latitude,
    longitude: park.longitude,
    grid: park.grid,
    counties: park.counties,
    locationDesc: park.locationDesc,
    potaUrl: `https://pota.app/#/park/${park.reference}`,
    attempts: index + 1,
    activations: index + 2,
    qsos: String(index + 3),
  }));

test("RI park source exposes package metadata and reviewed map points", () => {
  const parks = readRiPotaParks();
  const route = parks.find((park) => park.reference === "US-4582");

  assert.equal(parks.length, 61);
  assert.equal(
    route?.name,
    "Washington-Rochambeau Revolutionary Route National Historic Trail",
  );
  assert.equal(route?.grid, "FN31ah");
  assert.deepEqual(route?.mapPoint, {
    latitude: 41.7445710002769,
    longitude: -71.594458000176,
    notes:
      "Reviewed map point on the NPS Rhode Island route segment near the center of the state. The official POTA coordinate represents the multi-state trail and is outside Rhode Island.",
  });
});

test("RI public statistics remain a derived API projection", () => {
  const stats = buildRiPotaPublicStats(
    apiParks(),
    "2026-09-04T12:00:00.000Z",
  );
  const parks = readRiPotaParks(stats);

  assert.equal(stats.parks.length, 61);
  assert.equal(stats.parks[0].qsos, 3);
  assert.equal(parks[0].attempts, 1);
  assert.equal(parks[0].activations, 2);
  assert.equal(parks[0].qsos, 3);
});

test("RI public statistics reject metadata drift from the POTA API", () => {
  const parks = apiParks();
  parks[0] = { ...parks[0], name: "Changed upstream" };

  assert.throws(
    () => buildRiPotaPublicStats(parks, "2026-09-04T12:00:00.000Z"),
    /changed US-0513\.name.*Release the updated park data and bump/,
  );
});
