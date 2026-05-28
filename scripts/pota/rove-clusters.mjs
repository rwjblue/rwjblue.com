#!/usr/bin/env -S node --experimental-strip-types

/**
 * Find clusters of POTA parks suitable for a single rove outing.
 *
 * Uses OSRM for real driving distances, falls back to haversine if unavailable.
 * Parks are grouped by adjacency: two parks are in the same cluster if there is
 * a chain of hops where each consecutive pair is within --threshold minutes.
 * Within each cluster, a nearest-neighbor round-trip from --home is computed.
 *
 * Usage:
 *   node --experimental-strip-types scripts/pota/rove-clusters.mjs [options]
 *   mise run pota:ri:rove-clusters [-- --threshold 60 --all]
 *
 * Options:
 *   --grid <grid>        Home Maidenhead grid square (default: FN41fr)
 *   --threshold <min>    Max inter-park drive time for adjacency (default: 45)
 *   --all                Include already-activated parks (default: remaining only)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  gridToLatLon,
  haversineMatrix,
  osrmTableAll,
} from "./lib/routing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const trackerDataPath = path.join(root, "src/data/pota/ri-tracker.json");

const DEFAULT_THRESHOLD_MIN = 45;
const DEFAULT_HOME_GRID = "FN41fr";

// Build connected components among parks using parkMatrix and a threshold.
// parkMatrix: NxN array of drive times in minutes (or null)
// Returns array of components, each an array of park indices.
function connectedComponents(parkMatrix, thresholdMin) {
  const n = parkMatrix.length;
  const visited = new Array(n).fill(false);
  const components = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const component = [i];
    const queue = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const curr = queue.shift();
      for (let j = 0; j < n; j++) {
        if (!visited[j]) {
          const d = parkMatrix[curr][j];
          if (d !== null && d <= thresholdMin) {
            visited[j] = true;
            queue.push(j);
            component.push(j);
          }
        }
      }
    }

    components.push(component);
  }

  return components;
}

// Nearest-neighbor round-trip from home through all parks in clusterIndices.
// homeRow: minutes from home to each park (indexed by park index)
// parkToHome: minutes from each park back to home
// parkMatrix: NxN inter-park drive times
// clusterIndices: which park indices are in this cluster
// Returns array of {toIdx, minutes} segments (toIdx=-1 means "home").
function nearestNeighborRoundTrip(homeRow, parkToHome, parkMatrix, clusterIndices) {
  const remaining = new Set(clusterIndices);
  const segments = [];
  let current = -1; // -1 = home

  while (remaining.size > 0) {
    let best = null;
    let bestMin = Infinity;

    for (const idx of remaining) {
      const d = current === -1 ? homeRow[idx] : parkMatrix[current][idx];
      const dVal = d ?? Infinity;
      if (dVal < bestMin) {
        bestMin = dVal;
        best = idx;
      }
    }

    segments.push({ toIdx: best, minutes: Math.round(bestMin) });
    remaining.delete(best);
    current = best;
  }

  // Return home
  segments.push({ toIdx: -1, minutes: Math.round(parkToHome[current] ?? 0) });

  return segments;
}

function fmtMin(min) {
  if (min == null) return "?";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const col = (s, w) => String(s).padEnd(w);
const rcol = (s, w) => String(s).padStart(w);

async function main() {
  const args = process.argv.slice(2);

  const gridFlag = args.indexOf("--grid");
  const grid = gridFlag >= 0 ? args[gridFlag + 1] : DEFAULT_HOME_GRID;

  const threshFlag = args.indexOf("--threshold");
  const thresholdMin =
    threshFlag >= 0 ? parseInt(args[threshFlag + 1], 10) : DEFAULT_THRESHOLD_MIN;

  const showAll = args.includes("--all");

  if (grid.length < 6) {
    console.error("--grid must be at least 6 characters (e.g. FN41fr)");
    process.exitCode = 1;
    return;
  }

  const [homeLat, homeLon] = gridToLatLon(grid);
  const tracker = JSON.parse(await readFile(trackerDataPath, "utf8"));
  const parks = tracker.references.filter(
    (r) => showAll || r.status === "remaining"
  );

  if (parks.length === 0) {
    console.log("No parks to cluster.");
    return;
  }

  console.log(
    `Rove clusters from ${grid} (${homeLat.toFixed(3)}, ${homeLon.toFixed(3)})`
  );
  console.log(
    `${parks.length} ${showAll ? "total" : "remaining"} parks  •  ${thresholdMin}-min adjacency threshold\n`
  );

  // allCoords: index 0 = home, indices 1..N = parks
  const allCoords = [
    [homeLon, homeLat],
    ...parks.map((p) => [p.longitude, p.latitude]),
  ];

  let fullMatrix;
  let method = "OSRM";

  try {
    process.stdout.write("Querying OSRM routing matrix... ");
    fullMatrix = await osrmTableAll(allCoords);
    console.log("ok\n");
  } catch (err) {
    console.log(`failed (${err.message})\nFalling back to haversine.\n`);
    method = "haversine (straight-line × 1.4, 80 km/h avg)";
    fullMatrix = haversineMatrix(allCoords);
  }

  // Slice into usable sub-arrays (park indices are offset by 1 in fullMatrix)
  const parkMatrix = parks.map((_, i) =>
    parks.map((_, j) => fullMatrix[i + 1][j + 1])
  );
  const homeRow = parks.map((_, i) => fullMatrix[0][i + 1]);
  const parkToHome = parks.map((_, i) => fullMatrix[i + 1][0]);

  const components = connectedComponents(parkMatrix, thresholdMin);
  const clusters = components
    .filter((c) => c.length > 1)
    .sort((a, b) => b.length - a.length);
  const isolated = components.filter((c) => c.length === 1).map((c) => c[0]);

  if (clusters.length === 0) {
    console.log(`No multi-park clusters found within ${thresholdMin} minutes.\n`);
  } else {
    for (let ci = 0; ci < clusters.length; ci++) {
      const clusterIndices = clusters[ci];
      const segments = nearestNeighborRoundTrip(
        homeRow,
        parkToHome,
        parkMatrix,
        clusterIndices
      );
      const totalDriveMin = segments.reduce((sum, s) => sum + s.minutes, 0);

      console.log(
        `Cluster ${ci + 1} — ${clusterIndices.length} parks  •  ~${fmtMin(totalDriveMin)} round-trip driving`
      );
      console.log(`  ${col(grid + " (home)", 44)}`);
      for (const seg of segments) {
        if (seg.toIdx === -1) {
          console.log(
            `  ${col("← " + grid + " (home)", 44)} ${rcol(seg.minutes + "m", 5)}`
          );
        } else {
          const park = parks[seg.toIdx];
          console.log(
            `  ${col(park.reference + "  " + park.name, 44)} ${rcol(seg.minutes + "m", 5)}`
          );
        }
      }
      console.log(`  ${"─".repeat(50)}`);
      console.log(`  Total drive: ${fmtMin(totalDriveMin)}\n`);
    }
  }

  if (isolated.length > 0) {
    console.log(`Isolated parks (no neighbor within ${thresholdMin}m from home):`);
    const isolatedSorted = isolated
      .map((i) => ({ park: parks[i], homeMin: Math.round(homeRow[i] ?? 0) }))
      .sort((a, b) => a.homeMin - b.homeMin);
    for (const { park, homeMin } of isolatedSorted) {
      console.log(
        `  ${col(park.reference, 12)} ${rcol(homeMin + "m", 6)}  ${park.name}`
      );
    }
    console.log();
  }

  console.log(`Source: ${method}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
