import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const sourcePageUrl = "https://cwops.org/membership/member-roster-2/";
export const sourceUrl = "https://docs.google.com/spreadsheets/d/1Ew8b1WAorFRCixGRsr031atxmS0SsycvmOczS_fDqzc/export?format=csv";
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const notesPath = join(projectRoot, "public/radio/resources/calls-of-note/cwops.txt");
const metadataPath = join(projectRoot, "src/data/calls-of-note/cwops.json");
const requiredHeaders = ["Paid Thru", "Callsign", "Number", "First or Nick Name"];
const normalized = (value) => value.trim().replace(/\s+/gu, " ");

/** CSV with quoted commas, doubled quotes, and newlines inside quoted fields. */
export function parseCsv(source) {
  const text = source.replace(/^\uFEFF/u, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
    } else if (character === "," || character === "\r" || character === "\n") {
      row.push(field);
      field = "";
      closedQuote = false;
      if (character !== ",") {
        rows.push(row);
        row = [];
        if (character === "\r" && text[index + 1] === "\n") index++;
      }
    } else if (closedQuote) {
      throw new Error("Invalid CSV: unexpected text after a closing quote.");
    } else if (character === '"') {
      if (field !== "") throw new Error("Invalid CSV: quote inside an unquoted field.");
      quoted = true;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Invalid CSV: unterminated quoted field.");
  if (field !== "" || row.length > 0 || closedQuote) rows.push([...row, field]);
  return rows;
}

export function parseRoster(csv) {
  const rows = parseCsv(csv);
  const headerMatches = rows.flatMap((row, index) => {
    const headers = row.map(normalized);
    return requiredHeaders.every((header) => headers.includes(header)) ? [{ headers, index }] : [];
  });
  if (headerMatches.length !== 1) {
    throw new Error("Unexpected CWops roster layout: expected one membership header row.");
  }
  const { headers, index: headerIndex } = headerMatches[0];
  for (const header of requiredHeaders) {
    if (headers.filter((value) => value === header).length !== 1) {
      throw new Error(`Unexpected CWops roster layout: duplicate ${header} header.`);
    }
  }
  const columns = Object.fromEntries(requiredHeaders.map((header) => [header, headers.indexOf(header)]));
  const calls = new Map();
  const silentKeys = new Set();
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every((value) => value.trim() === "")) continue;
    if (row.length !== headers.length) {
      throw new Error(`Unexpected CWops roster layout: row ${index + 1} has ${row.length} columns, expected ${headers.length}.`);
    }
    const call = normalized(row[columns.Callsign]).toUpperCase();
    const number = normalized(row[columns.Number]);
    const name = normalized(row[columns["First or Nick Name"]]);
    const status = normalized(row[columns["Paid Thru"]]).toUpperCase();
    if (!/^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/u.test(call) || !/[A-Z]/u.test(call) || !/\d/u.test(call)) {
      throw new Error(`Invalid callsign in CWops roster row ${index + 1}: ${call}`);
    }
    if (!/^[1-9]\d*$/u.test(number) || !Number.isSafeInteger(Number(number)) || !name || /[\u0000-\u001f\u007f]/u.test(name)) {
      throw new Error(`Invalid membership number or name in CWops roster row ${index + 1}.`);
    }
    // "SK" in the unrelated W/VE column denotes Saskatchewan, not a silent key.
    if (["SK", "S.K.", "SILENT KEY"].includes(status)) {
      silentKeys.add(number);
      continue;
    }
    if (!/^(?:LIFE|CLUB|20\d{2})$/u.test(status)) {
      throw new Error(`Unknown membership status in CWops roster row ${index + 1}: ${status}`);
    }
    const member = { call, name, number, note: `${name} | CWops #${number}` };
    const previous = calls.get(call);
    if (previous && (previous.number !== number || previous.name !== name)) {
      throw new Error(`Conflicting CWops entries for ${call}; refusing to choose a member.`);
    }
    calls.set(call, member);
  }
  // An explicit silent-key flag also excludes other calls for that member.
  const entries = [...calls.values()].filter((member) => !silentKeys.has(member.number))
    .sort((a, b) => a.call < b.call ? -1 : a.call > b.call ? 1 : 0);
  if (!entries.length) throw new Error("CWops roster contains no current callsigns.");
  return {
    entries,
    memberCount: new Set(entries.map((member) => member.number)).size,
    callsignCount: entries.length,
    excludedSilentKeys: silentKeys.size,
  };
}

export function createOutputs(roster, retrievedAt) {
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error("Invalid retrieval timestamp.");
  const { entries, memberCount, callsignCount, excludedSilentKeys } = roster;
  const samples = ["K3LR", "W1KM", "CO8ZZ"].map((call) => entries.find((entry) => entry.call === call)).filter(Boolean);
  const metadata = {
    sourceUrl, sourcePageUrl, retrievedAt, memberCount, callsignCount, excludedSilentKeys,
    samples: samples.length ? samples : entries.slice(0, 3),
  };
  const notes = [
    "# CWops members - callsign notes for Ham2K PoLo",
    `# Source: ${sourcePageUrl}`,
    `# Roster CSV: ${sourceUrl}`,
    `# Retrieved: ${retrievedAt}`,
    `# ${memberCount} membership numbers; ${callsignCount} callsigns (including listed alternate calls).`,
    "# Display: first or nick name | CWops #membership number",
    ...entries.map(({ call, note }) => `${call} ${note}`),
    "",
  ].join("\n");
  return { metadata, notes };
}

export function assertRefreshSafe(next, previous) {
  if (next.memberCount < 1000) {
    throw new Error("CWops roster has fewer than 1,000 members; refusing to publish a possibly incomplete download.");
  }
  for (const field of ["memberCount", "callsignCount"]) {
    if (previous?.[field] && next[field] < previous[field] * 0.9) {
      throw new Error(`CWops ${field} fell by more than 10%; inspect the source before updating the saved snapshot.`);
    }
  }
}

export async function downloadRoster(fetcher = fetch) {
  const response = await fetcher(sourceUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`CWops roster download failed: HTTP ${response.status}.`);
  const csv = await response.text();
  if (Buffer.byteLength(csv) > 2_000_000) throw new Error("Unexpectedly large CWops roster download.");
  return parseRoster(csv);
}

export async function main(args = process.argv.slice(2)) {
  if (args.length) throw new Error("Usage: node scripts/calls-of-note/update-cwops.mjs");
  const roster = await downloadRoster();
  let previous;
  try {
    previous = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  assertRefreshSafe(roster, previous);
  const { metadata, notes } = createOutputs(roster, new Date().toISOString());
  // Validate the complete download before replacing either checked-in output.
  await mkdir(dirname(notesPath), { recursive: true });
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(notesPath, notes);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`CWops: ${metadata.memberCount} members, ${metadata.callsignCount} callsigns; updated cwops.txt and cwops.json.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
