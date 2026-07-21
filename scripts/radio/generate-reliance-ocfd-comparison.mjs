import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outputDirectory = path.join(
  repoRoot,
  "public/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing",
);
const outputPath = path.join(outputDirectory, "measured-swr-comparison.svg");
const mobileOutputPath = path.join(
  outputDirectory,
  "measured-swr-comparison-mobile.svg",
);

const measurements = [
  {
    band: "40 m",
    frequency: "7.150 / 7.090 MHz",
    original: 4.3,
    green: 3.6,
  },
  {
    band: "20 m",
    frequency: "14.175 / 14.178 MHz",
    original: 2.3,
    green: 1.48,
  },
  {
    band: "15 m",
    frequency: "21.225 MHz",
    original: 3.9,
    green: 1.51,
  },
  {
    band: "10 m",
    frequency: "28.850 MHz",
    original: 1.37,
    green: 2.5,
  },
];

const plotLeft = 230;
const plotRight = 890;
const plotTop = 188;
const plotBottom = 580;
const rowGap = 98;
const swrX = (swr) => plotLeft + ((swr - 1) / 4) * (plotRight - plotLeft);
const number = (value) => Number(value.toFixed(2));

const ticks = [1, 2, 3, 4, 5]
  .map((tick) => {
    const x = number(swrX(tick));
    const stroke = tick === 2 ? "#8ba79a" : "#d9ded8";
    const width = tick === 2 ? 2 : 1;
    return `
      <line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="${stroke}" stroke-width="${width}" />
      <text x="${x}" y="${plotTop - 16}" text-anchor="middle" class="tick">${tick}:1</text>`;
  })
  .join("");

const rows = measurements
  .map((measurement, index) => {
    const y = plotTop + 42 + index * rowGap;
    const originalX = number(swrX(measurement.original));
    const greenX = number(swrX(measurement.green));
    const diamond = `${greenX},${y - 9} ${greenX + 9},${y} ${greenX},${y + 9} ${greenX - 9},${y}`;
    const originalLabelAnchor = measurement.original >= 4.6 ? "end" : "start";
    const originalLabelX = measurement.original >= 4.6 ? originalX - 13 : originalX + 13;
    const greenLabelAnchor = measurement.green >= 4.6 ? "end" : "start";
    const greenLabelX = measurement.green >= 4.6 ? greenX - 13 : greenX + 13;

    return `
      <g>
        <text x="44" y="${y - 4}" class="band">${measurement.band}</text>
        <text x="44" y="${y + 20}" class="frequency">${measurement.frequency}</text>
        <line x1="${Math.min(originalX, greenX)}" y1="${y}" x2="${Math.max(originalX, greenX)}" y2="${y}" stroke="#aab4b8" stroke-width="4" stroke-linecap="round" />
        <circle cx="${originalX}" cy="${y}" r="9" fill="#5f6f79" />
        <text x="${originalLabelX}" y="${y - 14}" text-anchor="${originalLabelAnchor}" class="value original-value">${measurement.original}</text>
        <polygon points="${diamond}" fill="#2f6f4e" />
        <text x="${greenLabelX}" y="${y + 29}" text-anchor="${greenLabelAnchor}" class="value green-value">${measurement.green}</text>
      </g>`;
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="680" viewBox="0 0 960 680" role="img" aria-labelledby="title description">
  <title id="title">Measured in-band SWR for the original and green 80/20 Reliance OCFD wires</title>
  <desc id="description">A dumbbell chart comparing the original wire with the green 80/20 replacement on 40, 20, 15, and 10 meters. The green wire improves the measured 40, 20, and 15 meter points while the original has the lower 10 meter SWR. The sessions used different coax and choke configurations.</desc>
  <style>
    .title { font: 800 31px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .subtitle { font: 500 17px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
    .legend { font: 700 15px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .tick, .frequency, .footnote { font: 700 13px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #5f6f79; }
    .band { font: 800 21px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .value { font: 800 16px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .original-value { fill: #5f6f79; }
    .green-value { fill: #2f6f4e; }
  </style>
  <rect width="960" height="680" rx="16" fill="#fffdfa" />
  <rect x="${plotLeft}" y="${plotTop}" width="${number(swrX(2) - plotLeft)}" height="${plotBottom - plotTop}" fill="#edf5f0" />
  <text x="44" y="52" class="title">Measured in-band SWR</text>
  <text x="44" y="81" class="subtitle">Historical original wire vs. first green 80/20 session</text>

  <circle cx="604" cy="53" r="8" fill="#5f6f79" />
  <text x="621" y="59" class="legend">Original wire</text>
  <polygon points="763,45 771,53 763,61 755,53" fill="#2f6f4e" />
  <text x="780" y="59" class="legend">Green 80/20</text>

  <text x="${number(swrX(1.5))}" y="${plotTop + 20}" text-anchor="middle" class="frequency" fill="#2f6f4e">≤ 2:1 reference</text>
  ${ticks}
  ${rows}

  <line x1="44" y1="620" x2="916" y2="620" stroke="#d9ded8" />
  <text x="44" y="647" class="footnote">Different-day setups: original used RG-316; green used RG-174 plus five ferrite beads.</text>
</svg>
`;

const mobilePlotLeft = 98;
const mobilePlotRight = 370;
const mobilePlotTop = 170;
const mobilePlotBottom = 650;
const mobileSwrX = (swr) =>
  mobilePlotLeft + ((swr - 1) / 4) * (mobilePlotRight - mobilePlotLeft);
const mobileFrequencies = [
  "7.150 / 7.090",
  "14.175 / 14.178",
  "21.225",
  "28.850",
];

const mobileTicks = [1, 2, 3, 4, 5]
  .map((tick) => {
    const x = number(mobileSwrX(tick));
    const stroke = tick === 2 ? "#8ba79a" : "#d9ded8";
    const width = tick === 2 ? 2 : 1;
    return `
      <line x1="${x}" y1="${mobilePlotTop}" x2="${x}" y2="${mobilePlotBottom}" stroke="${stroke}" stroke-width="${width}" />
      <text x="${x}" y="${mobilePlotTop - 13}" text-anchor="middle" class="tick">${tick}:1</text>`;
  })
  .join("");

const mobileRows = measurements
  .map((measurement, index) => {
    const y = mobilePlotTop + 62 + index * 116;
    const originalX = number(mobileSwrX(measurement.original));
    const greenX = number(mobileSwrX(measurement.green));
    const diamond = `${greenX},${y - 8} ${greenX + 8},${y} ${greenX},${y + 8} ${greenX - 8},${y}`;

    return `
      <g>
        <text x="18" y="${y - 4}" class="band">${measurement.band}</text>
        <text x="18" y="${y + 18}" class="frequency">${mobileFrequencies[index]}</text>
        <line x1="${Math.min(originalX, greenX)}" y1="${y}" x2="${Math.max(originalX, greenX)}" y2="${y}" stroke="#aab4b8" stroke-width="4" stroke-linecap="round" />
        <circle cx="${originalX}" cy="${y}" r="8" fill="#5f6f79" />
        <text x="${originalX}" y="${y - 15}" text-anchor="middle" class="value original-value">${measurement.original}</text>
        <polygon points="${diamond}" fill="#2f6f4e" />
        <text x="${greenX}" y="${y + 28}" text-anchor="middle" class="value green-value">${measurement.green}</text>
      </g>`;
  })
  .join("");

const mobileSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="390" height="760" viewBox="0 0 390 760" role="img" aria-labelledby="mobile-title mobile-description">
  <title id="mobile-title">Measured in-band SWR for the original and green 80/20 Reliance OCFD wires</title>
  <desc id="mobile-description">A dumbbell chart comparing the original wire with the green 80/20 replacement on 40, 20, 15, and 10 meters. The green wire improves the measured 40, 20, and 15 meter points while the original has the lower 10 meter SWR. The sessions used different coax and choke configurations.</desc>
  <style>
    .title { font: 800 25px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .subtitle { font: 500 14px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
    .legend { font: 700 13px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .tick, .frequency, .footnote { font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #5f6f79; }
    .band { font: 800 18px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .value { font: 800 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .original-value { fill: #5f6f79; }
    .green-value { fill: #2f6f4e; }
  </style>
  <rect width="390" height="760" rx="12" fill="#fffdfa" />
  <rect x="${mobilePlotLeft}" y="${mobilePlotTop}" width="${number(mobileSwrX(2) - mobilePlotLeft)}" height="${mobilePlotBottom - mobilePlotTop}" fill="#edf5f0" />
  <text x="18" y="38" class="title">Measured in-band SWR</text>
  <text x="18" y="64" class="subtitle">Original wire vs. first green 80/20 session</text>

  <circle cx="27" cy="103" r="7" fill="#5f6f79" />
  <text x="42" y="108" class="legend">Original wire</text>
  <polygon points="200,96 207,103 200,110 193,103" fill="#2f6f4e" />
  <text x="215" y="108" class="legend">Green 80/20</text>

  <text x="${number(mobileSwrX(1.5))}" y="${mobilePlotTop + 18}" text-anchor="middle" class="frequency" fill="#2f6f4e">≤ 2:1</text>
  ${mobileTicks}
  ${mobileRows}

  <line x1="18" y1="690" x2="372" y2="690" stroke="#d9ded8" />
  <text x="18" y="716" class="footnote">Different-day setups: original used RG-316;</text>
  <text x="18" y="735" class="footnote">green used RG-174 plus five ferrite beads.</text>
</svg>
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, svg);
await writeFile(mobileOutputPath, mobileSvg);
console.log(`Saved ${outputPath}`);
console.log(`Saved ${mobileOutputPath}`);
