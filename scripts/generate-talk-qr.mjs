import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

const siteUrl = "https://n1rwj.com/cw/";
const root = resolve(import.meta.dirname, "..");
const paddleMarkPath = resolve(
  root,
  "public/images/radio/2026-07-31-morse-code-for-the-technician-resources/zippy-paddle-line-art.png",
);
const outputPath = resolve(
  root,
  "public/images/radio/2026-07-31-morse-code-for-the-technician-resources/qr.png",
);

const size = 1600;
const badgeSize = 250;
const markSize = 210;
const badgeOffset = Math.round((size - badgeSize) / 2);
const markOffset = Math.round((size - markSize) / 2);

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
    <rect width="${badgeSize}" height="${badgeSize}" rx="44" fill="#fffdf7"/>
  </svg>
`);

const paddleMark = await sharp(paddleMarkPath)
  .trim({ background: "#ffffff", threshold: 10 })
  .resize(markSize, markSize, {
    fit: "contain",
    background: "#fffdf7",
  })
  .threshold(210)
  .png()
  .toBuffer();

await sharp(qr)
  .composite([
    { input: badge, left: badgeOffset, top: badgeOffset },
    { input: paddleMark, left: markOffset, top: markOffset },
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
