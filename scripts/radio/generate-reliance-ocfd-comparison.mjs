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
    frequency: "7.09–7.15 MHz",
    original: 4.3,
    green: 3.6,
    orange: 1.37,
  },
  {
    band: "20 m",
    frequency: "14.175–14.178 MHz",
    original: 2.3,
    green: 1.48,
    orange: 1.33,
  },
  {
    band: "15 m",
    frequency: "21.225 MHz",
    original: 3.9,
    green: 1.51,
    orange: 4.5,
  },
  {
    band: "10 m",
    frequency: "28.850 MHz",
    original: 1.37,
    green: 2.5,
    orange: 1.57,
  },
];

const series = [
  {
    key: "original",
    label: "Original",
    color: "#5f6f79",
    marker: "circle",
  },
  {
    key: "green",
    label: "Green 80/20",
    color: "#2f6f4e",
    marker: "diamond",
  },
  {
    key: "orange",
    label: "Orange 64/36",
    color: "#d46b28",
    marker: "square",
  },
];

const number = (value) => Number(value.toFixed(2));

function marker({ marker, color, x, y, size = 8 }) {
  if (marker === "diamond") {
    return `<polygon points="${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}" fill="${color}" />`;
  }

  if (marker === "square") {
    return `<rect x="${number(x - size)}" y="${number(y - size)}" width="${number(size * 2)}" height="${number(size * 2)}" rx="2" fill="${color}" />`;
  }

  return `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}" />`;
}

function buildChart({
  width,
  height,
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  groupGap,
  rowGap,
  left,
  titleSize,
  subtitleSize,
  legendSize,
  bandSize,
  frequencySize,
  valueSize,
  tickSize,
  mobile = false,
}) {
  const swrX = (swr) =>
    plotLeft + ((swr - 1) / 4) * (plotRight - plotLeft);

  const ticks = [1, 2, 3, 4, 5]
    .map((tick) => {
      const x = number(swrX(tick));
      const stroke = tick === 2 ? "#8ba79a" : "#d9ded8";
      const strokeWidth = tick === 2 ? 2 : 1;

      return `
        <line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        <text x="${x}" y="${plotTop - 12}" text-anchor="middle" class="tick">${tick}:1</text>`;
    })
    .join("");

  const rows = measurements
    .map((measurement, groupIndex) => {
      const groupTop = plotTop + 35 + groupIndex * groupGap;
      const labelY = groupTop + rowGap;
      const subrows = series
        .map((item, seriesIndex) => {
          const y = groupTop + seriesIndex * rowGap;
          const value = measurement[item.key];
          const x = number(swrX(value));
          const labelOnLeft = value >= 4.55;
          const labelX = labelOnLeft ? x - 12 : x + 12;
          const labelAnchor = labelOnLeft ? "end" : "start";

          return `
            <line x1="${number(swrX(1))}" y1="${y}" x2="${x}" y2="${y}" stroke="${item.color}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round" />
            ${marker({ ...item, x, y, size: mobile ? 7 : 8 })}
            <text x="${labelX}" y="${y + 5}" text-anchor="${labelAnchor}" class="value" fill="${item.color}">${value}</text>`;
        })
        .join("");

      return `
        <g>
          <text x="${left}" y="${labelY - 8}" class="band">${measurement.band}</text>
          <text x="${left}" y="${labelY + 14}" class="frequency">${measurement.frequency}</text>
          ${subrows}
        </g>`;
    })
    .join("");

  const legendY = mobile ? 103 : 91;
  const legendItems = series
    .map((item, index) => {
      const x = mobile ? left + index * 122 : 430 + index * 170;
      const markerX = x + 7;

      return `
        ${marker({ ...item, x: markerX, y: legendY, size: mobile ? 6 : 7 })}
        <text x="${x + 21}" y="${legendY + 5}" class="legend">${item.label}</text>`;
    })
    .join("");

  const footnote = mobile
    ? `
      <text x="${left}" y="${height - 58}" class="footnote">Original: RG-316, no confirmed choke.</text>
      <text x="${left}" y="${height - 38}" class="footnote">Replacements: RG-174 + five ferrites;</text>
      <text x="${left}" y="${height - 18}" class="footnote">mast shifted a few feet for leg lengths.</text>`
    : `
      <text x="${left}" y="${height - 30}" class="footnote">Original: RG-316 with no confirmed choke. Replacements: RG-174 plus five ferrites; mast shifted a few feet for leg lengths.</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Measured in-band SWR for three Reliance OCFD wire assemblies</title>
  <desc id="description">A grouped dot plot comparing the original wire, green 80/20 replacement, and orange 64/36 replacement on 40, 20, 15, and 10 meters. Orange has the lowest measured SWR on 40 and 20 meters, green on 15 meters, and the original narrowly on 10 meters.</desc>
  <style>
    .title { font: 800 ${titleSize}px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .subtitle { font: 500 ${subtitleSize}px Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6f79; }
    .legend { font: 700 ${legendSize}px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .tick, .frequency, .footnote { font: 700 ${tickSize}px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #5f6f79; }
    .band { font: 800 ${bandSize}px Inter, ui-sans-serif, system-ui, sans-serif; fill: #172026; }
    .frequency { font-size: ${frequencySize}px; }
    .value { font: 800 ${valueSize}px ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
  <rect width="${width}" height="${height}" rx="${mobile ? 12 : 16}" fill="#fffdfa" />
  <rect x="${plotLeft}" y="${plotTop}" width="${number(swrX(2) - plotLeft)}" height="${plotBottom - plotTop}" fill="#edf5f0" />
  <text x="${left}" y="${mobile ? 38 : 52}" class="title">Measured in-band SWR</text>
  <text x="${left}" y="${mobile ? 64 : 80}" class="subtitle">Original wire and two untrimmed replacements</text>
  ${legendItems}
  <text x="${number(swrX(1.5))}" y="${plotTop + 18}" text-anchor="middle" class="frequency" fill="#2f6f4e">≤ 2:1</text>
  ${ticks}
  ${rows}
  <line x1="${left}" y1="${height - (mobile ? 80 : 58)}" x2="${width - left}" y2="${height - (mobile ? 80 : 58)}" stroke="#d9ded8" />
  ${footnote}
</svg>
`;
}

const svg = buildChart({
  width: 960,
  height: 760,
  plotLeft: 230,
  plotRight: 900,
  plotTop: 155,
  plotBottom: 668,
  groupGap: 124,
  rowGap: 27,
  left: 44,
  titleSize: 31,
  subtitleSize: 17,
  legendSize: 14,
  bandSize: 21,
  frequencySize: 12,
  valueSize: 14,
  tickSize: 12,
});

const mobileSvg = buildChart({
  width: 390,
  height: 820,
  plotLeft: 104,
  plotRight: 368,
  plotTop: 145,
  plotBottom: 712,
  groupGap: 137,
  rowGap: 27,
  left: 18,
  titleSize: 25,
  subtitleSize: 14,
  legendSize: 10,
  bandSize: 18,
  frequencySize: 9,
  valueSize: 11,
  tickSize: 9,
  mobile: true,
});

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, svg);
await writeFile(mobileOutputPath, mobileSvg);
console.log(`Saved ${outputPath}`);
console.log(`Saved ${mobileOutputPath}`);
