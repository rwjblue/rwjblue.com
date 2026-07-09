import {
  distanceKilometers,
  distanceMiles,
  gridToLatLon,
  type LatLon,
} from "./geo.ts";

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

const GRID_QUERY_PARAM = "grid";
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
    distanceMiles: distanceMiles(origin, point),
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

export function gridFromUrlSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeGrid(params.get(GRID_QUERY_PARAM));
}

export function buildSearchWithGrid(search: string, grid: string | null): string {
  const params = new URLSearchParams(search);
  const normalizedGrid = normalizeGrid(grid);

  if (normalizedGrid) {
    params.set(GRID_QUERY_PARAM, normalizedGrid);
  } else {
    params.delete(GRID_QUERY_PARAM);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
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

function normalizeGrid(value: string | null | undefined): string | null {
  const grid = String(value ?? "").trim().toUpperCase();
  return grid && gridToLatLon(grid) ? grid : null;
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
