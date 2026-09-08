import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse } from "parse5";

export const AUDIO_INDEX_URL = "https://cwops.org/intermediate-practice-files/";
const outputPath = "src/data/cw-training/audio-variants.json";
const cachePath = ".tmp/cw-training-audio-duration-cache.json";
const execFileAsync = promisify(execFile);
const families = new Map([
  ["Intermediate Short Word Files", "short-word"],
  ["Intermediate Short Phrase Files", "short-phrase"],
  ["Intermediate Short QSO Files", "short-qso"],
  ["Intermediate Short POTA Files", "short-pota"],
  ["Intermediate Suffix Files", "suffix"],
  ["Intermediate Prefix Files", "prefix"],
]);
const nodeText = (node) => node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(nodeText).join("");

/** Section identity is essential: short and long QSO filenames can collide. */
export function indexAudioVariants(html) {
  const groups = new Map();
  let family;
  function visit(node) {
    if (node.tagName === "h2") family = families.get(nodeText(node).replace(/\s+/g, " ").trim());
    if (family && node.tagName === "a") {
      const href = node.attrs.find((attribute) => attribute.name === "href")?.value;
      if (href) {
        let url;
        try { url = new URL(href, AUDIO_INDEX_URL); } catch { return; }
        if (url.protocol !== "https:" || !["cwops.org", "cwa.cwops.org"].includes(url.hostname) || url.username || url.password || url.search || url.hash) return;
        const name = decodeURIComponent(url.pathname.split("/").at(-1));
        const match = /^([a-z]+)[_-]?(\d+)[_-](10|13|15|18|20|25)\.mp3$/i.exec(name);
        if (match) {
          const exercise = `${match[1].toUpperCase()}${match[2]}`;
          const speedWpm = Number(match[3]);
          const id = `${family}-${exercise.toLowerCase()}`;
          const group = groups.get(id) ?? { id, variants: [] };
          const duplicate = group.variants.find((variant) => variant.speedWpm === speedWpm);
          if (duplicate && duplicate.url !== url.href) throw new Error(`Conflicting official links for ${id} at ${speedWpm} WPM.`);
          if (!duplicate) group.variants.push({ id: `cw-audio-${id}-${speedWpm}`, title: `${exercise}-${speedWpm}`, url: url.href, format: "audio", speedWpm });
          groups.set(id, group);
        }
      }
    }
    (node.childNodes ?? []).forEach(visit);
  }
  visit(parse(html));
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)).map((group) => ({ ...group, variants: group.variants.sort((a, b) => a.speedWpm - b.speedWpm) }));
}

async function readJson(filename, fallback) {
  try { return JSON.parse(await readFile(filename, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

async function main(args) {
  if (args.some((arg) => arg !== "--refresh")) throw new Error("Usage: node scripts/cw-training/audio-variants.mjs [--refresh]");
  const response = await fetch(AUDIO_INDEX_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Official index returned HTTP ${response.status}.`);
  const groups = indexAudioVariants(await response.text());
  if (!groups.length) throw new Error("No supported official audio groups found; leaving the catalog unchanged.");
  const cached = args.includes("--refresh") ? {} : await readJson(cachePath, {});
  const previous = await readJson(outputPath, { groups: [] });
  if (!args.includes("--refresh")) {
    for (const group of previous.groups) for (const variant of group.variants) {
      if (Number.isFinite(variant.durationSeconds) && variant.durationSeconds > 0) cached[variant.url] ??= variant.durationSeconds;
    }
  }
  await mkdir(path.dirname(cachePath), { recursive: true });
  const variants = groups.flatMap((group) => group.variants);
  let index = 0;
  let measured = 0;
  let failed = 0;
  let writes = Promise.resolve();
  const checkpoint = () => {
    const payload = JSON.stringify(cached, null, 2) + "\n";
    writes = writes.then(() => writeFile(cachePath, payload));
    return writes;
  };
  console.log(`Checking ${variants.length} official recordings in ${groups.length} exact exercise groups (4 concurrent probes).`);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < variants.length) {
      const variant = variants[index++];
      const saved = cached[variant.url];
      if (Number.isFinite(saved) && saved > 0) variant.durationSeconds = saved;
      else {
        try {
          const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", variant.url], { timeout: 20_000, maxBuffer: 128 * 1024 });
          const duration = Number(stdout.trim());
          if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid audio duration.");
          variant.durationSeconds = Math.round(duration * 1000) / 1000;
          cached[variant.url] = variant.durationSeconds;
        } catch {
          failed++;
          console.warn(`Unavailable audio omitted: ${variant.url}`);
        }
      }
      measured++;
      if (measured % 40 === 0) {
        console.log(`${measured}/${variants.length} checked; ${failed} duration probes unavailable.`);
        await checkpoint();
      }
    }
  }));
  await checkpoint();
  // Failed files are not advertised as alternatives. Never invent a duration
  // from a WPM ratio or substitute another file for a missing assignment.
  const verifiedGroups = groups.map((group) => ({ ...group, variants: group.variants.filter((variant) => variant.durationSeconds) })).filter((group) => group.variants.length);
  const catalog = { sourceUrl: AUDIO_INDEX_URL, verifiedAt: new Date().toISOString().slice(0, 10), groups: verifiedGroups };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(catalog, null, 2) + "\n");
  console.log(JSON.stringify({ groups: verifiedGroups.length, recordings: variants.filter((variant) => variant.durationSeconds).length, omitted: failed, output: outputPath }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
