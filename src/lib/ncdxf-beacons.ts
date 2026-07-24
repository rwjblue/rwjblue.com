import { distanceMiles, gridToLatLon, type LatLon } from "./geo.ts";

// Schedule and locations:
// https://www.ncdxf.org/beacon/index.html
// https://www.ncdxf.org/beacon/beaconlocations.html
// Status snapshot:
// https://www.ncdxf.org/beacon/IBPStatus.csv
export const NCDXF_STATUS_CHECKED_AT = "2026-07-07T22:24:06Z";

export const NCDXF_BANDS = [
  { label: "20 m", frequencyMHz: 14.1 },
  { label: "17 m", frequencyMHz: 18.11 },
  { label: "15 m", frequencyMHz: 21.15 },
  { label: "12 m", frequencyMHz: 24.93 },
  { label: "10 m", frequencyMHz: 28.2 },
] as const;

export const NCDXF_BEACONS = [
  {
    call: "4U1UN",
    entity: "United Nations",
    location: "New York City",
    grid: "FN30AS",
    status: "ok",
  },
  {
    call: "VE8AT",
    entity: "Canada",
    location: "Inuvik, Northwest Territories",
    grid: "CP38GH",
    status: "ok",
  },
  {
    call: "W6WX",
    entity: "United States",
    location: "Mt. Umunhum, California",
    grid: "CM97BD",
    status: "ok",
  },
  {
    call: "KH6RS",
    entity: "Hawaii",
    location: "Maui",
    grid: "BL10TS",
    status: "ok",
  },
  {
    call: "ZL6B",
    entity: "New Zealand",
    location: "Masterton",
    grid: "RE78TW",
    status: "ok",
  },
  {
    call: "VK6RBP",
    entity: "Australia",
    location: "Roleystone",
    grid: "OF87AV",
    status: "ok",
  },
  {
    call: "JA2IGY",
    entity: "Japan",
    location: "Mt. Asama",
    grid: "PM84JK",
    status: "ok",
  },
  {
    call: "RR9O",
    entity: "Russia",
    location: "Novosibirsk",
    grid: "NO14KX",
    status: "ok",
  },
  {
    call: "VR2B",
    entity: "Hong Kong",
    location: "Hong Kong",
    grid: "OL72BG",
    status: "ok",
  },
  {
    call: "4S7B",
    entity: "Sri Lanka",
    location: "Colombo",
    grid: "MJ96WV",
    status: "ok",
  },
  {
    call: "ZS6DN",
    entity: "South Africa",
    location: "Pretoria",
    grid: "KG33XI",
    status: "ok",
  },
  {
    call: "5Z4B",
    entity: "Kenya",
    location: "Kikuyu",
    grid: "KI88HR",
    status: "ok",
  },
  {
    call: "4X6TU",
    entity: "Israel",
    location: "Tel Aviv",
    grid: "KM72JB",
    status: "ok",
  },
  {
    call: "OH2B",
    entity: "Finland",
    location: "Lohja",
    grid: "KP20EH",
    status: "ok",
  },
  {
    call: "CS3B",
    entity: "Madeira",
    location: "São Jorge",
    grid: "IM12JT",
    status: "ok",
  },
  {
    call: "LU4AA",
    entity: "Argentina",
    location: "Buenos Aires",
    grid: "GF05TJ",
    status: "ok",
  },
  {
    call: "OA4B",
    entity: "Peru",
    location: "Lima",
    grid: "FH17MW",
    status: "ok",
  },
  {
    call: "YV5B",
    entity: "Venezuela",
    location: "Caracas",
    grid: "FK60ND",
    status: "off",
  },
] as const;

export type NcdxfBand = (typeof NCDXF_BANDS)[number];
export type NcdxfBeacon = (typeof NCDXF_BEACONS)[number];
export type BeaconPower = "none" | "100" | "10" | "1" | "0.1";

export interface TransmissionState {
  bandIndex: number;
  band: NcdxfBand;
  beaconIndex: number;
  beacon: NcdxfBeacon;
  secondsIntoSlot: number;
  secondsRemaining: number;
}

export interface BeaconWindowState {
  beaconIndex: number;
  beacon: NcdxfBeacon;
  activeBandIndex: number | null;
  activeBand: NcdxfBand | null;
  secondsRemaining: number;
  nextBandIndex: number;
  nextBand: NcdxfBand;
  secondsUntilNext: number;
}

export interface BeaconObservation {
  bandIndex: number;
  beaconIndex: number;
  power: BeaconPower;
  observedAt: string;
}

export interface BandObservationSummary {
  bandIndex: number;
  band: NcdxfBand;
  checked: number;
  heard: number;
  bestPower: BeaconPower | null;
  bestRank: number;
}

export function transmissionAt(date: Date, bandIndex: number): TransmissionState {
  const normalizedBandIndex = normalizeIndex(bandIndex, NCDXF_BANDS.length);
  const cycleSecond = secondWithinCycle(date);
  const slotIndex = Math.floor(cycleSecond / 10);
  const beaconIndex = normalizeIndex(
    slotIndex - normalizedBandIndex,
    NCDXF_BEACONS.length,
  );
  const secondsIntoSlot = cycleSecond % 10;

  return {
    bandIndex: normalizedBandIndex,
    band: NCDXF_BANDS[normalizedBandIndex],
    beaconIndex,
    beacon: NCDXF_BEACONS[beaconIndex],
    secondsIntoSlot,
    secondsRemaining: 10 - secondsIntoSlot,
  };
}

export function beaconWindowAt(date: Date, beaconIndex: number): BeaconWindowState {
  const normalizedBeaconIndex = normalizeIndex(beaconIndex, NCDXF_BEACONS.length);
  const cycleSecond = secondWithinCycle(date);
  const slotIndex = Math.floor(cycleSecond / 10);
  const activeCandidate = normalizeIndex(
    slotIndex - normalizedBeaconIndex,
    NCDXF_BEACONS.length,
  );
  const activeBandIndex = activeCandidate < NCDXF_BANDS.length ? activeCandidate : null;
  const secondsIntoSlot = cycleSecond % 10;

  const upcoming = NCDXF_BANDS.map((band, bandIndex) => {
    const startSecond = normalizeIndex(
      normalizedBeaconIndex + bandIndex,
      NCDXF_BEACONS.length,
    ) * 10;
    return {
      band,
      bandIndex,
      secondsUntil: normalizeIndex(startSecond - cycleSecond, 180),
    };
  })
    .filter((entry) => entry.secondsUntil > 0)
    .sort((a, b) => a.secondsUntil - b.secondsUntil)[0] ??
    {
      band: NCDXF_BANDS[0],
      bandIndex: 0,
      secondsUntil: 180,
    };

  return {
    beaconIndex: normalizedBeaconIndex,
    beacon: NCDXF_BEACONS[normalizedBeaconIndex],
    activeBandIndex,
    activeBand: activeBandIndex === null ? null : NCDXF_BANDS[activeBandIndex],
    secondsRemaining: activeBandIndex === null ? 0 : 10 - secondsIntoSlot,
    nextBandIndex: upcoming.bandIndex,
    nextBand: upcoming.band,
    secondsUntilNext: upcoming.secondsUntil,
  };
}

export function summarizeBandObservations(
  observations: BeaconObservation[],
): BandObservationSummary[] {
  return NCDXF_BANDS.map((band, bandIndex) => {
    const matching = observations.filter((observation) => observation.bandIndex === bandIndex);
    const heard = matching.filter((observation) => observation.power !== "none");
    const bestPower =
      heard
        .map((observation) => observation.power)
        .sort((a, b) => powerRank(b) - powerRank(a))[0] ?? null;

    return {
      bandIndex,
      band,
      checked: matching.length,
      heard: heard.length,
      bestPower,
      bestRank: bestPower === null ? -1 : powerRank(bestPower),
    };
  }).sort(
    (a, b) =>
      b.bestRank - a.bestRank ||
      b.heard - a.heard ||
      b.checked - a.checked ||
      a.bandIndex - b.bandIndex,
  );
}

export function powerRank(power: BeaconPower): number {
  switch (power) {
    case "0.1":
      return 4;
    case "1":
      return 3;
    case "10":
      return 2;
    case "100":
      return 1;
    case "none":
      return 0;
  }
}

export function powerLabel(power: BeaconPower | null): string {
  if (power === null) return "Not checked";
  if (power === "none") return "Not heard";
  if (power === "0.1") return "100 mW";
  return `${power} W`;
}

export function powerMarginDb(power: BeaconPower): number | null {
  switch (power) {
    case "100":
      return 0;
    case "10":
      return 10;
    case "1":
      return 20;
    case "0.1":
      return 30;
    case "none":
      return null;
  }
}

export function beaconBearingDegrees(origin: LatLon, beacon: NcdxfBeacon): number | null {
  const destination = gridToLatLon(beacon.grid);
  if (!destination) return null;

  const fromLat = degreesToRadians(origin.lat);
  const toLat = degreesToRadians(destination.lat);
  const deltaLon = degreesToRadians(destination.lon - origin.lon);
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return normalizeIndex(Math.round(bearing), 360);
}

export function beaconDistanceMiles(origin: LatLon, beacon: NcdxfBeacon): number | null {
  const destination = gridToLatLon(beacon.grid);
  if (!destination) return null;
  return distanceMiles(origin, destination);
}

function secondWithinCycle(date: Date): number {
  return normalizeIndex(Math.floor(date.getTime() / 1000), 180);
}

function normalizeIndex(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
