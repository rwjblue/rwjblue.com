#!/usr/bin/env -S node --experimental-strip-types

/**
 * Estimate driving times from a home grid square to remaining RI POTA parks.
 *
 * Uses the OSRM public routing API (router.project-osrm.org).
 * Falls back to haversine straight-line distance with a 1.4× road factor if OSRM is unavailable.
 *
 * Usage:
 *   node --experimental-strip-types scripts/pota/travel-times.mjs [--grid FN41fr]
 *   mise run pota:ri:travel-times [-- --grid FN41fr]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const trackerDataPath = path.join(root, "src/data/pota/ri-tracker.json");

const OSRM_BASE = "http://router.project-osrm.org";

// Maidenhead grid square center → [lat, lon]
function gridToLatLon(grid) {
  const g = grid.toUpperCase();
  const lon =
    (g.charCodeAt(0) - 65) * 20 +
    (g.charCodeAt(2) - 48) * 2 +
    (g.toLowerCase().charCodeAt(4) - 97 + 0.5) * (2 / 24) -
    180;
  const lat =
    (g.charCodeAt(1) - 65) * 10 +
    (g.charCodeAt(3) - 48) * 1 +
    (g.toLowerCase().charCodeAt(5) - 97 + 0.5) * (1 / 24) -
    90;
  return [lat, lon];
}

// Haversine great-circle distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough drive-time estimate: straight-line × 1.4 road factor at 80 km/h average
function haversineDriveMinutes(lat1, lon1, lat2, lon2) {
  const km = haversineKm(lat1, lon1, lat2, lon2) * 1.4;
  return Math.round((km / 80) * 60);
}

async function osrmTableDurations(coords) {
  const coordStr = coords.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const dests = coords
    .slice(1)
    .map((_, i) => i + 1)
    .join(",");
  const url = `${OSRM_BASE}/table/v1/driving/${coordStr}?sources=0&destinations=${dests}&annotations=duration`;

  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA RI travel time estimator",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`OSRM responded ${response.status}`);

  const data = await response.json();
  if (data.code !== "Ok") throw new Error(`OSRM code: ${data.code}`);

  // durations[0][i] = seconds from source 0 to destination i
  return data.durations[0];
}

async function main() {
  const args = process.argv.slice(2);
  const gridFlag = args.indexOf("--grid");
  const grid = gridFlag >= 0 ? args[gridFlag + 1] : "FN41fr";

  if (grid.length < 6) {
    console.error("Grid must be at least 6 characters (e.g. FN41fr)");
    process.exitCode = 1;
    return;
  }

  const [homeLat, homeLon] = gridToLatLon(grid);
  const tracker = JSON.parse(await readFile(trackerDataPath, "utf8"));
  const remaining = tracker.references.filter((r) => r.status === "remaining");

  console.log(
    `Drive-time estimates from ${grid} (${homeLat.toFixed(3)}, ${homeLon.toFixed(3)}) to ${remaining.length} remaining parks\n`,
  );

  const coords = [
    [homeLon, homeLat],
    ...remaining.map((r) => [r.longitude, r.latitude]),
  ];

  let durations;
  let method = "OSRM";

  try {
    process.stdout.write("Querying OSRM routing... ");
    const rawDurations = await osrmTableDurations(coords);
    durations = rawDurations.map((s) => (s != null ? Math.round(s / 60) : null));
    console.log("ok\n");
  } catch (err) {
    console.log(`failed (${err.message})\nFalling back to haversine estimate.\n`);
    method = "haversine (straight-line × 1.4, 80 km/h avg)";
    durations = remaining.map((r) =>
      haversineDriveMinutes(homeLat, homeLon, r.latitude, r.longitude),
    );
  }

  const results = remaining
    .map((park, i) => ({ park, minutes: durations[i] }))
    .sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));

  const col = (s, w) => String(s).padEnd(w);
  const rcol = (s, w) => String(s).padStart(w);

  console.log(`${col("Reference", 12)} ${rcol("Drive", 6)}  Name`);
  console.log("-".repeat(72));
  for (const { park, minutes } of results) {
    const time = minutes != null ? `${minutes}m` : "?";
    console.log(`${col(park.reference, 12)} ${rcol(time, 6)}  ${park.name}`);
  }

  console.log(`\nSource: ${method}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
