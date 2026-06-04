#!/usr/bin/env -S node --experimental-strip-types

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPotaParkPages,
  collectKnownReferences,
  normalizeReference,
} from "../../src/lib/pota/parks.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parkCacheDir = path.join(root, "data/pota/parks/cache");
const parksDataPath = path.join(root, "src/data/pota/parks.json");
const riParksCachePath = path.join(root, "data/pota/ri/cache/parks-US-RI.json");
const riActivationLedgerPath = path.join(root, "data/pota/ri/activations.json");
const riTrackerPath = path.join(root, "src/data/pota/ri-tracker.json");
const notesDir = path.join(root, "src/content/notes");
const roveCacheDir = path.join(root, "data/pota/rove-to-fl/cache");

async function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmpPath, filePath);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA park cache",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return response.json();
}

async function readNotes() {
  if (!existsSync(notesDir)) {
    return [];
  }

  const files = await readdir(notesDir);
  const notes = [];

  for (const file of files.filter((entry) => entry.endsWith(".md"))) {
    const markdown = await readFile(path.join(notesDir, file), "utf8");
    const frontmatter = markdown.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/);

    if (!frontmatter?.groups?.frontmatter) {
      continue;
    }

    notes.push({
      id: file.replace(/\.md$/, ""),
      title: readFrontmatterScalar(frontmatter.groups.frontmatter, "title"),
      date: readFrontmatterScalar(frontmatter.groups.frontmatter, "date"),
      tags: readFrontmatterList(frontmatter.groups.frontmatter, "tags"),
    });
  }

  return notes;
}

function readFrontmatterScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));

  return match?.[1]?.replace(/^["']|["']$/g, "") ?? "";
}

function readFrontmatterList(frontmatter, key) {
  const match = frontmatter.match(
    new RegExp(`^${key}:\\n(?<items>(?:\\s+-\\s+.+\\n?)+)`, "m"),
  );

  if (!match?.groups?.items) {
    return [];
  }

  return match.groups.items
    .split("\n")
    .map((line) => line.trim().replace(/^- /, ""))
    .filter(Boolean);
}

async function readLedgerActivations() {
  const ledger = await readJson(riActivationLedgerPath, { activations: [] });

  return ledger.activations ?? [];
}

async function readRiReferences() {
  const parks = await readJson(riParksCachePath, []);

  return parks.map((park) => normalizeReference(park.reference));
}

async function readKnownReferences() {
  const notes = await readNotes();
  const activations = await readLedgerActivations();
  const projectReferences = await readRiReferences();

  return collectKnownReferences({ notes, activations, projectReferences });
}

async function readCachedParks() {
  const parksByReference = new Map();

  for (const park of await readJson(riParksCachePath, [])) {
    parksByReference.set(normalizeReference(park.reference), normalizePark(park));
  }

  if (existsSync(roveCacheDir)) {
    for (const file of (await readdir(roveCacheDir)).filter((entry) =>
      entry.endsWith(".json"),
    )) {
      for (const park of await readJson(path.join(roveCacheDir, file), [])) {
        parksByReference.set(normalizeReference(park.reference), normalizePark(park));
      }
    }
  }

  if (existsSync(parkCacheDir)) {
    for (const file of (await readdir(parkCacheDir)).filter((entry) =>
      entry.endsWith(".json"),
    )) {
      const park = await readJson(path.join(parkCacheDir, file));
      parksByReference.set(normalizeReference(park.reference), normalizePark(park));
    }
  }

  return parksByReference;
}

async function ensurePark(reference) {
  const normalizedReference = normalizeReference(reference);
  const cachePath = path.join(parkCacheDir, `${normalizedReference}.json`);
  const cachedParks = await readCachedParks();
  const cachedPark = cachedParks.get(normalizedReference);

  if (cachedPark) {
    await writeJson(cachePath, cachedPark);
    return cachedPark;
  }

  const fetchedPark = await fetchPark(normalizedReference);
  await writeJson(cachePath, fetchedPark);
  return fetchedPark;
}

async function fetchPark(reference) {
  const candidates = [
    `https://api.pota.app/park/${reference}`,
    `https://api.pota.app/parks/${reference}`,
  ];
  const failures = [];

  for (const url of candidates) {
    try {
      const response = await fetchJson(url);
      return normalizePark(Array.isArray(response) ? response[0] : response);
    } catch (error) {
      failures.push(error.message);
    }
  }

  throw new Error(`Unable to fetch ${reference}: ${failures.join("; ")}`);
}

function normalizePark(park) {
  if (!park?.reference) {
    throw new Error("POTA park response is missing a reference");
  }

  return {
    reference: normalizeReference(park.reference),
    name: park.name,
    latitude: Number(park.latitude),
    longitude: Number(park.longitude),
    grid: park.grid,
    locationDesc: park.locationDesc ?? park.location ?? "",
    attempts: numberOrUndefined(park.attempts),
    activations: numberOrUndefined(park.activations),
    qsos: numberOrUndefined(park.qsos),
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return Number(value);
}

async function backfillKnown() {
  const references = await readKnownReferences();

  for (const reference of references) {
    const park = await ensurePark(reference);
    console.log(`Ensured ${park.reference} ${park.name}`);
  }
}

async function buildPageData() {
  const references = await readKnownReferences();
  const cachedParks = await readCachedParks();
  const missing = references.filter((reference) => !cachedParks.has(reference));

  if (missing.length > 0) {
    throw new Error(
      `Missing park cache for ${missing.join(", ")}. Run pota:park:backfill-known.`,
    );
  }

  const riTracker = await readJson(riTrackerPath, {
    references: [],
    generatedAt: new Date().toISOString(),
  });
  const notes = await readNotes();
  const activations = await readLedgerActivations();
  const parks = references.map((reference) => cachedParks.get(reference));
  const trackerReferences = riTracker.references.map((reference) =>
    normalizeReference(reference.reference),
  );

  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [
      {
        id: "2026-ri-pota",
        label: "2026 RI POTA Challenge",
        href: "/projects/2026-activate-all-ri-pota/",
        references: trackerReferences,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        minimumQsos: 10,
      },
    ],
    generatedAt: new Date().toISOString(),
  });

  await writeJson(parksDataPath, data);
  console.log(`Wrote park page data to ${relative(parksDataPath)}`);
}

function relative(filePath) {
  return path.relative(root, filePath);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "ensure":
    if (args.length === 0) {
      throw new Error("Usage: parks.mjs ensure US-1234 [US-5678...]");
    }

    for (const reference of args) {
      const park = await ensurePark(reference);
      console.log(`Ensured ${park.reference} ${park.name}`);
    }
    break;
  case "build-page-data":
    await buildPageData();
    break;
  case "backfill-known":
    await backfillKnown();
    await buildPageData();
    break;
  default:
    console.error(
      "Usage: parks.mjs <ensure|build-page-data|backfill-known> [references...]",
    );
    process.exitCode = 1;
}
