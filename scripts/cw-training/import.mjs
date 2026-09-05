import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse } from "parse5";

export const CURRICULUM_URL = "https://cwa.cwops.org/wp-content/uploads/Practice-Instructions-Intermediate-ver.2.2.htm";
export const FILE_INDEX_URL = "https://cwops.org/intermediate-practice-files/";
export const SCALES_URL = "https://cwops.org/wp-content/uploads/2024/08/Everyday-Send-Code-Web.htm";
const execFileAsync = promisify(execFile);
const DAY_MS = 86_400_000;

/** Word-exported pages declare Windows-1252; response.text() would corrupt them. */
export function decodeHtml(bytes, contentType = "") {
  const preview = new TextDecoder("windows-1252").decode(bytes).slice(0, 2048);
  const encoding = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1]
    ?? /charset\s*=\s*["']?([\w-]+)/i.exec(preview)?.[1]
    ?? "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}

function textOf(node) {
  if (node.nodeName === "#text") return node.value.replace(/[\r\n\t]/g, " ");
  if (node.tagName === "br") return "\n";
  if (["script", "style", "noscript"].includes(node.tagName)) return "";
  return (node.childNodes ?? []).map(textOf).join("");
}

function cleanText(text) {
  return text.split("\n").map((line) => line.replace(/[\s\u00a0]+/g, " ").trim()).filter(Boolean).join("\n");
}

export function documentBlocks(html) {
  const blocks = [];
  function visit(node) {
    if (["script", "style", "noscript"].includes(node.tagName)) return;
    if (/^(p|h[1-6]|li)$/.test(node.tagName)) {
      const text = cleanText(textOf(node));
      if (text) blocks.push(text);
    } else {
      (node.childNodes ?? []).forEach(visit);
    }
  }
  visit(parse(html));
  return blocks;
}

export function documentLinks(html, baseUrl) {
  const links = [];
  function visit(node) {
    if (node.tagName === "a") {
      const href = node.attrs.find((attribute) => attribute.name === "href")?.value;
      if (href) {
        const url = new URL(href, baseUrl);
        if (["https:", "http:"].includes(url.protocol)) {
          links.push({ title: cleanText(textOf(node)), url: url.href });
        }
      }
    }
    (node.childNodes ?? []).forEach(visit);
  }
  visit(parse(html));
  return links;
}

export function audioKey(value) {
  return decodeURIComponent(value).toUpperCase().replace(/\.MP3(?:\?.*)?$/, "").replace(/[^A-Z0-9]/g, "");
}

export function indexAudioResources(html, baseUrl = FILE_INDEX_URL) {
  const indexed = new Map();
  for (const link of documentLinks(html, baseUrl)) {
    const filename = new URL(link.url).pathname.split("/").at(-1);
    if (!/\.mp3$/i.test(filename)) continue;
    const key = audioKey(filename);
    if (!indexed.has(key)) indexed.set(key, link.url);
  }
  return indexed;
}

export function splitAssignments(html) {
  // The Word export sometimes puts the next phase heading after a line break
  // inside the final paragraph of the previous day's exercise.
  const blocks = documentBlocks(html).flatMap((block) => block.split(/\n(?=Objectives? (?:for|of) Sessions?\b)/i));
  const beginning = blocks.findIndex((text) => text === "Introduction");
  const assignmentsAt = blocks.findIndex((text, index) => index > beginning && text === "Assignments");
  if (beginning < 0 || assignmentsAt < 0) throw new Error("Curriculum introduction or assignments heading is missing.");
  const assignments = [];
  const objectives = [];
  let session;
  let assignment;
  let objective = "";
  for (const text of blocks.slice(assignmentsAt + 1)) {
    if (/^Appendix A:/i.test(text)) break;
    const sessionMatch = /^Session\s+(\d+)\s*[.:]?$/i.exec(text);
    const dayMatch = /^Day\s+(one|two|three)\s*:$/i.exec(text);
    if (/^Objectives? (?:for|of) Sessions?/i.test(text)) {
      objective = text;
      objectives.push(text);
    } else if (sessionMatch) {
      session = Number(sessionMatch[1]);
      assignment = undefined;
    } else if (dayMatch) {
      if (!session) throw new Error("Day found without its session.");
      assignment = { session, day: ["one", "two", "three"].indexOf(dayMatch[1].toLowerCase()) + 1, objective, paragraphs: [] };
      assignments.push(assignment);
    } else if (assignment && !/^~+$/.test(text)) {
      assignment.paragraphs.push(text);
    }
  }
  const version = blocks.find((text) => /^Version\s+\d/i.test(text));
  if (!version) throw new Error("Curriculum version is missing.");
  return { version, instructions: [...blocks.slice(beginning, assignmentsAt), ...objectives].join("\n\n"), assignments };
}

export function splitScales(html) {
  const blocks = documentBlocks(html);
  const sections = new Map();
  let current = "introduction";
  sections.set(current, []);
  for (const block of blocks) {
    if (/^(Warm Up|Exercise|Drill)$/i.test(block)) {
      current = block.toLowerCase().replaceAll(" ", "-");
      sections.set(current, [block]);
    } else {
      sections.get(current).push(block);
    }
  }
  for (const section of ["warm-up", "exercise", "drill"]) {
    if (!sections.get(section)?.length) throw new Error(`Scales section ${section} is missing.`);
  }
  return sections;
}

/** Resolve local civil time through Intl instead of baking an EDT offset into dates. */
export function zonedDateTime(date, time, timezone) {
  const target = new Date(`${date}T${time}:00Z`).getTime();
  let result = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(({ type, value }) => [type, value]));
    const localAsUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`).getTime();
    const adjustment = target - localAsUtc;
    result += adjustment;
    if (adjustment === 0) return new Date(result).toISOString();
  }
  throw new Error(`Cannot resolve ${date} ${time} in ${timezone}.`);
}

export function courseMeetings({ firstClassDate = "2026-09-07", timezone = "America/New_York", classTime = "15:30", count = 16 } = {}) {
  const first = new Date(`${firstClassDate}T12:00:00Z`);
  if (first.getUTCDay() !== 1) throw new Error("This course schedule starts on a Monday.");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getTime() + (Math.floor(index / 2) * 7 + (index % 2) * 3) * DAY_MS).toISOString().slice(0, 10);
    const startsAt = zonedDateTime(date, classTime, timezone);
    return { session: index + 1, startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString() };
  });
}

function repetitionTarget(instructions) {
  if (/at least two times/i.test(instructions)) return { minimumPasses: 2 };
  if (/at least three times/i.test(instructions)) return { minimumPasses: 3 };
  if (/once or twice/i.test(instructions)) return { minimumPasses: 1, maximumPasses: 2 };
  if (/listen to it once/i.test(instructions)) return { minimumPasses: 1, maximumPasses: 1 };
  return {};
}

export function importCourse({ curriculumHtml, indexHtml, scalesHtml, sourceUrl = CURRICULUM_URL, indexUrl = FILE_INDEX_URL, scalesUrl = SCALES_URL, verifiedAt = new Date().toISOString(), firstClassDate = "2026-09-07", expectedSessions = 16 }) {
  const extracted = splitAssignments(curriculumHtml);
  const audio = indexAudioResources(indexHtml, indexUrl);
  const scales = splitScales(scalesHtml);
  const timezone = "America/New_York";
  const meetings = courseMeetings({ firstClassDate, timezone, count: expectedSessions });
  const resources = new Map();
  const links = documentLinks(curriculumHtml, sourceUrl);
  for (const link of links.filter((link) => !link.url.startsWith(sourceUrl) && !/\.mp3$/i.test(link.url))) {
    if ([...resources.values()].some((resource) => resource.url === link.url)) continue;
    const id = `guide-${resources.size + 1}`;
    resources.set(id, { id, title: link.title, url: link.url, format: "link" });
  }
  const runnerResource = [...resources.values()].find((resource) => /Morse Runner/i.test(resource.title));
  const icrResource = [...resources.values()].find((resource) => /MCW.*ICR/i.test(resource.title));
  const assignments = extracted.assignments.map((source) => {
    const id = `s${source.session}-d${source.day}`;
    const meeting = meetings.find((meeting) => meeting.session === source.session);
    if (!meeting) throw new Error(`Unexpected session ${source.session}.`);
    const meetingDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(meeting.startsAt));
    const date = new Date(new Date(`${meetingDate}T12:00:00Z`).getTime() - (3 - source.day) * DAY_MS).toISOString().slice(0, 10);
    const tasks = [];
    for (let index = 0; index < source.paragraphs.length; index++) {
      let instructions = source.paragraphs[index];
      let task;
      if (/^Complete the sending/i.test(instructions)) {
        const selected = ["warm-up", ...(/Drill/i.test(instructions) ? ["drill"] : []), ...(/Exercise/i.test(instructions) ? ["exercise"] : [])];
        const resourceId = `scales-${selected.join("-")}`;
        resources.set(resourceId, { id: resourceId, title: `Sending: ${selected.join(" + ").replaceAll("warm-up", "warm up")}`, url: scalesUrl, format: "text", text: [scales.get("introduction").join("\n"), ...selected.map((section) => scales.get(section).join("\n"))].join("\n\n") });
        task = { kind: "sending", title: resources.get(resourceId).title, resourceId };
      } else if (/^(Copy |Short Story |CWT practice )/i.test(instructions)) {
        const reference = /\b([A-Z]+)\s*(\d+)\s*[-–—_]\s*(\d+)\b/i.exec(instructions);
        if (!reference) throw new Error(`Unrecognized audio reference in ${id}.`);
        const [, prefix, number, speed] = reference;
        const title = `${prefix.toUpperCase()}${number}-${speed}`;
        const key = audioKey(title);
        const resourceId = `audio-${key.toLowerCase()}`;
        const url = audio.get(key);
        const variants = [...audio.entries()].filter(([candidate]) => candidate.startsWith(`${prefix.toUpperCase()}${number}`)).map(([, url]) => url);
        const unresolved = url ? undefined : `The curriculum requests ${title}, but that recording is not linked in the official file index.${variants.length ? ` Available variant: ${variants.join(", ")}.` : ""} Ask the advisor which file to use.`;
        resources.set(resourceId, { id: resourceId, title, url: url ?? indexUrl, format: "audio", ...(unresolved ? { unresolved } : {}) });
        task = { kind: "audio", title, resourceId, speedWpm: Number(speed), ...repetitionTarget(instructions) };
      } else if (/^(Using )?Morse Runner[:;]/i.test(instructions)) {
        if (/^Note:/i.test(source.paragraphs[index + 1] ?? "")) instructions += `\n${source.paragraphs[++index]}`;
        const speed = /speed (?:at |of )?(\d+)/i.exec(instructions)?.[1];
        const baseline = /same settings as Session 1/i.test(instructions)
          ? "Single-call mode; all condition boxes unchecked. " : "";
        task = { kind: "simulator", title: /WPX/i.test(instructions) ? "Morse Runner: WPX" : "Morse Runner: single calls", minutes: 15, speedWpm: speed ? Number(speed) : undefined, settings: baseline + instructions, ...(runnerResource ? { resourceId: runnerResource.id } : {}) };
      } else if (/^Using LCWO/i.test(instructions)) {
        task = { kind: "icr", title: "Instant character recognition", speedWpm: Number(/speed at (\d+)/i.exec(instructions)?.[1]), settings: instructions, ...(icrResource ? { resourceId: icrResource.id } : {}) };
      } else if (/^CWT, any sessions/i.test(instructions)) {
        const next = source.paragraphs[index + 1];
        if (!next || !/^(Monitor|Try to work)/i.test(next)) throw new Error(`Missing live objective in ${id}.`);
        instructions += `\n${source.paragraphs[++index]}`;
        task = { kind: "live", title: /work 5 QSOs/i.test(instructions) ? "CWT: five QSOs or exchange copy" : "CWT: copy five stations", objectiveCount: 5, ...(/or at least/i.test(instructions) ? { alternative: next.slice(next.indexOf("or ") + 3) } : {}) };
      } else if (/^Practice other/i.test(instructions)) {
        task = { kind: "review", title: "Optional harder-file review", optional: true };
      } else if (!/^(Hearing Sounds|Getting Better with Harder Files)/i.test(instructions)) {
        throw new Error(`Unclassified curriculum paragraph in ${id}; review the source before importing.`);
      }
      if (task) tasks.push({ id: `${id}-t${tasks.length + 1}`, ...task, instructions, sourceUrl });
    }
    if (!tasks.length) throw new Error(`No tasks found for ${id}.`);
    return { id, session: source.session, day: source.day, date, dueAt: meeting.startsAt, instructions: [source.objective, ...source.paragraphs].filter(Boolean).join("\n\n"), sourceUrl, tasks };
  });
  const ids = new Set(assignments.map((assignment) => assignment.id));
  if (assignments.length !== expectedSessions * 3 || ids.size !== expectedSessions * 3) throw new Error(`Expected ${expectedSessions * 3} unique daily assignments; found ${assignments.length}.`);
  for (let session = 1; session <= expectedSessions; session++) {
    for (let day = 1; day <= 3; day++) if (!ids.has(`s${session}-d${day}`)) throw new Error(`Missing session ${session}, day ${day}.`);
  }
  return { id: "cwa-intermediate-2026-09", title: "CW Academy Intermediate", version: extracted.version, sourceUrl, verifiedAt, timezone, dailyGoalMinutes: 60, instructions: extracted.instructions, meetings, assignments, resources: [...resources.values()] };
}

export function courseSqlStatements(course) {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const payload = JSON.stringify(course);
  if (Buffer.byteLength(payload) > 1_900_000) throw new Error("Course payload exceeds the safe D1 row size.");
  const importId = createHash("sha256").update(payload).digest("hex");
  const chunks = [];
  let chunk = "";
  // Iterate by code point so supplementary Unicode never crosses chunk boundaries.
  for (const character of payload) {
    chunk += character;
    if (chunk.length >= 8_000) { chunks.push(chunk); chunk = ""; }
  }
  if (chunk) chunks.push(chunk);
  const scope = `course_id = ${quote(course.id)} AND import_id = ${quote(importId)}`;
  return [
    `CREATE TABLE IF NOT EXISTS training_course_import_chunks (course_id TEXT NOT NULL, import_id TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (course_id, import_id, position));`,
    `DELETE FROM training_course_import_chunks WHERE ${scope};`,
    ...chunks.map((part, position) => `INSERT INTO training_course_import_chunks (course_id, import_id, position, payload) VALUES (${quote(course.id)}, ${quote(importId)}, ${position}, ${quote(part)});`),
    // Readers see the previous full course until this one atomic publication.
    // Missing chunks fail NOT NULL rather than publishing an incomplete snapshot.
    `INSERT INTO training_courses (id, payload) VALUES (${quote(course.id)}, CASE WHEN (SELECT COUNT(*) FROM training_course_import_chunks WHERE ${scope}) = ${chunks.length} THEN (SELECT group_concat(payload, '') FROM (SELECT payload FROM training_course_import_chunks WHERE ${scope} ORDER BY position)) ELSE NULL END) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload;`,
    `DELETE FROM training_course_import_chunks WHERE ${scope};`,
  ];
}

export function courseSql(course) {
  return courseSqlStatements(course).join("\n") + "\n";
}

async function fetchHtml(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Source request failed: ${response.status} ${url}`);
  return decodeHtml(await response.arrayBuffer(), response.headers.get("content-type") ?? "");
}

export async function probeDurations(course) {
  const resources = course.resources.filter((resource) => resource.format === "audio" && !resource.unresolved);
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < resources.length) {
      const resource = resources[index++];
      try {
        const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", resource.url], { timeout: 20_000, maxBuffer: 128 * 1024 });
        const duration = Number(stdout.trim());
        if (Number.isFinite(duration) && duration > 0) resource.durationSeconds = Math.round(duration * 1000) / 1000;
      } catch {
        // Unknown stays unknown. Playback metadata can measure it later.
      }
    }
  }));
  return course;
}

function privateOutputPath(filename) {
  const root = path.resolve(".tmp");
  const output = path.resolve(filename);
  if (!output.startsWith(`${root}${path.sep}`)) throw new Error("Private curriculum output must be inside the ignored .tmp directory.");
  return output;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a path.`);
    return privateOutputPath(value);
  };
  const output = option("--output");
  const sql = option("--sql");
  if (!output && !sql) throw new Error("Supply --output .tmp/course.json and/or --sql .tmp/course.sql. Add --probe-audio to measure recordings.");
  const [curriculumHtml, indexHtml, scalesHtml] = await Promise.all([fetchHtml(CURRICULUM_URL), fetchHtml(FILE_INDEX_URL), fetchHtml(SCALES_URL)]);
  const course = importCourse({ curriculumHtml, indexHtml, scalesHtml });
  if (args.includes("--probe-audio")) await probeDurations(course);
  if (output) { await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(course, null, 2) + "\n", { mode: 0o600 }); }
  if (sql) { await mkdir(path.dirname(sql), { recursive: true }); await writeFile(sql, courseSql(course), { mode: 0o600 }); }
  console.log(JSON.stringify({ assignments: course.assignments.length, tasks: course.assignments.reduce((sum, assignment) => sum + assignment.tasks.length, 0), resources: course.resources.length, measuredAudio: course.resources.filter((resource) => resource.durationSeconds).length, unresolved: course.resources.filter((resource) => resource.unresolved).map((resource) => resource.title), output, sql }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
