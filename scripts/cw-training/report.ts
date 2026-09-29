import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, lstatSync, realpathSync, renameSync, unlinkSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { REPORT_FIELDS, validateReportAnswers, buildPrefilledReportUrl } from "../../src/lib/cw-training/report-fields.ts";
import { prepareBackup, object } from "./report-backup.ts";
import type { PrepareOptions } from "./report-backup.ts";
import type { TrainingReport } from "../../src/lib/cw-training/report-types.ts";

export const HELP = `Prepare Bob Carter's report privately from a Companion data backup.

mise run cw-training:report -- [prepare] [--backup PATH] [--session N]
  [--date YYYY-MM-DD] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
mise run cw-training:report -- open --session N
mise run cw-training:report -- submitted --handoff UUID

Prepare defaults to the newest cw-academy-backup-*.json in iCloud Downloads
(or local Downloads), and the next class on or after today's local date.
Files stay in ignored data/private/cw-reports/. Edit config.json for identity
and answers-session-N.json for manual answers. Any key in that answers file,
including an empty string, overrides suggestions on every prepare.

Open freezes an exact handoff snapshot and opens a prefilled Google Form for
review. It never submits. After you submit that form yourself, confirm its
handoff UUID with 'submitted'. Prepared/opened drafts are never submitted history.
If you change answers in Google Forms, also update the private overrides and
prepare/open again so the snapshot matches what you actually submit.
`;

interface Draft extends TrainingReport {
  version: 1;
  backup: { filename: string; sha256: string; exportedAt: string };
  timezone: string;
  warnings: string[];
  validation: ReturnType<typeof validateReportAnswers>;
  sources: { attemptId: string; description: string }[];
  lcwoSources: { id: string; contributingIds: string[]; missingKeys: string[] }[];
}
interface Handoff { version: 1; id: string; openedAt: string; report: Draft }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const safeId = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new TypeError("Use the UUID printed by the open command.");
  return id;
};

/** Refuse symlinks and keep every generated private file owner-readable only. */
function privateDirectory(path: string) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new TypeError("Private storage cannot be a symlink.");
  if (!existsSync(path)) { privateDirectory(dirname(path)); mkdirSync(path, { mode: 0o700 }); }
  if (realpathSync(path) !== resolve(path)) throw new TypeError("Private storage cannot be inside a symlink.");
}
function writePrivate(path: string, value: unknown, exclusive = false) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new TypeError("Private files cannot be symlinks.");
  privateDirectory(dirname(path));
  const contents = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  if (exclusive) {
    writeFileSync(path, contents, { mode: 0o600, flag: "wx" });
    return;
  }
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, contents, { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function answers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Manual answers must be a JSON object.");
  const result = object(value), keys = new Set(REPORT_FIELDS.map(field => field.key));
  for (const [key, value] of Object.entries(result)) if (!keys.has(key) || typeof value !== "string") throw new TypeError(`Unknown or non-text answer: ${key}.`);
  const invalid = validateReportAnswers(result as Record<string, string>, { requireComplete: false });
  if (invalid.length) throw new TypeError(invalid.map(error => `${error.key}: ${error.message}`).join("\n"));
  return result as Record<string, string>;
}

export function latestBackup(home = homedir()): string {
  const folders = [join(home, "Library/Mobile Documents/com~apple~CloudDocs/Downloads"), join(home, "Downloads")];
  const matches = folders.flatMap(folder => existsSync(folder) ? readdirSync(folder)
    .filter(name => /^cw-academy-backup-.*\.json$/.test(name))
    .map(name => join(folder, name)).filter(path => statSync(path).isFile()) : []);
  matches.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || b.localeCompare(a));
  if (!matches[0]) throw new TypeError("No Companion backup found in Downloads. Pass --backup PATH.");
  return matches[0];
}

function summary(draft: Draft): string {
  const lines = [`Session ${draft.session}: ${draft.fromDate} through ${draft.toDate} (${draft.timezone})`,
    `Report date: ${draft.reportDate}`, "", "Edit answers-session-N.json to override any answer (blank strings stay blank).", ""];
  for (const field of REPORT_FIELDS) lines.push(`${field.key}: ${draft.answers[field.key] || "[blank]"}`);
  lines.push("", "Review warnings:", ...draft.warnings.map(warning => `- ${warning}`),
    ...draft.validation.map(error => `- ${error.key}: ${error.message}`), "", "Evidence:",
    ...draft.sources.map(source => `- ${source.attemptId}: ${source.description}`),
    ...draft.lcwoSources.map(source => `- LCWO ${source.id}: ${source.contributingIds.join(", ")}`), "");
  return lines.join("\n");
}

export function prepareReport(backupPath: string, directory: string, options: PrepareOptions = {}): Draft {
  privateDirectory(directory); chmodSync(directory, 0o700);
  const bytes = readFileSync(backupPath, "utf8"), value = JSON.parse(bytes);
  const submittedDirectory = join(directory, "submitted");
  const reports = existsSync(submittedDirectory) ? readdirSync(submittedDirectory).filter(name => name.endsWith(".json"))
    .map(name => object(json(join(submittedDirectory, name))).report as TrainingReport) : [];
  const configPath = join(directory, "config.json");
  const config = existsSync(configPath) ? object(json(configPath)) : {};
  for (const [key, value] of Object.entries(config)) if (!["callsign", "firstName"].includes(key) || typeof value !== "string") throw new TypeError("config.json accepts only callsign and firstName text values.");
  const result = prepareBackup(value, { ...options, callsign: options.callsign ?? config.callsign as string | undefined,
    firstName: options.firstName ?? config.firstName as string | undefined, reports });
  if (!existsSync(configPath)) writePrivate(configPath, { callsign: result.answers.callsign, firstName: result.answers.firstName }, true);
  const editsPath = join(directory, `answers-session-${result.session}.json`);
  if (!existsSync(editsPath)) {
    // Preserve only deliberate edits from a matching old draft, never arbitrary
    // stale answers or a different session's identity/report window.
    const legacy = result.data.legacy, snapshots = result.data.snapshot.reports;
    const candidates = [...(Array.isArray(snapshots) ? snapshots : []), ...Object.values(object(legacy.reportDrafts)), legacy.reportDraft]
      .map(object).filter(report => report.session === result.session && report.status === "draft")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const prior = candidates[0], overrides: Record<string, string> = {};
    const edited = prior?.editedAnswerKeys ?? object(legacy.reportEditsBySession)[String(result.session)]
      ?? (object(legacy.reportDraft).session === result.session ? legacy.reportEditedKeys : []);
    for (const key of Array.isArray(edited) ? edited : []) {
      if (!["session", "reportDate"].includes(key) && typeof object(prior?.answers)[key] === "string") overrides[key] = object(prior?.answers)[key] as string;
    }
    writePrivate(editsPath, answers(overrides), true);
  }
  const overrides = answers(json(editsPath));
  if (overrides.session !== undefined || overrides.reportDate !== undefined) throw new TypeError("Set session/report date using --session/--date, not manual answers.");
  const finalAnswers = { ...result.answers, ...overrides };
  const draft: Draft = { version: 1, id: randomUUID(), session: result.session, fromDate: result.fromDate, toDate: result.toDate,
    reportDate: result.reportDate, createdAt: new Date().toISOString(), status: "draft", answers: finalAnswers,
    editedAnswerKeys: Object.keys(overrides), sourceAttemptIds: result.sourceAttemptIds, sourceLcwoIds: result.sourceLcwoIds,
    timezone: result.timezone, warnings: result.warnings, validation: validateReportAnswers(finalAnswers),
    sources: result.sources, lcwoSources: result.lcwoSources.map(source => ({ id: source.run.id, contributingIds: source.runs.map(run => run.id), missingKeys: source.missingKeys })),
    backup: { filename: resolve(backupPath), sha256: hash(bytes), exportedAt: String(object(value).exportedAt ?? "") } };
  // No raw backup/curriculum, full note, scratchpad, or received-text copies are
  // written here. Sources identify the private backup that supplied each metric.
  writePrivate(join(directory, `draft-session-${draft.session}.json`), draft);
  writePrivate(join(directory, `review-session-${draft.session}.txt`), summary(draft));
  return draft;
}

export function createHandoff(directory: string, session: number): Handoff {
  const report = json(join(directory, `draft-session-${session}.json`)) as Draft;
  if (report.version !== 1 || report.session !== session || report.status !== "draft") throw new TypeError("Prepare this session first.");
  const errors = validateReportAnswers(answers(report.answers));
  if (errors.length) throw new TypeError(errors.map(error => `${error.key}: ${error.message}`).join("\n"));
  // A draft must be regenerated after changing overrides or private identity.
  const overrides = answers(json(join(directory, `answers-session-${session}.json`)));
  const config = object(json(join(directory, "config.json")));
  if (Object.keys(overrides).sort().join() !== [...report.editedAnswerKeys ?? []].sort().join()
    || Object.entries(overrides).some(([key, value]) => report.answers[key] !== value)
    || ["callsign", "firstName"].some(key => !Object.hasOwn(overrides, key) && report.answers[key] !== config[key])) throw new TypeError("Private answers changed. Run prepare again before opening the form.");
  const handoff: Handoff = { version: 1, id: randomUUID(), openedAt: new Date().toISOString(), report };
  writePrivate(join(directory, "handoffs", `${handoff.id}.json`), handoff, true);
  writePrivate(join(directory, "handoffs", `${handoff.id}.url`), `${buildPrefilledReportUrl(report.answers)}\n`, true);
  return handoff;
}

export function recordSubmission(directory: string, id: string): Handoff {
  const path = join(directory, "submitted", `${safeId(id)}.json`);
  if (existsSync(path)) return json(path) as Handoff;
  const handoff = json(join(directory, "handoffs", `${safeId(id)}.json`)) as Handoff;
  if (handoff.version !== 1 || handoff.id !== id || handoff.report.status !== "draft") throw new TypeError("Invalid handoff snapshot.");
  const errors = validateReportAnswers(answers(handoff.report.answers));
  if (errors.length) throw new TypeError("The handoff contains incomplete answers.");
  const submitted: Handoff = { ...handoff, report: { ...handoff.report, status: "submitted", submittedAt: new Date().toISOString() } };
  writePrivate(path, submitted, true);
  return submitted;
}

export function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    backup: { type: "string" }, session: { type: "string" }, date: { type: "string" }, from: { type: "string" }, to: { type: "string" },
    handoff: { type: "string" }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) { console.log(HELP); return; }
  if (positionals.length > 1) throw new TypeError("Expected prepare, open, or submitted.");
  const command = positionals[0] ?? "prepare";
  const directory = resolve("data/private/cw-reports");
  const session = values.session === undefined ? undefined : Number(values.session);
  if (session !== undefined && (!Number.isSafeInteger(session) || session < 1)) throw new TypeError("Choose a positive --session number.");
  if (command === "prepare") {
    if (values.handoff) throw new TypeError("--handoff belongs to the submitted command.");
    const draft = prepareReport(values.backup ?? latestBackup(), directory, { session, reportDate: values.date, fromDate: values.from, toDate: values.to });
    console.log(`Prepared session ${draft.session} (${draft.fromDate} through ${draft.toDate}).`);
    console.log(`Review: data/private/cw-reports/review-session-${draft.session}.txt`);
    console.log(`Manual answers: data/private/cw-reports/answers-session-${draft.session}.json`);
    console.log(`Warnings: ${draft.warnings.length}; answers needing attention: ${draft.validation.map(error => error.key).join(", ") || "none"}.`);
    console.log(`After edits, run prepare again, then: mise run cw-training:report -- open --session ${draft.session}`);
  } else if (command === "open") {
    if (!session || values.backup || values.date || values.from || values.to || values.handoff) throw new TypeError("Open requires only --session N.");
    const handoff = createHandoff(directory, session);
    console.log(`Handoff: ${handoff.id}. Opening the form for review; nothing has been submitted.`);
    console.log(`After you submit: mise run cw-training:report -- submitted --handoff ${handoff.id}`);
    const url = buildPrefilledReportUrl(handoff.report.answers);
    const child = spawnSync(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore" });
    if (child.error || child.status !== 0) throw new Error(`Browser could not open. The private URL is saved in data/private/cw-reports/handoffs/${handoff.id}.url`);
  } else if (command === "submitted") {
    if (!values.handoff || session || values.backup || values.date || values.from || values.to) throw new TypeError("Submitted requires only --handoff UUID after you have submitted the form.");
    const submitted = recordSubmission(directory, values.handoff);
    console.log(`Recorded your confirmation for session ${submitted.report.session}. The exact handoff snapshot is saved privately.`);
  } else throw new TypeError("Expected prepare, open, or submitted. Use --help for instructions.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : "Report preparation failed."); process.exitCode = 1; }
}
