import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

const siteUrl = "https://n1rwj.com/cw/";
const root = resolve(import.meta.dirname, "..");
const paddlePath = resolve(
  root,
  "public/images/radio/2026-07-29-building-k8ces-zippy-paddle/completed-zippy-paddle.jpg",
);
const outputPath = resolve(
  root,
  "public/images/radio/2026-07-31-morse-code-for-the-technician-resources/qr.png",
);

const size = 1600;
const badgeSize = 250;
const photoSize = 204;
const badgeOffset = Math.round((size - badgeSize) / 2);
const photoOffset = Math.round((size - photoSize) / 2);

await mkdir(dirname(outputPath), { recursive: true });

const qr = await QRCode.toBuffer(siteUrl, {
  color: {
    dark: "#123b2fff",
    light: "#fffdf7ff",
  },
  errorCorrectionLevel: "H",
  margin: 4,
  type: "png",
  width: size,
});

const badge = Buffer.from(`
  <svg width="${badgeSize}" height="${badgeSize}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${badgeSize}" height="${badgeSize}" rx="48" fill="#fffdf7"/>
    <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="111" fill="none" stroke="#e5b84b" stroke-width="8"/>
  </svg>
`);

const mask = Buffer.from(`
  <svg width="${photoSize}" height="${photoSize}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${photoSize / 2}" cy="${photoSize / 2}" r="${photoSize / 2}" fill="white"/>
  </svg>
`);

const paddle = await sharp(paddlePath)
  .resize(photoSize, photoSize, { fit: "cover", position: "centre" })
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

await sharp(qr)
  .composite([
    { input: badge, left: badgeOffset, top: badgeOffset },
    { input: paddle, left: photoOffset, top: photoOffset },
  ])
  .png()
  .toFile(outputPath);

const decodedImage = await sharp(outputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const decoded = jsQR(
  new Uint8ClampedArray(decodedImage.data),
  decodedImage.info.width,
  decodedImage.info.height,
);

if (decoded?.data !== siteUrl) {
  throw new Error(`QR validation failed: expected ${siteUrl}, received ${decoded?.data}`);
}

console.log(`${siteUrl} -> ${outputPath}`);
