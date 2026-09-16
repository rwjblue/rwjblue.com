#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "parse5";

export const BKG_SOURCE_URL = "https://www.bkg.club/";
const OUTPUT_URL = new URL("../../public/radio/resources/calls-of-note/bkg.txt", import.meta.url);
const METADATA_URL = new URL("../../src/data/calls-of-note/bkg.json", import.meta.url);

function attr(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

function hasClass(node, name) {
  return (attr(node, "class") ?? "").split(/\s+/).includes(name);
}

function descendants(node, predicate) {
  const found = [];
  for (const child of node.childNodes ?? []) {
    if (predicate(child)) found.push(child);
    found.push(...descendants(child, predicate));
  }
  return found;
}

function nodeText(node) {
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(nodeText).join("");
}

function normalizedText(node) {
  return nodeText(node).replace(/\s+/g, " ").trim();
}

function requiredField(card, className) {
  const fields = descendants(card, (node) => hasClass(node, className));
  if (fields.length !== 1 || !normalizedText(fields[0])) {
    throw new Error(`BKG member card must have exactly one nonempty ${className}.`);
  }
  return normalizedText(fields[0]);
}

export function parseBkgRoster(html) {
  const document = parse(html);
  const rosters = descendants(document, (node) => attr(node, "id") === "roster");
  if (rosters.length !== 1) throw new Error("BKG page must contain exactly one roster section.");

  const cards = descendants(rosters[0], (node) => hasClass(node, "member-card"));
  const calls = new Map();
  const numbers = new Map();

  for (const card of cards) {
    if (hasClass(card, "ghost")) continue;
    const call = requiredField(card, "member-callsign").toUpperCase();
    if (!/^[A-Z0-9/]+$/.test(call) || !/[A-Z]/.test(call) || !/[0-9]/.test(call)) {
      throw new Error(`Invalid BKG callsign: ${call}`);
    }
    const numberText = requiredField(card, "member-number");
    const numberMatch = /^BKG #(\d+)$/.exec(numberText);
    if (!numberMatch || Number(numberMatch[1]) < 1) {
      throw new Error(`Invalid BKG member number for ${call}: ${numberText}`);
    }
    const number = numberMatch[1];
    const badges = descendants(card, (node) => hasClass(node, "state-og-badge") || hasClass(node, "og-badge"))
      .map((node) => (attr(node, "title") || normalizedText(node)).replace(/\s+/g, " ").trim());
    for (const badge of badges) {
      if (!/^(?:[A-Za-z][A-Za-z .'-]* )?OG$/.test(badge)) {
        throw new Error(`Invalid BKG OG badge for ${call}: ${badge}`);
      }
    }
    const note = [numberText, ...new Set(badges)].join(" | ");
    const member = { call, number, note };
    const existing = calls.get(call);
    if (existing && (existing.number !== number || existing.note !== note)) {
      throw new Error(`Conflicting BKG entries for ${call}.`);
    }
    if (numbers.has(Number(number)) && numbers.get(Number(number)) !== call) {
      throw new Error(`BKG number ${number} is assigned to multiple callsigns.`);
    }
    calls.set(call, member);
    numbers.set(Number(number), call);
  }

  if (!calls.size) throw new Error("BKG roster has no members.");
  const advertisedCount = /<!--\s*MEMBER_COUNT:START\s*-->\s*(\d+)\s*<!--\s*MEMBER_COUNT:END\s*-->/.exec(html);
  if (advertisedCount && Number(advertisedCount[1]) !== calls.size) {
    throw new Error(`BKG page advertises ${advertisedCount[1]} members but parsed ${calls.size}.`);
  }
  return [...calls.values()].sort((a, b) => a.call.localeCompare(b.call, "en"));
}

export function assertBkgRosterSize(count, previousCount) {
  if (!Number.isInteger(count) || count < 100) {
    throw new Error(`BKG roster has only ${count} members; refusing to replace the published file.`);
  }
  if (!Number.isInteger(previousCount) || previousCount < 0) {
    throw new Error("Previous BKG member count is invalid.");
  }
  if (previousCount && count < previousCount * 0.8) {
    throw new Error(`BKG roster shrank from ${previousCount} to ${count}; review the source before replacing the published file.`);
  }
}

export function buildBkgFiles(members, retrievedAt) {
  const metadata = {
    sourceUrl: BKG_SOURCE_URL,
    sourcePageUrl: BKG_SOURCE_URL,
    retrievedAt,
    memberCount: members.length,
    callsignCount: members.length,
    samples: ["N1RWJ", "W1VES", "N8JMS"].map((call) => members.find((member) => member.call === call)).filter(Boolean),
  };
  const text = [
    "# TITLE: BKG members",
    `# Source: ${BKG_SOURCE_URL}`,
    `# Retrieved: ${retrievedAt}`,
    `# ${members.length} members; OG labels are included only where shown by the club.`,
    "",
    ...members.map(({ call, note }) => `${call} ${note}`),
    "",
  ].join("\n");
  return { text, metadata };
}

export async function updateBkg({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(BKG_SOURCE_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`BKG roster request failed: HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("BKG roster response is not HTML.");
  }
  const html = await response.text();
  if (html.length > 10_000_000) throw new Error("BKG roster response is unexpectedly large.");
  const members = parseBkgRoster(html);
  let previousCount = 0;
  try {
    previousCount = JSON.parse(await readFile(METADATA_URL, "utf8")).memberCount;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  assertBkgRosterSize(members.length, previousCount);
  const { text, metadata } = buildBkgFiles(members, new Date().toISOString());
  // Parse and validate the complete response before replacing either checked-in file.
  for (const [url, contents] of [
    [OUTPUT_URL, text],
    [METADATA_URL, `${JSON.stringify(metadata, null, 2)}\n`],
  ]) {
    const path = fileURLToPath(url);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, contents, "utf8");
    await rename(`${path}.tmp`, path);
  }
  console.log(`Updated BKG Calls of Note: ${members.length} members.`);
  return metadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 2) throw new Error("Usage: update-bkg.mjs");
    await updateBkg();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
