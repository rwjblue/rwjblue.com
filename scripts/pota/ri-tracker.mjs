#!/usr/bin/env -S node --experimental-strip-types

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildTrackerData,
  mergeProfileActivations,
} from "../../src/lib/pota/ri-tracker.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, "data/pota/ri/cache");
const activationCacheDir = path.join(cacheDir, "activations");
const parksCachePath = path.join(cacheDir, "parks-US-RI.json");
const profileCachePath = path.join(cacheDir, "profile-N1RWJ.json");
const ledgerPath = path.join(root, "data/pota/ri/activations.json");
const trackerDataPath = path.join(root, "src/data/pota/ri-tracker.json");

async function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  await writeFile(`${tmpPath}`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmpPath, filePath);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "rwjblue.com POTA RI tracker",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return response.json();
}

async function updateParks() {
  const parks = await fetchJson("https://api.pota.app/location/parks/US-RI");
  await writeJson(parksCachePath, parks);
  console.log(`Wrote ${parks.length} parks to ${relative(parksCachePath)}`);
}

async function updateProfile() {
  const profile = await fetchJson("https://api.pota.app/profile/N1RWJ");
  await writeJson(profileCachePath, profile);

  const ledger = await readJson(ledgerPath, { activations: [] });
  const mergedLedger = mergeProfileActivations(ledger, profile);
  await writeJson(ledgerPath, mergedLedger);

  console.log(`Wrote profile cache to ${relative(profileCachePath)}`);
  console.log(`Merged ${mergedLedger.activations.length} ledger activations`);
}

async function backfillActivations() {
  const parks = await readJson(parksCachePath);

  if (!parks) {
    throw new Error("Run pota:ri:update-parks before backfilling activations");
  }

  const profile = await readJson(profileCachePath);

  if (!profile) {
    throw new Error("Run pota:ri:update-profile before backfilling activations");
  }

  const callsigns = new Set([
    profile.callsign.toUpperCase(),
    ...(profile.other_callsigns ?? []).map((callsign) => callsign.toUpperCase()),
  ]);
  const ledger = await readJson(ledgerPath, { activations: [] });
  const failures = [];

  for (const park of parks) {
    const reference = park.reference.toUpperCase();
    const cachePath = path.join(activationCacheDir, `${reference}.json`);

    try {
      const activations = existsSync(cachePath)
        ? await readJson(cachePath)
        : await fetchJson(
            `https://api.pota.app/park/activations/${reference}?count=all`,
          );

      if (!existsSync(cachePath)) {
        await writeJson(cachePath, activations);
      }

      for (const activation of activations) {
        const callsign = activation.activeCallsign?.toUpperCase();

        if (!callsign || !callsigns.has(callsign)) {
          continue;
        }

        ledger.activations.push({
          reference,
          park: park.name,
          date: formatPotaDate(activation.qso_date),
          callsign,
          qsos: {
            total: activation.totalQSOs,
            cw: activation.qsosCW,
            data: activation.qsosDATA,
            phone: activation.qsosPHONE,
          },
          source: "backfill",
        });
      }
    } catch (error) {
      failures.push(`${reference}: ${error.message}`);
    }
  }

  await writeJson(ledgerPath, dedupeLedger(ledger));

  if (failures.length > 0) {
    console.error("Backfill completed with failures:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
  }

  console.log(`Wrote activation ledger to ${relative(ledgerPath)}`);
}

async function buildTracker() {
  const parks = await readJson(parksCachePath);

  if (!parks || parks.length === 0) {
    throw new Error("Run pota:ri:update-parks before building tracker data");
  }

  const profile = await readJson(profileCachePath, {
    callsign: "N1RWJ",
    other_callsigns: ["KC1YDM", "KB9SMK"],
    recent_activity: { activations: [] },
  });
  const ledger = await readJson(ledgerPath, { activations: [] });
  const notes = await readNotes();
  const trackerData = buildTrackerData({
    parks,
    ledger,
    profile,
    notes,
    generatedAt: new Date().toISOString(),
  });

  await writeJson(trackerDataPath, trackerData);
  console.log(`Wrote tracker data to ${relative(trackerDataPath)}`);
}

async function updateTracker() {
  await updateParks();
  await updateProfile();
  await buildTracker();
}

async function readNotes() {
  const notesDir = path.join(root, "src/content/notes");

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

function formatPotaDate(value) {
  const stringValue = String(value);

  return `${stringValue.slice(0, 4)}-${stringValue.slice(4, 6)}-${stringValue.slice(6, 8)}`;
}

function dedupeLedger(ledger) {
  const activations = [];
  const seen = new Set();

  for (const activation of ledger.activations) {
    const key = [
      activation.reference.toUpperCase(),
      activation.date,
      activation.callsign.toUpperCase(),
    ].join(":");

    if (!seen.has(key)) {
      activations.push({
        ...activation,
        reference: activation.reference.toUpperCase(),
        callsign: activation.callsign.toUpperCase(),
      });
      seen.add(key);
    }
  }

  return { activations };
}

function relative(filePath) {
  return path.relative(root, filePath);
}

const command = process.argv[2];

switch (command) {
  case "update-parks":
    await updateParks();
    break;
  case "update-profile":
    await updateProfile();
    break;
  case "backfill-activations":
    await backfillActivations();
    break;
  case "build-tracker-data":
    await buildTracker();
    break;
  case "update-tracker":
    await updateTracker();
    break;
  default:
    console.error(
      "Usage: ri-tracker.mjs <update-parks|update-profile|backfill-activations|build-tracker-data|update-tracker>",
    );
    process.exitCode = 1;
}
