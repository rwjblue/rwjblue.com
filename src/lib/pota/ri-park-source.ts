import { parks } from "@ripota/parks";
import { diffReferences } from "@ripota/parks/compare";
import { getDisplayReference } from "@ripota/parks/display";
import type { PotaReference } from "@ripota/parks/types";

import type { PotaPark } from "./parks.ts";

// Generated activity data owns identity and statistics; visitor guidance stays
// in the package and is read directly by canonical park pages at build time.
const references: PotaReference[] = parks.map((park) => ({
  reference: park.reference,
  name: park.name,
  latitude: park.latitude,
  longitude: park.longitude,
  grid: park.grid,
  counties: [...park.counties],
  locationDesc: park.locationDesc,
  potaUrl: park.potaUrl,
}));

export interface RiPotaPublicStats {
  generatedAt: string;
  parks: Array<{
    reference: string;
    attempts?: number;
    activations?: number;
    qsos?: number;
  }>;
}

interface PotaApiPark {
  reference: string;
  name: string;
  latitude: number;
  longitude: number;
  grid: string;
  locationDesc: string;
  attempts?: number | string | null;
  activations?: number | string | null;
  qsos?: number | string | null;
}

export const riPotaReferenceIds = references.map(
  (reference) => reference.reference,
);

export function readRiPotaParks(
  publicStats?: RiPotaPublicStats | null,
): PotaPark[] {
  const statsByReference = new Map(
    (publicStats?.parks ?? []).map((park) => [park.reference, park]),
  );

  return references.map((reference) => {
    const stats = statsByReference.get(reference.reference);
    const point = getDisplayReference(reference.reference)?.displayPoint;
    const mapPoint = point?.source === "reviewed"
      ? {
          latitude: point.latitude,
          longitude: point.longitude,
          notes: point.notes ?? "",
        }
      : undefined;

    return {
      ...reference,
      counties: [...reference.counties],
      ...(mapPoint ? { mapPoint: { ...mapPoint } } : {}),
      attempts: stats?.attempts,
      activations: stats?.activations,
      qsos: stats?.qsos,
    };
  });
}

export function buildRiPotaPublicStats(
  apiParks: PotaApiPark[],
  generatedAt: string,
): RiPotaPublicStats {
  assertPackageMatchesApi(apiParks);
  const apiByReference = new Map(
    apiParks.map((park) => [park.reference.toUpperCase(), park]),
  );

  return {
    generatedAt,
    parks: references.map((reference) => {
      const apiPark = apiByReference.get(reference.reference);

      return {
        reference: reference.reference,
        attempts: numberOrUndefined(apiPark?.attempts),
        activations: numberOrUndefined(apiPark?.activations),
        qsos: numberOrUndefined(apiPark?.qsos),
      };
    }),
  };
}

export function assertPackageMatchesApi(apiParks: PotaApiPark[]): void {
  const diff = diffReferences(references, apiParks);
  const changed = diff.changed.flatMap(({ reference, fields }) =>
    Object.keys(fields).map((field) => `${reference}.${field}`),
  );
  const details = [
    diff.missing.length > 0 ? `missing ${diff.missing.join(", ")}` : null,
    diff.added.length > 0 ? `new ${diff.added.join(", ")}` : null,
    changed.length > 0 ? `changed ${changed.join(", ")}` : null,
    diff.duplicates.expected.length > 0
      ? `duplicate package references ${diff.duplicates.expected.join(", ")}`
      : null,
    diff.duplicates.actual.length > 0
      ? `duplicate API references ${diff.duplicates.actual.join(", ")}`
      : null,
    diff.invalid.expected.length > 0
      ? `invalid package references at indices ${diff.invalid.expected.join(", ")}`
      : null,
    diff.invalid.actual.length > 0
      ? `invalid API references at indices ${diff.invalid.actual.join(", ")}`
      : null,
  ].filter(Boolean);

  if (details.length > 0) {
    throw new Error(
      `@ripota/parks does not match the current POTA API (${details.join("; ")}). ` +
        "Release the updated park data and bump the pinned dependency before refreshing the site.",
    );
  }
}

function numberOrUndefined(
  value: number | string | null | undefined,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return Number(value);
}
