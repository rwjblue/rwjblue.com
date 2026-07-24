import assert from "node:assert/strict";
import test from "node:test";

import { gridToLatLon } from "../src/lib/geo.ts";
import {
  NCDXF_BANDS,
  NCDXF_BEACONS,
  beaconWindowAt,
  powerLabel,
  powerMarginDb,
  summarizeBandObservations,
  transmissionAt,
} from "../src/lib/ncdxf-beacons.ts";

test("NCDXF data defines the five bands and eighteen scheduled beacons", () => {
  assert.equal(NCDXF_BANDS.length, 5);
  assert.equal(NCDXF_BEACONS.length, 18);
  assert.deepEqual(
    NCDXF_BANDS.map((band) => band.frequencyMHz),
    [14.1, 18.11, 21.15, 24.93, 28.2],
  );
});

test("official beacon grids resolve to their expected world locations", () => {
  const expected = {
    "4U1UN": [40.771, -73.958],
    VE8AT: [68.313, -133.458],
    W6WX: [37.146, -121.875],
    KH6RS: [20.771, -156.375],
    ZL6B: [-41.063, 175.625],
    VK6RBP: [-32.104, 116.042],
    JA2IGY: [34.438, 136.792],
    RR9O: [54.979, 82.875],
    VR2B: [22.271, 114.125],
    "4S7B": [6.896, 79.875],
    ZS6DN: [-26.646, 27.958],
    "5Z4B": [-1.271, 36.625],
    "4X6TU": [32.063, 34.792],
    OH2B: [60.313, 24.375],
    CS3B: [32.813, -17.208],
    LU4AA: [-34.604, -58.375],
    OA4B: [-12.063, -76.958],
    YV5B: [10.146, -66.875],
  };

  const resolved = Object.fromEntries(
    NCDXF_BEACONS.map((beacon) => {
      const point = gridToLatLon(beacon.grid);
      assert.ok(point, `${beacon.call} should have a valid grid`);
      return [
        beacon.call,
        [Number(point.lat.toFixed(3)), Number(point.lon.toFixed(3))],
      ];
    }),
  );

  assert.deepEqual(resolved, expected);
});

test("transmissionAt follows the staggered ten-second schedule", () => {
  const atCycleStart = new Date("2026-07-23T12:00:00Z");
  assert.equal(transmissionAt(atCycleStart, 0).beacon.call, "4U1UN");
  assert.equal(transmissionAt(atCycleStart, 1).beacon.call, "YV5B");
  assert.equal(transmissionAt(atCycleStart, 4).beacon.call, "CS3B");

  const twentySecondsLater = new Date("2026-07-23T12:00:20Z");
  assert.equal(transmissionAt(twentySecondsLater, 0).beacon.call, "W6WX");
  assert.equal(transmissionAt(twentySecondsLater, 1).beacon.call, "VE8AT");
  assert.equal(transmissionAt(twentySecondsLater, 2).beacon.call, "4U1UN");
});

test("beaconWindowAt follows one beacon upward through all five bands", () => {
  const cs3bIndex = NCDXF_BEACONS.findIndex((beacon) => beacon.call === "CS3B");
  const state = beaconWindowAt(new Date("2026-07-23T12:00:00Z"), cs3bIndex);

  assert.equal(state.activeBand?.label, "10 m");
  assert.equal(state.secondsRemaining, 10);
  assert.equal(state.nextBand.label, "20 m");
  assert.equal(state.secondsUntilNext, 140);
});

test("power labels and margins describe the four transmitted levels", () => {
  assert.equal(powerLabel("0.1"), "100 mW");
  assert.equal(powerLabel("none"), "Not heard");
  assert.equal(powerMarginDb("100"), 0);
  assert.equal(powerMarginDb("1"), 20);
  assert.equal(powerMarginDb("0.1"), 30);
  assert.equal(powerMarginDb("none"), null);
});

test("band summaries rank the strongest local observation first", () => {
  const observations = [
    { bandIndex: 0, beaconIndex: 14, power: "10", observedAt: "2026-07-23T12:00:00Z" },
    { bandIndex: 0, beaconIndex: 15, power: "none", observedAt: "2026-07-23T12:00:10Z" },
    { bandIndex: 1, beaconIndex: 14, power: "1", observedAt: "2026-07-23T12:00:20Z" },
  ];

  const summaries = summarizeBandObservations(observations);
  assert.equal(summaries[0].band.label, "17 m");
  assert.equal(summaries[0].bestPower, "1");
  assert.equal(summaries[1].band.label, "20 m");
  assert.equal(summaries[1].checked, 2);
  assert.equal(summaries[1].heard, 1);
});
