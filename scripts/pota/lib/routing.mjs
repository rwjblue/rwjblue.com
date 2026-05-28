// Shared routing utilities for POTA planning scripts.

export const OSRM_BASE = "http://router.project-osrm.org";

// Maidenhead grid square center → [lat, lon]
export function gridToLatLon(grid) {
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
export function haversineKm(lat1, lon1, lat2, lon2) {
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
export function haversineDriveMinutes(lat1, lon1, lat2, lon2) {
  const km = haversineKm(lat1, lon1, lat2, lon2) * 1.4;
  return Math.round((km / 80) * 60);
}

// Build an NxN matrix of haversine drive-time estimates in minutes.
// coords: array of [lon, lat]
export function haversineMatrix(coords) {
  const n = coords.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[j];
      return haversineDriveMinutes(lat1, lon1, lat2, lon2);
    })
  );
}

// Fetch an NxN matrix of drive times in minutes from OSRM (null = unreachable).
// coords: array of [lon, lat]
export async function osrmTableAll(coords) {
  const coordStr = coords.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const url = `${OSRM_BASE}/table/v1/driving/${coordStr}?annotations=duration`;

  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA rove planner",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok") throw new Error(`OSRM code: ${data.code}`);

  // data.durations[i][j] = seconds from i to j
  return data.durations.map((row) =>
    row.map((s) => (s != null ? s / 60 : null))
  );
}

// Fetch drive times in minutes from one source to all other coords via OSRM.
// coords: array of [lon, lat], sourceIdx: index of the source point
// Returns a 1D array of minutes (one per coord, null for unreachable, 0 for self).
export async function osrmTableFrom(coords, sourceIdx = 0) {
  const coordStr = coords.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const dests = coords
    .map((_, i) => i)
    .filter((i) => i !== sourceIdx)
    .join(",");
  const url = `${OSRM_BASE}/table/v1/driving/${coordStr}?sources=${sourceIdx}&destinations=${dests}&annotations=duration`;

  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA travel time estimator",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok") throw new Error(`OSRM code: ${data.code}`);

  // data.durations[0] = array of seconds to each destination (in dest order)
  const seconds = data.durations[0];
  const result = new Array(coords.length).fill(0);
  const destIndices = coords.map((_, i) => i).filter((i) => i !== sourceIdx);
  for (let i = 0; i < destIndices.length; i++) {
    result[destIndices[i]] = seconds[i] != null ? seconds[i] / 60 : null;
  }
  return result;
}
