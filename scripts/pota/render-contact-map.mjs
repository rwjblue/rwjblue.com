#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node scripts/pota/render-contact-map.mjs \\
    --input <adi> \\
    --output <svg> \\
    [--title <title>] \\
    [--subtitle <subtitle>]

Reads an ADI/ADIF log with GRIDSQUARE fields and writes a static SVG contact map.`);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function parseArgs(argv) {
  const options = {
    title: "Contact map",
    subtitle: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--input":
        options.input = argv[++i];
        break;
      case "--output":
        options.output = argv[++i];
        break;
      case "--title":
        options.title = argv[++i];
        break;
      case "--subtitle":
        options.subtitle = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.input || !options.output) {
    throw new Error("Both --input and --output are required.");
  }

  return options;
}

function parseAdif(content) {
  const records = content
    .split(/<EOR>/i)
    .map((record) => record.trim())
    .filter(Boolean);

  return records.map((record) => {
    const fields = {};
    const regex = /<([A-Z0-9_]+):(\d+)(:[^>]*)?>([^<]*)/gi;
    let match;

    while ((match = regex.exec(record))) {
      fields[match[1].toUpperCase()] = match[4].trim();
    }

    return fields;
  });
}

function gridToLatLon(grid) {
  if (!grid || grid.length < 4) {
    return null;
  }

  const g = grid.trim().toUpperCase();
  const lonField = g.charCodeAt(0) - 65;
  const latField = g.charCodeAt(1) - 65;
  const lonSquare = Number.parseInt(g[2], 10);
  const latSquare = Number.parseInt(g[3], 10);

  if (
    Number.isNaN(lonSquare) ||
    Number.isNaN(latSquare) ||
    lonField < 0 ||
    latField < 0
  ) {
    return null;
  }

  let lon = -180 + lonField * 20 + lonSquare * 2;
  let lat = -90 + latField * 10 + latSquare;
  let lonSpan = 2;
  let latSpan = 1;

  if (g.length >= 6) {
    const lonSub = g.charCodeAt(4) - 65;
    const latSub = g.charCodeAt(5) - 65;
    if (lonSub >= 0 && latSub >= 0) {
      lon += lonSub * (5 / 60);
      lat += latSub * (2.5 / 60);
      lonSpan = 5 / 60;
      latSpan = 2.5 / 60;
    }
  }

  if (g.length >= 8) {
    const lonExt = Number.parseInt(g[6], 10);
    const latExt = Number.parseInt(g[7], 10);
    if (!Number.isNaN(lonExt) && !Number.isNaN(latExt)) {
      lon += lonExt * (0.5 / 60);
      lat += latExt * (0.25 / 60);
      lonSpan = 0.5 / 60;
      latSpan = 0.25 / 60;
    }
  }

  return {
    lat: lat + latSpan / 2,
    lon: lon + lonSpan / 2,
  };
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) {
    return "";
  }

  const year = Number.parseInt(yyyymmdd.slice(0, 4), 10);
  const month = Number.parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const day = Number.parseInt(yyyymmdd.slice(6, 8), 10);
  const date = new Date(Date.UTC(year, month, day));

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function bandColor(band) {
  switch ((band ?? "").toLowerCase()) {
    case "40m":
      return "#1e6f4f";
    case "20m":
      return "#1774d1";
    default:
      return "#8a4b2b";
  }
}

function renderSvg({
  title,
  subtitle,
  origin,
  contacts,
  stationCallsign,
  dateLabel,
  totalRecords,
}) {
  const width = 840;
  const height = 1120;
  const headerHeight = 156;
  const mapLeft = 52;
  const mapTop = 196;
  const mapWidth = width - mapLeft * 2;
  const mapHeight = height - mapTop - 64;
  const bounds = {
    minLon: -128,
    maxLon: -66,
    minLat: 24,
    maxLat: 51,
  };

  const project = ({ lat, lon }) => {
    const x = mapLeft + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * mapWidth;
    const y =
      mapTop +
      (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * mapHeight;
    return { x, y };
  };

  const originPoint = project(origin);
  const bandCounts = new Map();
  for (const contact of contacts) {
    bandCounts.set(contact.band, (bandCounts.get(contact.band) ?? 0) + 1);
  }
  const missingGridCount = totalRecords - contacts.length;

  const gridLines = [];
  for (let lon = -120; lon <= -70; lon += 10) {
    const a = project({ lat: bounds.minLat, lon });
    const b = project({ lat: bounds.maxLat, lon });
    gridLines.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#d6ddd5" stroke-width="1"/>`,
    );
  }
  for (let lat = 25; lat <= 50; lat += 5) {
    const a = project({ lat, lon: bounds.minLon });
    const b = project({ lat, lon: bounds.maxLon });
    gridLines.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#d6ddd5" stroke-width="1"/>`,
    );
  }

  const labels = [
    { text: "Pacific", lat: 35, lon: -122 },
    { text: "Midwest", lat: 41.7, lon: -93.5 },
    { text: "Northeast", lat: 44.2, lon: -74.5 },
    { text: "South", lat: 33.5, lon: -89 },
  ]
    .map(({ text, lat, lon }) => {
      const p = project({ lat, lon });
      return `<text x="${p.x}" y="${p.y}" fill="#9aa5a0" font-size="20" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" text-anchor="middle">${text}</text>`;
    })
    .join("");

  const contactLines = contacts
    .map((contact) => {
      const p = project(contact);
      return `<line x1="${originPoint.x}" y1="${originPoint.y}" x2="${p.x}" y2="${p.y}" stroke="${bandColor(contact.band)}" stroke-opacity="0.28" stroke-width="1.6"/>`;
    })
    .join("");

  const contactPoints = contacts
    .map((contact) => {
      const p = project(contact);
      return `<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${bandColor(contact.band)}" stroke="#172026" stroke-width="1.5"/>`;
    })
    .join("");

  const legend = Array.from(bandCounts.entries())
    .map(([band, count], index) => {
      const x = 52 + index * 132;
      return `
        <circle cx="${x}" cy="103" r="7" fill="${bandColor(band)}" stroke="#172026" stroke-width="1.5"/>
        <text x="${x + 16}" y="109" fill="#5f6f79" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(band)} ${count}</text>
      `;
    })
    .join("");

  const footer = missingGridCount
    ? `Generated from ADI grid squares · ${contacts.length} plotted, ${missingGridCount} without grid`
    : `Generated from ADI grid squares · ${contacts.length} plotted`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title subtitle">
  <title id="title">${escapeXml(title)}</title>
  <desc id="subtitle">${escapeXml(subtitle)}</desc>
  <rect width="${width}" height="${height}" fill="#f7f4ee"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="#fffdfa" stroke="#d6ddd5"/>
  <text x="52" y="74" fill="#172026" font-size="40" font-weight="800" font-family="system-ui, sans-serif">${escapeXml(title)}</text>
  <text x="52" y="140" fill="#5f6f79" font-size="22" font-family="system-ui, sans-serif">${escapeXml(
    subtitle || `${stationCallsign} · ${contacts.length} QSOs · ${dateLabel}`,
  )}</text>
  ${legend}
  <rect x="${mapLeft}" y="${mapTop}" width="${mapWidth}" height="${mapHeight}" rx="18" fill="#eef3ec" stroke="#d6ddd5"/>
  ${gridLines.join("")}
  ${labels}
  <text x="${mapLeft + 18}" y="${mapTop + mapHeight - 18}" fill="#9aa5a0" font-size="16" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(footer)}</text>
  ${contactLines}
  ${contactPoints}
  <circle cx="${originPoint.x}" cy="${originPoint.y}" r="8.5" fill="#172026" stroke="#fffdfa" stroke-width="3"/>
  <text x="${originPoint.x + 14}" y="${originPoint.y - 14}" fill="#172026" font-size="20" font-weight="800" font-family="system-ui, sans-serif">${escapeXml(
    stationCallsign,
  )}</text>
</svg>`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await fs.readFile(options.input, "utf8");
  const records = parseAdif(input);
  const contacts = records
    .map((record) => {
      const point = gridToLatLon(record.GRIDSQUARE);
      if (!point) {
        return null;
      }

      return {
        ...point,
        band: record.BAND || "other",
        call: record.CALL || "",
      };
    })
    .filter(Boolean);

  const originRecord = records.find((record) => record.MY_GRIDSQUARE);
  const origin = gridToLatLon(originRecord?.MY_GRIDSQUARE);

  if (!origin) {
    throw new Error("Could not determine MY_GRIDSQUARE from the ADI file.");
  }

  if (contacts.length === 0) {
    throw new Error("No contacts with GRIDSQUARE fields were found.");
  }

  const stationCallsign = originRecord?.STATION_CALLSIGN || originRecord?.OPERATOR || "N1RWJ";
  const dateLabel = formatDate(originRecord?.QSO_DATE);
  const svg = renderSvg({
    title: options.title,
    subtitle: options.subtitle,
    origin,
    contacts,
    stationCallsign,
    dateLabel,
    totalRecords: records.length,
  });

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, svg, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exitCode = 1;
});
