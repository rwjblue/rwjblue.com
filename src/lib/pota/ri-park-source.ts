import { references } from "@ripota/parks";
import catalog from "@ripota/parks/catalog.json" with { type: "json" };

import type { PotaMapPoint, PotaPark } from "./parks.ts";

export interface RiPotaPublicStats {
  generatedAt: string;
  parks: Array<{
    reference: string;
    attempts?: number;
    activations?: number;
    qsos?: number;
  }>;
}

interface CatalogReference {
  reference: string;
  mapPoint?: PotaMapPoint;
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

const metadataFields = [
  "name",
  "latitude",
  "longitude",
  "grid",
  "locationDesc",
] as const;

const catalogReferences = (catalog as { references: CatalogReference[] })
  .references;
const catalogByReference = new Map(
  catalogReferences.map((reference) => [reference.reference, reference]),
);

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
    const mapPoint = catalogByReference.get(reference.reference)?.mapPoint;

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
  const packageByReference = new Map(
    references.map((park) => [park.reference, park]),
  );
  const apiByReference = new Map(
    apiParks.map((park) => [park.reference.toUpperCase(), park]),
  );
  const missing = references
    .filter((park) => !apiByReference.has(park.reference))
    .map((park) => park.reference);
  const extra = apiParks
    .map((park) => park.reference.toUpperCase())
    .filter((reference) => !packageByReference.has(reference));
  const changed: string[] = [];

  for (const apiPark of apiParks) {
    const reference = apiPark.reference.toUpperCase();
    const packagePark = packageByReference.get(reference);

    if (!packagePark) {
      continue;
    }

    for (const field of metadataFields) {
      if (apiPark[field] !== packagePark[field]) {
        changed.push(`${reference}.${field}`);
      }
    }
  }

  if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(", ")}` : null,
      extra.length > 0 ? `new ${extra.join(", ")}` : null,
      changed.length > 0 ? `changed ${changed.join(", ")}` : null,
    ].filter(Boolean);

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
