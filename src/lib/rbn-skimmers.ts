export interface LatLon {
  lat: number;
  lon: number;
}

export interface RbnNodeRecord {
  call?: string;
  grid?: string;
  sk_ver?: string;
  sk_opt?: string;
  lst_age?: string;
  band?: Record<string, unknown> | unknown[];
}

export interface RankedSkimmer {
  call: string;
  grid: string;
  lat: number;
  lon: number;
  distanceMiles: number;
  distanceKm: number;
  spotPolicy: string;
  bands: string[];
  lastSeen: string;
  skimmerVersion: string;
}

export interface RbnMainUrlOptions {
  spotterCalls: string[];
  targetCalls?: string[];
  maxAge?: number;
  maxAgeUnits?: "minutes" | "hours" | "days";
  rows?: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.62137119;
const BAND_ORDER = [
  "630m",
  "160m",
  "80m",
  "60m",
  "40m",
  "30m",
  "20m",
  "17m",
  "15m",
  "12m",
  "10m",
  "6m",
  "4m",
  "2m",
];

export function gridToLatLon(grid: string): LatLon | null {
  const value = grid.trim().toUpperCase();
  if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(value)) {
    return null;
  }

  let lon = -180 + (value.charCodeAt(0) - 65) * 20;
  let lat = -90 + (value.charCodeAt(1) - 65) * 10;
  let lonSize = 20;
  let latSize = 10;

  lon += Number.parseInt(value[2], 10) * 2;
  lat += Number.parseInt(value[3], 10);
  lonSize = 2;
  latSize = 1;

  if (value.length >= 6) {
    lon += (value.charCodeAt(4) - 65) * (5 / 60);
    lat += (value.charCodeAt(5) - 65) * (2.5 / 60);
    lonSize = 5 / 60;
    latSize = 2.5 / 60;
  }

  if (value.length >= 8) {
    lon += Number.parseInt(value[6], 10) * (5 / 600);
    lat += Number.parseInt(value[7], 10) * (2.5 / 600);
    lonSize = 5 / 600;
    latSize = 2.5 / 600;
  }

  return {
    lat: lat + latSize / 2,
    lon: lon + lonSize / 2,
  };
}

export function normalizeRbnNode(
  node: RbnNodeRecord,
  origin: LatLon,
): RankedSkimmer | null {
  const call = normalizeCall(node.call);
  const grid = node.grid?.trim().toUpperCase();
  if (!call || !grid) return null;

  const point = gridToLatLon(grid);
  if (!point) return null;

  const distanceKm = distanceKilometers(origin, point);

  return {
    call,
    grid,
    lat: point.lat,
    lon: point.lon,
    distanceMiles: distanceKm * KM_TO_MILES,
    distanceKm,
    spotPolicy: spotPolicy(node.sk_opt),
    bands: bandList(node.band),
    lastSeen: cleanHtmlText(node.lst_age) || "unknown",
    skimmerVersion: cleanHtmlText(node.sk_ver),
  };
}

export function rankSkimmers(
  nodes: RbnNodeRecord[],
  origin: LatLon,
): RankedSkimmer[] {
  return nodes
    .map((node) => normalizeRbnNode(node, origin))
    .filter((node): node is RankedSkimmer => node !== null)
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.call.localeCompare(b.call));
}

export function defaultSelectedSkimmers(
  skimmers: RankedSkimmer[],
  limit = 2,
): string[] {
  return skimmers.slice(0, Math.max(0, limit)).map((skimmer) => skimmer.call);
}

export function parseTargetCalls(value: string): string[] {
  return uniqueValues(
    value
      .split(/[\s,]+/)
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function buildRbnMainUrl(options: RbnMainUrlOptions): string {
  const url = new URL("https://www.reversebeacon.net/main.php");
  const spotterCalls = uniqueValues(options.spotterCalls.map(normalizeCall).filter(Boolean));
  const targetCalls = uniqueValues(options.targetCalls ?? []);
  const maxAge = options.maxAge ?? 6;
  const maxAgeUnits = options.maxAgeUnits ?? "hours";
  const rows = options.rows ?? 50;

  if (spotterCalls.length > 0) {
    url.searchParams.set("spotter_call", spotterCalls.join(","));
  }

  if (targetCalls.length > 0) {
    url.searchParams.set("spotted_call", targetCalls.join(","));
  }

  url.searchParams.set("max_age", `${maxAge},${maxAgeUnits}`);
  url.searchParams.set("rows", String(rows));

  return url.toString();
}

function distanceKilometers(origin: LatLon, destination: LatLon): number {
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const dLat = toRadians(destination.lat - origin.lat);
  const dLon = toRadians(destination.lon - origin.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function bandList(bands: RbnNodeRecord["band"]): string[] {
  if (!bands) return [];

  const rows = Array.isArray(bands) ? bands : Object.values(bands);
  const found = new Set<string>();

  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[1] !== "string") continue;
    found.add(row[1]);
  }

  return [...found].sort((a, b) => bandRank(a) - bandRank(b) || a.localeCompare(b));
}

function bandRank(band: string): number {
  const index = BAND_ORDER.indexOf(band);
  return index === -1 ? BAND_ORDER.length : index;
}

function spotPolicy(value: string | undefined): string {
  const clean = cleanHtmlText(value);
  if (/ALL spots/i.test(clean)) return "ALL spots";
  if (/CQ only/i.test(clean)) return "CQ only";
  return clean || "unknown";
}

function cleanHtmlText(value: string | undefined): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCall(value: string | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
