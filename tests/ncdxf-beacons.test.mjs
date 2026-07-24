import assert from "node:assert/strict";
import test from "node:test";

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
