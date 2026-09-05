import { readFile } from "node:fs/promises";
import { getDisplayReference } from "@ripota/parks/display";
import type { GeoJsonFeatureCollection } from "@ripota/parks/types";

// Build-time only: embed one park's web geometry without loading the catalog.
export async function readRiParkDisplayGeometry(
  reference: string,
): Promise<GeoJsonFeatureCollection | null> {
  const display = getDisplayReference(reference);

  if (!display?.artifact) {
    return null;
  }

  const artifact = display.artifact.replace("/boundaries/", "/boundaries-web/");
  return JSON.parse(
    await readFile(new URL(import.meta.resolve(artifact)), "utf8"),
  );
}
