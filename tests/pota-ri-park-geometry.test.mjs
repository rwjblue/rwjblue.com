import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { displayReferences } from "@ripota/parks/display";
import { readRiParkDisplayGeometry } from "../src/lib/pota/ri-park-geometry.ts";

const readArtifact = async (specifier) =>
  JSON.parse(await readFile(new URL(import.meta.resolve(specifier)), "utf8"));

test("every RI park resolves its published web geometry at build time", async () => {
  for (const display of displayReferences) {
    const geometry = await readRiParkDisplayGeometry(display.reference);
    const web = await readArtifact(
      `@ripota/parks/boundaries-web/${display.reference.toLowerCase()}.geojson`,
    );
    assert.deepEqual(geometry, web, display.reference);
    assert.equal(geometry.type, "FeatureCollection");
    assert.equal(geometry.bbox.length, 4);
  }
  assert.equal(await readRiParkDisplayGeometry("US-99999"), null);
});

test("web maps reduce Brenton Point's payload and preserve the trail activation zone", async () => {
  const detailed = await readArtifact("@ripota/parks/boundaries/us-2870.geojson");
  const web = await readRiParkDisplayGeometry("US-2870");
  assert.ok(
    gzipSync(JSON.stringify(web)).length < gzipSync(JSON.stringify(detailed)).length * 0.7,
  );

  const trailDetailed = await readArtifact("@ripota/parks/boundaries/us-4582.geojson");
  const trailWeb = await readRiParkDisplayGeometry("US-4582");
  assert.deepEqual(
    trailWeb.features.map((feature) => feature.geometry),
    trailDetailed.features.map((feature) => feature.geometry),
  );
});
