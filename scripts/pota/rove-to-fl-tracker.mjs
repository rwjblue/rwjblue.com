#!/usr/bin/env -S node --experimental-strip-types

/**
 * Build and refresh park data for the 2026 RI→FL rove trip.
 *
 * Fetches parks from the POTA API for each state along the I-95 corridor,
 * filters to parks near the route, and writes src/data/pota/rove-to-fl.json
 * for the project page.
 *
 * Usage:
 *   node --experimental-strip-types scripts/pota/rove-to-fl-tracker.mjs update-parks
 *   node --experimental-strip-types scripts/pota/rove-to-fl-tracker.mjs build-tracker-data
 *   node --experimental-strip-types scripts/pota/rove-to-fl-tracker.mjs update-tracker
 *   mise run pota:rove-to-fl:update-tracker
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, "data/pota/rove-to-fl/cache");
const trackerDataPath = path.join(root, "src/data/pota/rove-to-fl.json");

// States along the route with I-95 corridor bounding boxes.
// Boxes are intentionally generous (roughly within 75 km of the highway)
// so interesting detour parks are included.
const ROUTE_STATES = [
  {
    code: "US-CT",
    name: "Connecticut",
    latMin: 41.0,
    latMax: 42.1,
    lonMin: -73.9,
    lonMax: -71.8,
  },
  {
    code: "US-NY",
    name: "New York",
    // Narrow: only the Bronx/Westchester/Long Island Sound corridor
    latMin: 40.6,
    latMax: 41.15,
    lonMin: -74.15,
    lonMax: -73.5,
  },
  {
    code: "US-NJ",
    name: "New Jersey",
    latMin: 38.9,
    latMax: 41.4,
    lonMin: -75.5,
    lonMax: -73.9,
  },
  {
    code: "US-PA",
    name: "Pennsylvania",
    // Philadelphia / Delaware Valley corridor between NJ and DE
    latMin: 39.7,
    latMax: 40.3,
    lonMin: -75.6,
    lonMax: -74.8,
  },
  {
    code: "US-DE",
    name: "Delaware",
    latMin: 38.4,
    latMax: 39.9,
    lonMin: -76.0,
    lonMax: -74.8,
  },
  {
    code: "US-MD",
    name: "Maryland",
    latMin: 38.0,
    latMax: 39.8,
    lonMin: -77.5,
    lonMax: -75.5,
  },
  {
    code: "US-VA",
    name: "Virginia",
    latMin: 36.5,
    latMax: 38.9,
    lonMin: -78.0,
    lonMax: -76.0,
  },
  {
    code: "US-NC",
    name: "North Carolina",
    // I-95 runs through eastern NC; wider box to catch coastal parks too
    latMin: 33.8,
    latMax: 36.6,
    lonMin: -80.5,
    lonMax: -75.5,
  },
  {
    code: "US-SC",
    name: "South Carolina",
    latMin: 32.0,
    latMax: 35.2,
    lonMin: -82.0,
    lonMax: -79.0,
  },
  {
    code: "US-GA",
    name: "Georgia",
    // I-95 runs along the eastern coast through Brunswick/Savannah
    latMin: 30.3,
    latMax: 32.2,
    lonMin: -82.0,
    lonMax: -80.5,
  },
  {
    code: "US-FL",
    name: "Florida",
    // East-coast FL from Jacksonville to Singer Island/Palm Beach
    latMin: 24.5,
    latMax: 30.8,
    lonMin: -81.5,
    lonMax: -79.5,
  },
];

async function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, filePath);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA rove tracker",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GET ${url} → ${response.status}`);
  return response.json();
}

function relative(p) {
  return path.relative(root, p);
}

async function updateParks() {
  for (const state of ROUTE_STATES) {
    const cachePath = path.join(cacheDir, `parks-${state.code}.json`);
    process.stdout.write(`Fetching ${state.code}... `);
    try {
      const parks = await fetchJson(
        `https://api.pota.app/location/parks/${state.code}`
      );
      await writeJson(cachePath, parks);
      console.log(`${parks.length} parks → ${relative(cachePath)}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
}

function inCorridorBox(park, state) {
  return (
    park.latitude >= state.latMin &&
    park.latitude <= state.latMax &&
    park.longitude >= state.lonMin &&
    park.longitude <= state.lonMax
  );
}

async function buildTrackerData() {
  const route = [];
  const parks = [];

  for (const state of ROUTE_STATES) {
    const cachePath = path.join(cacheDir, `parks-${state.code}.json`);

    if (!existsSync(cachePath)) {
      console.error(
        `Missing cache for ${state.code} — run update-parks first.`
      );
      process.exitCode = 1;
      return;
    }

    const raw = await readJson(cachePath);
    const all = Array.isArray(raw) ? raw : raw?.parks ?? [];
    const corridor = all.filter((p) => inCorridorBox(p, state));

    route.push({
      code: state.code,
      name: state.name,
      total: all.length,
      corridorCount: corridor.length,
    });

    for (const p of corridor) {
      parks.push({
        reference: p.reference,
        name: p.name,
        state: state.code,
        stateName: state.name,
        latitude: p.latitude,
        longitude: p.longitude,
        grid: p.grid ?? null,
        status: "corridor",
        attempts: p.attempts ?? 0,
        activations: p.activations ?? 0,
        qsos: p.qsos ?? 0,
      });
    }

    console.log(
      `${state.code}  ${all.length} total → ${corridor.length} in corridor`
    );
  }

  const data = {
    generatedAt: new Date().toISOString(),
    destination: { name: "Singer Island / Riviera Beach, FL", arriveBy: "2026-06-26" },
    fieldDay: "2026-06-27",
    route,
    parks,
  };

  await writeJson(trackerDataPath, data);
  console.log(
    `\nWrote ${parks.length} corridor parks to ${relative(trackerDataPath)}`
  );
}

async function updateTracker() {
  await updateParks();
  await buildTrackerData();
}

const command = process.argv[2];
switch (command) {
  case "update-parks":
    await updateParks();
    break;
  case "build-tracker-data":
    await buildTrackerData();
    break;
  case "update-tracker":
    await updateTracker();
    break;
  default:
    console.error(
      "Usage: rove-to-fl-tracker.mjs <update-parks|build-tracker-data|update-tracker>"
    );
    process.exitCode = 1;
}
