#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { DXCC_BY_CODE } from "@ham2k/lib-dxcc-data";
import { adifToQSON } from "./ham2k-qson-adif.mjs";
import { bandColor } from "../../src/data/pota/band-colors.mjs";

function usage() {
  console.error(`Usage:
  node scripts/pota/render-contact-map.mjs \\
    --input <adi> \\
    --output <file> \\
    [--title <title>] \\
    [--subtitle <subtitle>]

Reads an ADI/ADIF log and writes public contact-map data as JSON, or a static SVG
when the output path ends in .svg.`);
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

export function parseAdif(content) {
  return adifToQSON(content);
}

export function gridToLatLon(grid) {
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

const US_STATE_CENTROIDS = {
  AL: { lat: 32.806671, lon: -86.79113 },
  AK: { lat: 61.370716, lon: -152.404419 },
  AZ: { lat: 33.729759, lon: -111.431221 },
  AR: { lat: 34.969704, lon: -92.373123 },
  CA: { lat: 36.116203, lon: -119.681564 },
  CO: { lat: 39.059811, lon: -105.311104 },
  CT: { lat: 41.597782, lon: -72.755371 },
  DE: { lat: 39.318523, lon: -75.507141 },
  FL: { lat: 27.766279, lon: -81.686783 },
  GA: { lat: 33.040619, lon: -83.643074 },
  HI: { lat: 21.094318, lon: -157.498337 },
  ID: { lat: 44.240459, lon: -114.478828 },
  IL: { lat: 40.349457, lon: -88.986137 },
  IN: { lat: 39.849426, lon: -86.258278 },
  IA: { lat: 42.011539, lon: -93.210526 },
  KS: { lat: 38.5266, lon: -96.726486 },
  KY: { lat: 37.66814, lon: -84.670067 },
  LA: { lat: 31.169546, lon: -91.867805 },
  ME: { lat: 44.693947, lon: -69.381927 },
  MD: { lat: 39.063946, lon: -76.802101 },
  MA: { lat: 42.230171, lon: -71.530106 },
  MI: { lat: 43.326618, lon: -84.536095 },
  MN: { lat: 45.694454, lon: -93.900192 },
  MS: { lat: 32.741646, lon: -89.678696 },
  MO: { lat: 38.456085, lon: -92.288368 },
  MT: { lat: 46.921925, lon: -110.454353 },
  NE: { lat: 41.12537, lon: -98.268082 },
  NV: { lat: 38.313515, lon: -117.055374 },
  NH: { lat: 43.452492, lon: -71.563896 },
  NJ: { lat: 40.298904, lon: -74.521011 },
  NM: { lat: 34.840515, lon: -106.248482 },
  NY: { lat: 42.165726, lon: -74.948051 },
  NC: { lat: 35.630066, lon: -79.806419 },
  ND: { lat: 47.528912, lon: -99.784012 },
  OH: { lat: 40.388783, lon: -82.764915 },
  OK: { lat: 35.565342, lon: -96.928917 },
  OR: { lat: 44.572021, lon: -122.070938 },
  PA: { lat: 40.590752, lon: -77.209755 },
  RI: { lat: 41.680893, lon: -71.51178 },
  SC: { lat: 33.856892, lon: -80.945007 },
  SD: { lat: 44.299782, lon: -99.438828 },
  TN: { lat: 35.747845, lon: -86.692345 },
  TX: { lat: 31.054487, lon: -97.563461 },
  UT: { lat: 40.150032, lon: -111.862434 },
  VT: { lat: 44.045876, lon: -72.710686 },
  VA: { lat: 37.769337, lon: -78.169968 },
  WA: { lat: 47.400902, lon: -121.490494 },
  WV: { lat: 38.491226, lon: -80.954453 },
  WI: { lat: 44.268543, lon: -89.616508 },
  WY: { lat: 42.755966, lon: -107.30249 },
  DC: { lat: 38.9072, lon: -77.0369 },
};

export function stateToLatLon(state, dxcc) {
  if ((dxcc && String(dxcc) !== "291") || !state) {
    return null;
  }

  return US_STATE_CENTROIDS[state.trim().toUpperCase()] ?? null;
}

function dxccCodeForValue(dxcc) {
  if (dxcc === undefined || dxcc === null || dxcc === "") {
    return undefined;
  }

  const code = Number.parseInt(String(dxcc), 10);
  return Number.isNaN(code) ? String(dxcc) : code;
}

export function dxccEntityForCode(dxcc) {
  const code = dxccCodeForValue(dxcc);
  if (typeof code !== "number") {
    return null;
  }

  return DXCC_BY_CODE[code] ?? null;
}

export function countryToLatLon(dxcc) {
  const entity = dxccEntityForCode(dxcc);
  if (!entity || typeof entity.lat !== "number" || typeof entity.lon !== "number") {
    return null;
  }

  return { lat: entity.lat, lon: entity.lon };
}

export function collectDxccEntities(contacts) {
  const entitiesByCode = new Map();

  for (const contact of contacts) {
    if (!contact.destinationDxccName || contact.destinationDxccCode === undefined) {
      continue;
    }

    const dxccCode = dxccCodeForValue(contact.destinationDxccCode);
    const current = entitiesByCode.get(dxccCode) ?? {
      dxccCode,
      name: contact.destinationDxccName,
      flag: contact.destinationDxccFlag,
      count: 0,
    };
    current.count += 1;
    entitiesByCode.set(dxccCode, current);
  }

  return [...entitiesByCode.values()].sort((a, b) => {
    return b.count - a.count || a.name.localeCompare(b.name) || a.dxccCode - b.dxccCode;
  });
}

export function shouldRenderDxccSummary(map) {
  if (!map.dxccEntities || map.dxccEntities.length === 0) {
    return false;
  }

  if (map.originDxccCode === undefined || map.originDxccCode === null) {
    return map.dxccEntities.length >= 2;
  }

  const originDxccCode = dxccCodeForValue(map.originDxccCode);
  return map.dxccEntities.some((entity) => {
    return dxccCodeForValue(entity.dxccCode) !== originDxccCode;
  });
}

export function collectBandCounts(contacts) {
  const bandCounts = {};

  for (const contact of contacts) {
    bandCounts[contact.band] = (bandCounts[contact.band] ?? 0) + 1;
  }

  return bandCounts;
}

function uniqueOrigins(contacts) {
  const seen = new Map();

  for (const contact of contacts) {
    const key = `${contact.origin.lat},${contact.origin.lon},${contact.originGrid}`;
    if (!seen.has(key)) {
      seen.set(key, {
        originGrid: contact.originGrid,
        origin: contact.origin,
      });
    }
  }

  return [...seen.values()];
}

export function buildContactMapData(content, { title, subtitle, sourceAdi = [] } = {}) {
  const qson = parseAdif(content);
  const contacts = qson.qsos
    .map((qso) => {
      const originGrid = qso.our?.grid;
      const origin = gridToLatLon(originGrid);
      if (!origin) {
        return null;
      }

      const destinationGrid = qso.their?.grid;
      const destinationState = qso.their?.state;
      const destinationDxccCode = dxccCodeForValue(qso.their?.dxccCode);
      const destinationCountry =
        destinationDxccCode === undefined ? undefined : String(destinationDxccCode);
      const destinationDxccEntity = dxccEntityForCode(destinationDxccCode);
      const destination =
        gridToLatLon(destinationGrid) ??
        stateToLatLon(destinationState, qso.their?.dxccCode) ??
        countryToLatLon(destinationCountry);
      if (!destination) {
        return null;
      }

      const contact = {
        timestamp: qso.startAt ?? qso.endAt,
        originGrid,
        origin,
        destination,
        band: qso.band || "other",
        source: destinationGrid
          ? "grid"
          : destinationState && String(qso.their?.dxccCode) === "291"
            ? "state"
            : "country",
      };

      if (destinationDxccCode !== undefined) {
        contact.destinationDxccCode = destinationDxccCode;
      }
      if (destinationDxccEntity) {
        contact.destinationDxccName = destinationDxccEntity.name;
        contact.destinationDxccFlag = destinationDxccEntity.flag;
      }

      if (destinationGrid) {
        contact.destinationGrid = destinationGrid;
      } else if (destinationState && String(qso.their?.dxccCode) === "291") {
        contact.destinationState = destinationState;
      } else if (destinationCountry) {
        contact.destinationCountry = destinationCountry;
      }

      return contact;
    })
    .filter(Boolean);

  if (contacts.length === 0) {
    throw new Error("No plottable contacts were found.");
  }

  const firstQso = qson.qsos.find((qso) => qso.our?.grid);
  const stationCallsign = firstQso?.our?.call || firstQso?.our?.operator || "N1RWJ";
  const originDxccCode = dxccCodeForValue(firstQso?.our?.dxccCode) ?? 291;
  const date = firstQso?.startAt?.slice(0, 10).replaceAll("-", "") ?? "";
  const dateLabel = formatDate(date);
  const dxccEntities = collectDxccEntities(contacts);

  return {
    title: title || "Contact map",
    subtitle: subtitle || `${stationCallsign} - ${contacts.length} QSOs - ${dateLabel}`,
    stationCallsign,
    date,
    dateLabel,
    originDxccCode,
    dxccEntities,
    sourceAdi,
    contacts,
  };
}

export function renderSvg({
  title,
  subtitle,
  contacts,
  stationCallsign,
  dateLabel,
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

  const bandCounts = collectBandCounts(contacts);
  const origins = uniqueOrigins(contacts);

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
      const originPoint = project(contact.origin);
      const destinationPoint = project(contact.destination);
      return `<line x1="${originPoint.x}" y1="${originPoint.y}" x2="${destinationPoint.x}" y2="${destinationPoint.y}" stroke="${bandColor(contact.band)}" stroke-opacity="0.28" stroke-width="1.6"/>`;
    })
    .join("");

  const contactPoints = contacts
    .map((contact) => {
      const p = project(contact.destination);
      return `<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${bandColor(contact.band)}" stroke="#172026" stroke-width="1.5"/>`;
    })
    .join("");

  const originPoints = origins
    .map(({ origin }) => {
      const p = project(origin);
      return `<circle cx="${p.x}" cy="${p.y}" r="8.5" fill="#172026" stroke="#fffdfa" stroke-width="3"/>`;
    })
    .join("");

  const legend = Object.entries(bandCounts)
    .map(([band, count], index) => {
      const x = 52 + index * 132;
      return `
        <circle cx="${x}" cy="103" r="7" fill="${bandColor(band)}" stroke="#172026" stroke-width="1.5"/>
        <text x="${x + 16}" y="109" fill="#5f6f79" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(band)} ${count}</text>
      `;
    })
    .join("");

  const footer = `Generated from ADI data · ${contacts.length} QSOs`;

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
  ${originPoints}
</svg>`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await fs.readFile(options.input, "utf8");
  const mapData = buildContactMapData(input, {
    title: options.title,
    subtitle: options.subtitle,
  });

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  if (options.output.endsWith(".json")) {
    await fs.writeFile(options.output, `${JSON.stringify(mapData, null, 2)}\n`, "utf8");
  } else {
    await fs.writeFile(
      options.output,
      renderSvg(mapData),
      "utf8",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    usage();
    process.exitCode = 1;
  });
}
