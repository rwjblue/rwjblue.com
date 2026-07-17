import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const imageDirectory = path.join(
  repoRoot,
  "public/images/radio/2026-07-16-wsjt-x-qk4-k4d",
);
const sourcePath = path.join(imageDirectory, "wsjt-x-wspr-results.png");
const outputPath = path.join(imageDirectory, "share.png");

const screenshot = await sharp(sourcePath)
  .extract({ left: 0, top: 64, width: 1000, height: 1280 })
  .resize(356, 526, { fit: "cover", position: "left" })
  .png()
  .toBuffer();

const base = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      .brand { font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.4px; }
      .eyebrow { font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.5px; }
      .title { font: 800 57px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
      .subtitle { font: 500 23px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
      .node { font: 800 18px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #172026; }
      .node-light { font: 800 18px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #f7f4ee; }
      .node-small { font: 700 12px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #5f6f79; letter-spacing: 0.5px; }
      .route-label { font: 800 12px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #2f6f4e; letter-spacing: 0.8px; }
    </style>
    <rect width="1200" height="630" fill="#f7f4ee" />
    <rect width="18" height="630" fill="#2f6f4e" />
    <rect x="758" width="442" height="630" fill="#172026" />

    <text x="58" y="62" class="brand" fill="#172026">RWJBLUE / N1RWJ</text>
    <text x="58" y="117" class="eyebrow" fill="#2f6f4e">RADIO NOTE · FULLY REMOTE ON macOS</text>
    <text x="58" y="194" class="title">WSJT-X through QK4</text>
    <text x="58" y="262" class="title">with an Elecraft K4D</text>
    <text x="58" y="314" class="subtitle">Radio control and audio over the network—no USB cable.</text>

    <line x1="58" y1="374" x2="704" y2="374" stroke="#c5ccc4" stroke-width="2" />
    <text x="58" y="409" class="route-label">SIGNAL PATH</text>

    <rect x="58" y="438" width="126" height="70" rx="8" fill="#fffdfa" stroke="#172026" stroke-width="2" />
    <text x="121" y="480" text-anchor="middle" class="node">WSJT-X</text>

    <line x1="184" y1="473" x2="215" y2="473" stroke="#2f6f4e" stroke-width="3" />
    <path d="M184 473 l9 -6 v12 z" fill="#2f6f4e" />
    <path d="M215 473 l-9 -6 v12 z" fill="#2f6f4e" />

    <rect x="219" y="438" width="150" height="70" rx="8" fill="#fffdfa" stroke="#172026" stroke-width="2" />
    <text x="294" y="470" text-anchor="middle" class="node">LOOPBACK</text>
    <text x="294" y="491" text-anchor="middle" class="node-small">2 AUDIO DEVICES</text>

    <line x1="369" y1="473" x2="400" y2="473" stroke="#2f6f4e" stroke-width="3" />
    <path d="M369 473 l9 -6 v12 z" fill="#2f6f4e" />
    <path d="M400 473 l-9 -6 v12 z" fill="#2f6f4e" />

    <rect x="404" y="438" width="104" height="70" rx="8" fill="#dcebe2" stroke="#172026" stroke-width="2" />
    <text x="456" y="480" text-anchor="middle" class="node">QK4</text>

    <line x1="508" y1="473" x2="539" y2="473" stroke="#2f6f4e" stroke-width="3" />
    <path d="M508 473 l9 -6 v12 z" fill="#2f6f4e" />
    <path d="M539 473 l-9 -6 v12 z" fill="#2f6f4e" />

    <rect x="543" y="438" width="120" height="70" rx="8" fill="#172026" stroke="#172026" stroke-width="2" />
    <text x="603" y="480" text-anchor="middle" class="node-light">K4D</text>

    <path d="M121 522 v30 h335 v-30" fill="none" stroke="#d98c4a" stroke-width="2" />
    <text x="288" y="574" text-anchor="middle" class="node-small" fill="#8f3f2b">CAT · 127.0.0.1:9299</text>
    <text x="586" y="531" text-anchor="middle" class="node-small">NETWORK</text>

    <text x="58" y="609" class="brand" fill="#5f6f79">WSPR RX + TX CONFIRMED</text>
  </svg>
`);

const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      .label { font: 800 16px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; }
      .proof { font: 800 15px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.8px; }
      .site { font: 800 16px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1.2px; }
    </style>
    <rect x="786" y="52" width="364" height="530" rx="8" fill="none" stroke="#f7f4ee" stroke-width="4" />
    <path d="M786 60 q0 -8 8 -8 h348 q8 0 8 8 v48 h-364 z" fill="#172026" fill-opacity="0.94" />
    <text x="808" y="86" class="label" fill="#f7f4ee">WSJT-X · WSPR · 20m</text>
    <rect x="786" y="520" width="364" height="62" fill="#2f6f4e" fill-opacity="0.96" />
    <circle cx="812" cy="551" r="8" fill="#d4efdf" />
    <text x="832" y="557" class="proof" fill="#f7f4ee">RECEIVE + TRANSMIT WORKING</text>
    <text x="1150" y="612" text-anchor="end" class="site" fill="#f7f4ee">RWJBLUE.COM</text>
  </svg>
`);

await sharp(base)
  .composite([
    { input: screenshot, left: 790, top: 54 },
    { input: overlay, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Saved ${outputPath}`);
