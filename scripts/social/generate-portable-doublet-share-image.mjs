import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const sourcePath = path.join(
  repoRoot,
  "public/images/pota/2026-08-08-pulaski-state-park-doublet-test/antenna-center-support.jpg",
);
const outputPath = path.join(
  repoRoot,
  "public/images/radio/2026-08-08-portable-58-foot-doublet/share.png",
);

const fieldPhoto = await sharp(sourcePath)
  .resize(510, 630, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.87, saturation: 0.92 })
  .png()
  .toBuffer();

const card = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      .brand { font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.4px; }
      .eyebrow { font: 800 16px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.4px; }
      .title { font: 800 57px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
      .subtitle { font: 500 22px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
      .dimension { font: 800 14px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.8px; fill: #172026; }
      .photo-label { font: 800 14px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; fill: #f7f4ee; }
    </style>

    <rect width="1200" height="630" fill="#f7f4ee" />
    <rect width="18" height="630" fill="#2f6f4e" />
    <rect x="690" width="510" height="630" fill="#172026" />

    <text x="58" y="64" class="brand" fill="#172026">RWJBLUE / N1RWJ</text>
    <text x="58" y="119" class="eyebrow" fill="#2f6f4e">ANTENNA BUILD · KX2 · QRP</text>

    <text x="58" y="203" class="title">A 58-Foot Portable</text>
    <text x="58" y="271" class="title">Doublet for the KX2</text>
    <text x="58" y="320" class="subtitle">One continuous radiator and homebrew balanced line</text>

    <line x1="58" y1="372" x2="632" y2="372" stroke="#c5ccc4" stroke-width="2" />

    <path d="M112 468 L252 404 L392 468" fill="none" stroke="#172026" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="245" y1="405" x2="245" y2="558" stroke="#d98c4a" stroke-width="3" />
    <line x1="259" y1="405" x2="259" y2="558" stroke="#d98c4a" stroke-width="3" />
    <circle cx="252" cy="404" r="9" fill="#2f6f4e" />
    <circle cx="112" cy="468" r="6" fill="#d98c4a" />
    <circle cx="392" cy="468" r="6" fill="#d98c4a" />

    <text x="164" y="426" class="dimension" transform="rotate(-24 164 426)">29 FT</text>
    <text x="327" y="426" class="dimension" transform="rotate(24 327 426)">29 FT</text>
    <text x="278" y="500" class="dimension">28 FT BALANCED LINE</text>

    <rect x="58" y="582" width="574" height="2" fill="#c5ccc4" />
    <text x="58" y="612" class="eyebrow" fill="#2f6f4e">40–10 METERS · FIELD-TESTED AT 5 WATTS</text>

    <rect x="716" y="554" width="454" height="48" rx="5" fill="#172026" fill-opacity="0.88" />
    <circle cx="742" cy="578" r="7" fill="#d98c4a" />
    <text x="761" y="583" class="photo-label">TREE-SUPPORTED · APPROX. 30 FT</text>
  </svg>
`);

await sharp(card)
  .composite([
    { input: fieldPhoto, left: 690, top: 0 },
    {
      input: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
          <rect x="690" y="0" width="510" height="630" fill="none" stroke="#172026" stroke-width="2" />
          <rect x="716" y="554" width="454" height="48" rx="5" fill="#172026" fill-opacity="0.88" />
          <circle cx="742" cy="578" r="7" fill="#d98c4a" />
          <text x="761" y="583" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" font-weight="800" letter-spacing="1" fill="#f7f4ee">TREE-SUPPORTED · APPROX. 30 FT</text>
        </svg>
      `),
      left: 0,
      top: 0,
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Saved ${outputPath}`);
