import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parks } from "@ripota/parks";
import sharp from "sharp";
import {
  getRiParkPhoto,
  renderParkPhoto,
  riParkPhotoAssets,
} from "../src/lib/pota/ri-park-images.ts";

test("selected park photos resolve to local responsive assets while uncovered parks stay empty", () => {
  for (const park of parks) {
    const photo = getRiParkPhoto(park.reference);
    if (!park.heroImageId) {
      assert.equal(photo, null, park.reference);
      continue;
    }
    assert.equal(photo.image.id, park.heroImageId);
    assert.ok(photo.image.alt);
    assert.ok(photo.image.credit);
    assert.ok(photo.image.rights.url.startsWith("https://"));
    assert.ok(photo.image.source.pageUrl.startsWith("https://"));
    assert.ok(Array.isArray(photo.image.transforms));
    assert.ok(photo.src.startsWith("/assets/parks/"));
    assert.ok(!photo.srcset.includes("https://"));
    assert.equal(getRiParkPhoto(park.reference.toLowerCase())?.src, photo.src);
    for (const entry of photo.srcset.split(", ")) {
      const [src, width] = entry.split(" ");
      const asset = riParkPhotoAssets.find((candidate) => candidate.src === src);
      assert.ok(asset, `${park.reference}: ${src}`);
      assert.equal(width, `${asset.width}w`);
      assert.ok(asset.width <= photo.image.width);
    }
  }
  assert.equal(getRiParkPhoto("US-1234"), null);
  assert.equal(getRiParkPhoto("invalid"), null);
});

test("every selected master matches its published checksum and image dimensions", async () => {
  const images = new Map(riParkPhotoAssets.map(({ image }) => [image.id, image]));
  assert.equal(new Set(riParkPhotoAssets.map(({ src }) => src)).size, riParkPhotoAssets.length);
  for (const image of images.values()) {
    const master = await readFile(new URL(import.meta.resolve(image.artifact)));
    assert.equal(createHash("sha256").update(master).digest("hex"), image.sha256, image.id);
    const metadata = await sharp(master).metadata();
    assert.equal(metadata.width, image.width, image.id);
    assert.equal(metadata.height, image.height, image.id);
    assert.equal(metadata.format, "webp", image.id);
    for (const asset of riParkPhotoAssets.filter((candidate) => candidate.image.id === image.id)) {
      assert.ok(asset.src.includes(image.sha256.slice(0, 12)));
    }
  }
});

test("renditions decode at the advertised dimensions without enlarging small masters", async () => {
  if (riParkPhotoAssets.length === 0) {
    for (const park of parks) assert.equal(getRiParkPhoto(park.reference), null);
    return;
  }
  for (const asset of riParkPhotoAssets) {
    const bytes = await renderParkPhoto(asset);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, asset.width);
    assert.equal(metadata.height, asset.height);
    assert.ok(metadata.width <= asset.image.width);
    assert.equal(metadata.exif, undefined);
  }
});
