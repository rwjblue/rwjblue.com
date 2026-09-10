import { readFile } from "node:fs/promises";
import { getPark, parks } from "@ripota/parks";
import registry from "@ripota/parks/images.json" with { type: "json" };
import type { ParkImage, ParkImageRegistry } from "@ripota/parks/types";
import sharp from "sharp";

// Build-time only. Bump the recipe when changing processing or encoder versions
// so immutable URLs never refer to different renditions of the same master.
const recipe = "webp80-v1";
export const parkPhotoProcessing =
  "Displayed at its original aspect ratio; resized without enlargement and re-encoded as WebP at quality 80 for this site. No crop applied.";

const images = new Map(
  (registry as ParkImageRegistry).images.map((image) => [image.id, image]),
);

export interface ParkPhotoAsset {
  image: ParkImage;
  width: number;
  height: number;
  filename: string;
  src: string;
}

function imageAssets(image: ParkImage): ParkPhotoAsset[] {
  const widths = [...new Set([
    ...[480, 800, 1280, 1920].filter((width) => width < image.width),
    Math.min(image.width, 1920),
  ])].sort((left, right) => left - right);

  return widths.map((width) => {
    const filename = `${image.id}.${image.sha256.slice(0, 12)}.w${width}.${recipe}`;
    return {
      image,
      width,
      height: Math.round(image.height * width / image.width),
      filename,
      src: `/assets/parks/${filename}.webp`,
    };
  });
}

export function getRiParkPhoto(reference: string) {
  const imageId = getPark(reference)?.heroImageId;
  if (!imageId) return null;
  const image = images.get(imageId);
  if (!image) throw new Error(`Missing packaged park image: ${imageId}`);

  const assets = imageAssets(image);
  const main = assets.findLast(({ width }) => width <= 1280) ?? assets[0];
  return {
    image,
    src: main.src,
    srcset: assets.map(({ src, width }) => `${src} ${width}w`).join(", "),
    width: image.width,
    height: image.height,
  };
}

export type RiParkPhoto = NonNullable<ReturnType<typeof getRiParkPhoto>>;

const selectedImages = new Set(parks.flatMap((park) =>
  park.heroImageId ? [park.heroImageId] : [],
));
export const riParkPhotoAssets = [...images.values()]
  .filter(({ id }) => selectedImages.has(id))
  .flatMap(imageAssets);

export async function renderParkPhoto(asset: ParkPhotoAsset): Promise<Uint8Array> {
  const master = await readFile(new URL(import.meta.resolve(asset.image.artifact)));
  return new Uint8Array(await sharp(master)
    .resize({ width: asset.width, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer());
}
