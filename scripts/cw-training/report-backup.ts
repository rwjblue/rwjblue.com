import { buildReportDraft, reportWindowForSession } from "../../src/lib/cw-training/report.ts";
import { dateInTimezone } from "../../src/lib/cw-training/plan.ts";
import { isReportDate } from "../../src/lib/cw-training/report-fields.ts";
import type { TrainingAttempt, TrainingCourse, TrainingTask } from "../../src/lib/cw-training/types.ts";
import type { TrainingLcwoResult, TrainingReport } from "../../src/lib/cw-training/report-types.ts";
import type { LcwoRun } from "../../src/lib/cw-training/lcwo-types.ts";

// Only the evidence needed for Bob's report is interpreted here. This task has
// no runtime dependency on the Companion checkout or its authenticated API.
type ObjectValue = Record<string, unknown>;
export const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as ObjectValue : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const normalize = (value: string) => value.toUpperCase().replace(/\s+/gu, " ").trim();
const timestamp = (value: unknown): string | undefined => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;
const rounding = (value: number) => Math.round(value * 10) / 10;

/** Calendar dates in the export are authoritative, including edited dates. */
function onDate(value: string | undefined, date: string, timezone: string): string {
  if (value && dateInTimezone(value, timezone) === date) return value;
  // Noon is safely away from midnight/DST changes. Preserve a timestamp only
  // when it still belongs to the explicitly saved practice date.
  let instant = new Date(`${date}T12:00:00Z`).getTime();
  for (let i = 0; i < 3; i++) {
    const local = dateInTimezone(new Date(instant).toISOString(), timezone);
    instant += (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${local}T12:00:00Z`));
  }
  return new Date(instant).toISOString();
}

function distance(expected: string, answer: string): number {
  const sent = [...normalize(expected)], received = [...normalize(answer)];
  let previous = received.map((_, index) => index + 1); previous.unshift(0);
  for (let i = 1; i <= sent.length; i++) {
    const row = [i];
    for (let j = 1; j <= received.length; j++) row[j] = Math.min(previous[j] + 1, row[j - 1] + 1,
      previous[j - 1] + Number(sent[i - 1] !== received[j - 1]));
    previous = row;
  }
  return previous[received.length];
}

export interface CopyMeasurement { result: TrainingLcwoResult; match?: string; warnings: string[] }
export function copyMeasurement(value: unknown): CopyMeasurement | undefined {
  const copy = object(value), recipe = object(copy.recipe), trials = array(copy.trials).map(object);
  const targets = array(copy.targets);
  if (copy.version !== 1 || !["native-copy-v1", "native-copy-v2"].includes(string(copy.scoringVersion))) {
    if (Object.keys(copy).length) throw new TypeError("Unsupported native copy evidence version.");
    return;
  }
  if (copy.status === "active" || !trials.length || recipe.mode === "plaintext" || recipe.groupKind === "mixed" && recipe.mode === "groups") return;
  if (!["completed", "abandoned"].includes(string(copy.status)) || trials.length > targets.length
    || !targets.every(target => typeof target === "string" && target.length <= 4000)
    || trials.some(trial => typeof trial.answer !== "string" || trial.answer.length > 4000
      || number(trial.effectiveWpm) === undefined || !trial.effectiveWpm
      || number(trial.characterWpm) === undefined || typeof trial.correct !== "boolean" || number(trial.points) === undefined)) {
    throw new TypeError("Invalid native copy evidence.");
  }
  const warnings: string[] = [];
  if (copy.status !== "completed") warnings.push("Native copy result is partial; only submitted trials are reported.");
  if (number(copy.revealCount)) warnings.push("Native copy answers were revealed; review this result.");
  if (recipe.mode === "groups") {
    if (!["letters", "figures", "custom"].includes(string(recipe.groupKind)) || trials.length !== 1 || targets.length !== 1) throw new TypeError("Invalid group copy evidence.");
    const sent = normalize(targets[0] as string), answer = normalize(string(trials[0].answer));
    const denominator = [...sent.replace(/ /g, "")].length;
    let edits = distance(sent, answer);
    if (copy.scoringVersion === "native-copy-v2") {
      const groups = sent.split(" "), received = answer ? answer.split(" ") : [];
      let grouped = 0;
      for (let i = 0; i < Math.max(groups.length, received.length); i++) grouped += distance(groups[i] ?? "", received[i] ?? "");
      edits = Math.min(edits, grouped);
    }
    const errorPercent = denominator ? Math.min(100, Math.floor(1000 * edits / denominator) / 10) : edits ? 100 : 0;
    if (number(recipe.groupLength) === undefined) warnings.push("Random group length needs a manual report answer.");
    return { result: { kind: recipe.groupKind as TrainingLcwoResult["kind"], speedWpm: trials[0].effectiveWpm as number,
      groupLength: number(recipe.groupLength), errorPercent },
      match: JSON.stringify([recipe.groupKind, recipe.groupLength, recipe.groupKind === "custom" ? recipe.customCharacters : "",
        trials[0].characterWpm, trials[0].effectiveWpm]), warnings };
  }
  if (!["words", "callsigns"].includes(string(recipe.mode))) return;
  // Recompute discrete points from actual submitted speeds and targets, never
  // from the UI's next adaptive speed, or a sum across separate attempts.
  let points = 0, highest = 0, errors = 0;
  for (const [index, trial] of trials.entries()) {
    const correct = normalize(targets[index] as string) === normalize(string(trial.answer)).replace(/ /g, "");
    const speed = trial.effectiveWpm as number;
    if (correct) {
      const cap = number(recipe.maxSpeed);
      if (recipe.adaptive && !cap) throw new TypeError("Missing adaptive speed cap.");
      points += (recipe.adaptive ? Math.min(cap!, speed + 1) : speed) * (targets[index] as string).length;
      highest = Math.max(highest, speed);
    } else errors++;
  }
  const kind = recipe.mode === "callsigns" ? "callsign" : "words";
  if (!highest) warnings.push("No correctly copied native trial; copied speed needs a manual answer.");
  return { result: { kind, speedWpm: highest || undefined, score: points, errorCount: errors,
    ...(kind === "words" ? { maximumLength: number(recipe.maxWordLength) } : {}) }, warnings };
}

export function readBackup(value: unknown) {
  const backup = object(value);
  if (backup.format !== "cwa-training-tracker" || backup.version !== 1 || !Array.isArray(backup.sessions)
    || backup.evidenceVersion !== undefined && backup.evidenceVersion !== 1) throw new TypeError("Expected a supported CW Academy Companion data backup (version 1).");
  const sessions = backup.sessions.map(object);
  const ids = new Set<string>();
  for (const entry of sessions) {
    if (!string(entry.id) || ids.has(string(entry.id)) || !isReportDate(string(entry.date)) || number(entry.minutes) === undefined) {
      throw new TypeError("Backup contains an invalid or duplicate practice entry.");
    }
    ids.add(string(entry.id));
  }
  const profile = object(backup.profile), legacy = object(object(backup.legacy).data), snapshot = object(legacy.snapshot);
  const timezone = string(profile.timezone) || string(object(snapshot.course).timezone);
  new Intl.DateTimeFormat("en-US", { timeZone: timezone || "invalid" }).format();
  return { backup, sessions, profile, legacy, snapshot, timezone };
}

export interface PrepareOptions { session?: number; reportDate?: string; fromDate?: string; toDate?: string; callsign?: string; firstName?: string; reports?: TrainingReport[] }
export function prepareBackup(value: unknown, options: PrepareOptions = {}) {
  const data = readBackup(structuredClone(value));
  const { sessions, profile, snapshot, timezone } = data;
  const reportDate = options.reportDate ?? dateInTimezone(new Date().toISOString(), timezone);
  if (!isReportDate(reportDate)) throw new TypeError("Use a valid report date.");
  const archived = object(snapshot.course);
  // Archived curriculum stays in the private backup. Without it use only the
  // profile's calendar, with an explicit range available for other schedules.
  const meetings = array(archived.meetings) as TrainingCourse["meetings"];
  if (!meetings.length && isReportDate(string(profile.firstClassDate)) && array(profile.classDays).length) {
    if (!array(profile.classDays).every(day => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)) throw new TypeError("Invalid class weekdays.");
    const day = new Date(`${profile.firstClassDate}T12:00:00Z`);
    while (meetings.length < 16 && day.getUTCFullYear() < 2100) {
      if (array(profile.classDays).includes(day.getUTCDay())) {
        const startsAt = onDate(undefined, day.toISOString().slice(0, 10), timezone);
        meetings.push({ session: meetings.length + 1, startsAt, endsAt: startsAt });
      }
      day.setUTCDate(day.getUTCDate() + 1);
    }
  }
  const session = options.session ?? (meetings.find(meeting => dateInTimezone(meeting.startsAt, timezone) >= reportDate) ?? meetings.at(-1))?.session;
  if (!Number.isSafeInteger(session) || !session || session < 1) throw new TypeError("Choose a positive --session number.");
  const course: TrainingCourse = { id: string(archived.id) || "private-report", title: "Private report", version: "1", sourceUrl: "", verifiedAt: "",
    timezone, dailyGoalMinutes: 0, instructions: "", meetings,
    assignments: array(archived.assignments) as TrainingCourse["assignments"], resources: [] };
  const defaults = reportWindowForSession(course, session, reportDate);
  if (!course.assignments.length) {
    const previous = meetings.find(meeting => meeting.session === session - 1);
    if (previous) { const day = new Date(`${dateInTimezone(previous.startsAt, timezone)}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); defaults.fromDate = day.toISOString().slice(0, 10); }
  }
  const fromDate = options.fromDate ?? defaults.fromDate, toDate = options.toDate ?? defaults.toDate;
  if (!isReportDate(fromDate) || !isReportDate(toDate) || fromDate > toDate) throw new TypeError("Choose a valid ordered --from/--to date range.");
  const reports = array(snapshot.reports) as TrainingReport[];
  const lastIdentity = [...reports].reverse().find(report => report.answers?.callsign || report.answers?.firstName)?.answers;
  const warnings = new Set<string>();
  const nativeGroups = new Map<string, { match: string; result: TrainingLcwoResult }>();
  const lcwoRuns: LcwoRun[] = [];
  const attempts: TrainingAttempt[] = [];
  const knownTasks = new Set(course.assignments.flatMap(assignment => assignment.tasks.map(task => task.id)));
  for (const entry of sessions) {
    const date = string(entry.date);
    // Filter before interpreting evidence: unrelated old or class records must
    // not contribute warnings, metadata, or form answers to this report.
    if (date < fromDate || date > toDate || entry.context === "class") continue;
    const metadata = object(entry.metadata), old = object(metadata.legacyAttempt);
    if (Object.keys(object(metadata.legacyLcwoRun)).length) {
      const run = metadata.legacyLcwoRun as LcwoRun;
      lcwoRuns.push({ ...run, recordedAt: onDate(timestamp(run.recordedAt), date, timezone) }); continue;
    }
    const oldTask = object(metadata.legacyTask);
    let taskId = string(old.taskId) || string(metadata.plannedTaskId).replace(/^legacy-task:/, "") || `private:${entry.id}`;
    if (Object.keys(oldTask).length && !knownTasks.has(taskId)) {
      course.assignments.push({ id: `private:${entry.id}`, session, date, day: 1, dueAt: "", instructions: "", sourceUrl: "", tasks: [{ ...oldTask, id: taskId } as unknown as TrainingTask] }); knownTasks.add(taskId);
    }
    if (!knownTasks.has(taskId) && entry.kind === "sending") {
      // Explicit practice titles identify scales; difficulty/notes never become ratings.
      const title = string(array(data.backup.plan).map(object).find(task => task.id === metadata.plannedTaskId)?.title);
      if (/\bscales?\b/i.test(title)) {
        course.assignments.push({ id: `private:${entry.id}`, session, date, day: 1, dueAt: "", instructions: "", sourceUrl: "", tasks: [{ id: taskId, kind: "sending", title, instructions: "", sourceUrl: "" }] }); knownTasks.add(taskId);
      }
    }
    const attempt: TrainingAttempt = { ...old as unknown as TrainingAttempt, id: string(entry.id), taskId, assignmentId: string(old.assignmentId),
      startedAt: onDate(timestamp(old.startedAt) ?? timestamp(object(metadata.copyAttempt).createdAt) ?? timestamp(entry.createdAt), date, timezone),
      endedAt: onDate(timestamp(old.endedAt) ?? timestamp(object(metadata.copyAttempt).updatedAt) ?? timestamp(entry.createdAt), date, timezone),
      activeSeconds: (number(entry.minutes) ?? 0) * 60, completed: old.completed === true,
      context: "practice", scratchpad: string(metadata.scratchpad) || string(old.scratchpad),
      note: string(old.note), qsoCount: number(entry.qsoCount) ?? number(old.qsoCount) };
    if (attempt.runnerResult?.runStartedAt) attempt.runnerResult = { ...attempt.runnerResult, runStartedAt: onDate(timestamp(attempt.runnerResult.runStartedAt), date, timezone) };
    const evidence = object(metadata.evidence);
    if (Object.keys(evidence).length && (evidence.version !== 1 || !["timed", "runner"].includes(string(evidence.type)))) throw new TypeError("Unsupported practice evidence version.");
    if (evidence.type === "timed") {
      attempt.recallSeconds = number(object(evidence.measurement).recallSeconds);
      attempt.audioResults = array(evidence.recordings).map(object).flatMap(recording => {
        const seconds = number(recording.seconds), url = string(recording.url);
        if (!seconds || !/^https?:\/\//.test(url)) return [];
        return [{ url, title: decodeURIComponent(new URL(url).pathname.split("/").at(-1) ?? ""),
          speedWpm: number(recording.effectiveWpm) ?? number(recording.speedWpm), activeSeconds: seconds,
          completedPasses: array(object(recording.passes).durations).map(object).reduce((sum, pass) => sum + (number(pass.completedPasses) ?? 0), 0) }];
      });
    } else if (evidence.type === "runner") {
      const run = object(evidence.run), settings = object(run.settings), summary = object(run.summary);
      if (!["SingleCall", "WPX"].includes(string(settings.mode)) || !["completed", "stopped", "error"].includes(string(run.status))
        || !number(settings.wpm) || number(run.elapsedSeconds) === undefined || number(settings.durationSeconds) === undefined) throw new TypeError("Invalid Runner evidence.");
      const speeds = array(run.speedHistory).map(object).map(change => number(change.wpm)).filter((speed): speed is number => speed !== undefined && speed > 0);
      attempt.runnerResult = { version: 1, source: "embedded", mode: settings.mode as "SingleCall" | "WPX", wpm: settings.wpm as number,
        durationSeconds: settings.durationSeconds as number, elapsedSeconds: run.elapsedSeconds as number,
        status: run.status as "completed" | "stopped" | "error", verifiedPoints: number(summary.verifiedPoints), qsoCount: number(summary.qsoCount),
        score: number(summary.score), speeds, conditions: Object.values(object(settings.conditions)).some(flag => flag === true),
        runStartedAt: onDate(timestamp(run.runStartedAt), date, timezone), runEndedAt: onDate(timestamp(run.runEndedAt), date, timezone) };
      attempt.startedAt = attempt.runnerResult.runStartedAt!; attempt.endedAt = attempt.runnerResult.runEndedAt!;
    }
    if (metadata.copyAttempt !== undefined) {
      const measurement = copyMeasurement(metadata.copyAttempt);
      if (measurement) {
        attempt.lcwoResult = measurement.result;
        measurement.warnings.forEach(warning => warnings.add(`${entry.id}: ${warning}`));
        if (measurement.match) nativeGroups.set(attempt.id, { match: measurement.match, result: measurement.result });
      }
    }
    attempts.push(attempt);
  }
  const draft = buildReportDraft(course, attempts, { session, fromDate, toDate, reportDate,
    callsign: options.callsign ?? (string(profile.callsign) || lastIdentity?.callsign || ""),
    firstName: options.firstName ?? lastIdentity?.firstName ?? string(profile.displayName).split(" ")[0],
    reports: [...reports, ...options.reports ?? []], lcwoRuns });
  // Match the old group-history rule, now including native attempts with exact
  // known lengths/settings; no synthetic three-character assumption is needed.
  for (const source of [...draft.sourceAttemptIds]) {
    const group = nativeGroups.get(source);
    if (!group) continue;
    const matching = [...nativeGroups].filter(([, candidate]) => candidate.match === group.match);
    draft.answers[`${group.result.kind}ErrorPercent`] = String(rounding(matching.reduce((sum, [, candidate]) => sum + candidate.result.errorPercent!, 0) / matching.length));
    for (const [id] of matching) if (!draft.sourceAttemptIds.includes(id)) { draft.sourceAttemptIds.push(id); draft.sources.push({ attemptId: id, description: `Matching native ${group.result.kind} group errors` }); }
  }
  for (const source of draft.sources) if (nativeGroups.has(source.attemptId) || sessions.some(entry => entry.id === source.attemptId && object(entry.metadata).copyAttempt !== undefined)) {
    source.description = source.description.replace(/Latest (\w+) LCWO result/, "Latest native $1 copy result");
  }
  for (const source of draft.lcwoSources) if (source.missingKeys.length) warnings.add(`Imported ${source.run.kind} result needs: ${source.missingKeys.join(", ")}.`);
  return { ...draft, warnings: [...draft.warnings, ...warnings], session, fromDate, toDate, reportDate, timezone, data };
}
