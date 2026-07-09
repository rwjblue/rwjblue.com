import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceKilometers,
  distanceMiles,
  gridToLatLon,
} from "../src/lib/geo.ts";

test("gridToLatLon returns normalized lat/lon objects for valid grids", () => {
  assert.deepEqual(roundPoint(gridToLatLon("EL96")), { lat: 26.5, lon: -81 });
  assert.deepEqual(roundPoint(gridToLatLon("EL96WD")), {
    lat: 26.1458,
    lon: -80.125,
  });
});

test("gridToLatLon returns null for invalid grids", () => {
  assert.equal(gridToLatLon("EL9"), null);
  assert.equal(gridToLatLon("ZZ99AA"), null);
  assert.equal(gridToLatLon("not-a-grid"), null);
});

test("distance helpers return great-circle distances in expected units", () => {
  const singerIsland = { lat: 26.7886381, lon: -80.0337704 };
  const nu4f = gridToLatLon("EL96WD");

  assert.ok(nu4f);
  assert.equal(Number(distanceMiles(singerIsland, nu4f).toFixed(1)), 44.8);
  assert.equal(Number(distanceKilometers(singerIsland, nu4f).toFixed(1)), 72.1);
});

function roundPoint(point) {
  if (!point) return null;
  return {
    lat: Number(point.lat.toFixed(4)),
    lon: Number(point.lon.toFixed(4)),
  };
}
