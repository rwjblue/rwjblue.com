import sharp from "sharp";

// SVGs are the editable originals. PNGs serve home screens and media artwork.
for (const [name, source, background] of [
  ["site", "public/favicon.svg", "#102a43"],
  ["cw", "public/assets/branding/cw-icon.svg", "#286247"],
]) {
  for (const size of [32, 180, 192, 512]) {
    await sharp(source, { density: 384 })
      .resize(size, size)
      .flatten({ background })
      .png()
      .toFile(`public/assets/branding/${name}-${size}.png`);
  }
}
