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
import {
  gridToLatLon,
  haversineDriveMinutes,
  osrmTableFrom,
} from "./lib/routing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const trackerDataPath = path.join(root, "src/data/pota/ri-tracker.json");

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
    const rawDurations = await osrmTableFrom(coords, 0);
    durations = rawDurations.slice(1).map((m) => (m != null ? Math.round(m) : null));
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
