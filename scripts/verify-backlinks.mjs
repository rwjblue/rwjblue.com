import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const park = read("dist/radio/pota/US-6991/index.html");
const beacons = read("dist/radio/beacons/index.html");
const noBacklinks = read("dist/radio/cw-qso/index.html");

assert.match(park, /Referenced by/);
assert.match(
  park,
  /href="\/notes\/2026-06-19-rhode-island-to-florida-rove-day-one\/"/,
);
assert.match(beacons, /Referenced by/);
assert.match(
  beacons,
  /href="\/notes\/2026-07-23-learning-to-read-the-bands-with-ncdxf-beacons\/"/,
);
assert.doesNotMatch(noBacklinks, /Referenced by/);
