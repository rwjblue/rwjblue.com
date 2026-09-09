import { audioVariants } from "./audio-variants.ts";
import { dateInTimezone } from "./plan.ts";
import { isReportDate, REPORT_FIELDS } from "./report-fields.ts";
import type { TrainingAttempt, TrainingCourse, TrainingTask } from "./types.ts";
import type { PerformanceRating, TrainingAudioResult, TrainingReport, TrainingRunnerResult } from "./report-types.ts";

export type AudioReportCategory = "shortWords" | "shortPhrases" | "shortQso" | "shortPota" | "prefix" | "suffix";
export interface ReportWindow { fromDate: string; toDate: string }
export interface ReportDraftOptions extends ReportWindow {
  session: number;
  reportDate: string;
  callsign?: string;
  firstName?: string;
  reports?: readonly TrainingReport[];
}
export interface ReportDraft {
  answers: Record<string, string>;
  sourceAttemptIds: string[];
  sources: { attemptId: string; description: string }[];
  warnings: string[];
  runner?: { attemptId: string; result: TrainingRunnerResult };
}

/** Session preparation dates supply the default; an earlier report ends today. */
export function reportWindowForSession(course: TrainingCourse, session: number, reportDate?: string): ReportWindow {
  const dates = course.assignments.filter(assignment => assignment.session === session)
    .map(assignment => assignment.date).filter(isReportDate).sort();
  const meeting = course.meetings.find(item => item.session === session);
  const end = dates.at(-1) ?? (meeting ? dateInTimezone(meeting.startsAt, course.timezone) : reportDate);
  if (!end || !isReportDate(end) || (reportDate !== undefined && !isReportDate(reportDate))) {
    throw new TypeError("Choose a session and a valid report date.");
  }
  const fallback = new Date(`${end}T00:00:00.000Z`);
  fallback.setUTCDate(fallback.getUTCDate() - 2);
  const fromDate = dates[0] ?? fallback.toISOString().slice(0, 10);
  const toDate = reportDate && reportDate < end ? reportDate : end;
  return { fromDate, toDate: toDate < fromDate ? fromDate : toDate };
}

function reportStart(attempt: TrainingAttempt): string {
  return attempt.runnerResult?.runStartedAt ?? attempt.startedAt;
}

/** Include extra practice, use course-local dates, and deduplicate before filtering. */
export function reportAttemptsInWindow(
  attempts: readonly TrainingAttempt[], window: ReportWindow, timezone: string,
): TrainingAttempt[] {
  if (!isReportDate(window.fromDate) || !isReportDate(window.toDate) || window.fromDate > window.toDate) return [];
  return [...new Map(attempts.map(attempt => [attempt.id, attempt])).values()].filter(attempt => {
    if (attempt.context !== "practice") return false;
    try {
      const date = dateInTimezone(reportStart(attempt), timezone);
      return date >= window.fromDate && date <= window.toDate;
    } catch { return false; }
  }).sort((a, b) => reportStart(a).localeCompare(reportStart(b)) || a.endedAt.localeCompare(b.endedAt) || a.id.localeCompare(b.id));
}

/** Read only the generated run summary, never free-form score prose. */
export function legacyRunnerResult(attempt: TrainingAttempt): TrainingRunnerResult | undefined {
  const line = attempt.note?.split("\n").find(value => value.startsWith("Web Morse Runner: "));
  if (!line) return undefined;
  const elapsed = /^Web Morse Runner: (completed|stopped \(partial\)); (\d+) seconds;/.exec(line);
  const speed = /; (\d+) WPM(?: starting speed)?;/.exec(line);
  const points = /; Verified Pts (\d+)(?=;|\.)/.exec(line);
  const mode = /; (Single Call|WPX Contest);/.exec(line);
  if (!elapsed || !speed || !points || !mode) return undefined;
  const duration = /; run duration (\d+) seconds;/.exec(line);
  const changes = /; speed changes: ([^;]+)/.exec(line)?.[1] ?? "";
  const used = /; WPM used: ([\d, ]+)/.exec(line)?.[1] ?? "";
  const speeds = [Number(speed[1]), ...[...changes.matchAll(/(\d+) WPM at/g)].map(match => Number(match[1])),
    ...used.split(",").filter(value => value.trim()).map(Number)];
  const qsoCount = /; (\d+) QSOs;/.exec(line)?.[1];
  const score = /; verified score (\d+)(?=;|\.)/.exec(line)?.[1];
  return {
    version: 1, source: "legacy", mode: mode[1] === "Single Call" ? "SingleCall" : "WPX",
    wpm: Number(speed[1]), elapsedSeconds: Number(elapsed[2]), durationSeconds: Number(duration?.[1] ?? elapsed[2]),
    status: elapsed[1] === "completed" ? "completed" : "stopped", verifiedPoints: Number(points[1]),
    ...(qsoCount !== undefined ? { qsoCount: Number(qsoCount) } : {}), ...(score !== undefined ? { score: Number(score) } : {}),
    speeds: [...new Set(speeds)], conditions: /; band conditions (?!off(?:;|\.))/.test(line),
  };
}

/** Best single result wins; time only breaks a tie and never scales the points. */
export function selectReportRunner(attempts: readonly TrainingAttempt[]): ReportDraft["runner"] {
  const candidates = attempts.flatMap(attempt => {
    const result = attempt.runnerResult ?? legacyRunnerResult(attempt);
    return result && ["completed", "stopped"].includes(result.status)
      && Number.isFinite(result.elapsedSeconds) && result.elapsedSeconds > 0 && result.elapsedSeconds <= 900
      && Number.isFinite(result.wpm) && result.wpm > 0
      && Number.isSafeInteger(result.verifiedPoints) && result.verifiedPoints! >= 0
      ? [{ attemptId: attempt.id, result, date: reportStart(attempt) }] : [];
  });
  candidates.sort((a, b) => b.result.verifiedPoints! - a.result.verifiedPoints!
    || b.result.elapsedSeconds - a.result.elapsedSeconds || b.date.localeCompare(a.date) || a.attemptId.localeCompare(b.attemptId));
  const best = candidates[0];
  return best ? { attemptId: best.attemptId, result: best.result } : undefined;
}

const families: Record<string, AudioReportCategory> = {
  WD: "shortWords", PR: "shortPhrases", QSO: "shortQso", POTA: "shortPota",
  DIS: "prefix", IM: "prefix", IN: "prefix", IR: "prefix", RE: "prefix", UN: "prefix",
  ED: "suffix", ES: "suffix", ING: "suffix", LY: "suffix",
};
const filePattern = /\b(WD|PR|QSO|POTA|DIS|IM|IN|IR|RE|UN|ED|ES|ING|LY)\s*(\d+)(?:[-_\u2013\u2014]\d+)?\b/i;

export function reportCategoryForTask(task: TrainingTask | undefined): AudioReportCategory | "scales" | undefined {
  if (!task) return undefined;
  const text = `${task.title} ${task.instructions}`;
  if (task.kind === "sending" && /\bscales?\b/i.test(text)) return "scales";
  if (task.kind !== "audio") return undefined;
  const family = filePattern.exec(text)?.[1]?.toUpperCase();
  if (family) return families[family];
  if (/\bprefix(?:es)?\b/i.test(text)) return "prefix";
  if (/\bsuffix(?:es)?\b/i.test(text)) return "suffix";
  if (/\bshort\s+words?\b/i.test(text)) return "shortWords";
  if (/\bshort\s+phrases?\b/i.test(text)) return "shortPhrases";
  if (/\bshort\s+POTA\b/i.test(text)) return "shortPota";
  if (/\bshort\s+QSOs?\b/i.test(text)) return "shortQso";
  return undefined;
}

function audioIdentity(result: TrainingAudioResult): { category: AudioReportCategory; file: string; speed?: number } | undefined {
  const verified = audioVariants(result).find(variant => variant.url === result.url);
  const match = filePattern.exec(verified?.title ?? result.title) ?? filePattern.exec(result.url);
  const category = match && families[match[1].toUpperCase()];
  if (!match || !category) return undefined;
  const explicit = result.speedWpm;
  const speed = Number.isFinite(explicit) && explicit! > 0 ? explicit : verified?.speedWpm;
  return { category, file: `${match[1].toUpperCase()}${match[2]}`, ...(speed !== undefined ? { speed } : {}) };
}

/** Per-file timing takes priority; older single-file notes use the recorded block time. */
export function legacyAudioResults(attempt: TrainingAttempt): TrainingAudioResult[] {
  const lines = attempt.note?.split("\n").filter(line => line.startsWith("Audio recording: ")) ?? [];
  return lines.flatMap(line => {
    const recording = /^Audio recording: (.+?); assigned [^.]+\. Source: (https?:\/\/\S+?)(?=\. Practice:|$)/.exec(line);
    if (!recording) return [];
    const usage = /\. Practice: ([\d.]+) seconds \(includes [\d.]+ seconds recall\); (\d+) completed pass(?:es)?\./.exec(line);
    if (!usage && lines.length !== 1) return [];
    const activeSeconds = usage ? Number(usage[1]) : attempt.activeSeconds;
    const completedPasses = usage ? Number(usage[2]) : attempt.completedPasses ?? 0;
    const speed = / \((\d+) WPM\)$/.exec(recording[1]);
    return [{ title: recording[1], url: recording[2], activeSeconds, completedPasses,
      ...(speed ? { speedWpm: Number(speed[1]) } : {}) }];
  });
}

function ratingAnswer(key: string, rating: PerformanceRating): string | undefined {
  const field = REPORT_FIELDS.find(item => item.key === key);
  return field?.options?.find(option => option.toLowerCase().replace(/ /g, "-") === rating);
}

function words(text: string): string[] {
  return text.split(/[,;\n]/).map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** Only an explicit Learned: line confirms learning; scratchpad prose stays private. */
export function learnedWordsFromScratchpad(scratchpad: string | undefined): string[] {
  const learned = new Map<string, string>();
  for (const word of scratchpad?.split(/\r?\n/).flatMap(line => {
    const match = /^\s*learned:\s*(.*)$/i.exec(line);
    return match ? words(match[1]) : [];
  }) ?? []) if (!learned.has(word.toLowerCase())) learned.set(word.toLowerCase(), word);
  return [...learned.values()];
}

/** Produce editable suggestions. Saved drafts and opening Google Forms never imply submission. */
export function buildReportDraft(
  course: TrainingCourse, attempts: readonly TrainingAttempt[], options: ReportDraftOptions,
): ReportDraft {
  const answers: Record<string, string> = Object.fromEntries(REPORT_FIELDS.map(field => [field.key, ""]));
  Object.assign(answers, { callsign: options.callsign ?? "N1RWJ", firstName: options.firstName ?? "Robert",
    session: String(options.session), reportDate: options.reportDate });
  const windowed = reportAttemptsInWindow(attempts, options, course.timezone);
  const tasks = new Map(course.assignments.flatMap(assignment => assignment.tasks.map(task => [task.id, task] as const)));
  const sourceDescriptions = new Map<string, Set<string>>();
  const source = (id: string, description: string) => {
    const descriptions = sourceDescriptions.get(id) ?? new Set<string>();
    descriptions.add(description);
    sourceDescriptions.set(id, descriptions);
  };
  const warnings = new Set<string>();
  const files = new Map<AudioReportCategory, Set<string>>();
  const latestRatings = new Map<string, { attempt: TrainingAttempt; value: string }>();
  const latestLcwo = new Map<string, TrainingAttempt>();
  const reportedWords = new Set((options.reports ?? []).filter(report => report.status === "submitted")
    .flatMap(report => words(report.answers.learnedWords ?? "")).map(word => word.toLowerCase()));
  const learned = new Map<string, string>();
  for (const attempt of windowed) {
    const taskCategory = reportCategoryForTask(tasks.get(attempt.taskId));
    const categories = new Set<string>(taskCategory ? [taskCategory] : []);
    for (const result of attempt.audioResults ?? legacyAudioResults(attempt)) {
      if (!(Number.isFinite(result.activeSeconds) && result.activeSeconds > 0)) continue;
      const audio = audioIdentity(result);
      if (!audio) continue;
      categories.add(audio.category);
      const label = `${audio.file}${audio.speed !== undefined ? ` ${audio.speed}` : " (speed not recorded)"}`;
      const values = files.get(audio.category) ?? new Set<string>();
      values.add(label);
      files.set(audio.category, values);
      source(attempt.id, `${label}: ${result.activeSeconds} seconds, ${result.completedPasses} completed passes${attempt.audioResults ? "" : " (saved audio note)"}`);
      if (audio.speed === undefined) warnings.add(`Review ${audio.file}: its practiced speed was not recorded.`);
    }
    if (attempt.performanceRating) {
      for (const category of categories) {
        const key = `${category}Rating`;
        const value = ratingAnswer(key, attempt.performanceRating);
        if (value) latestRatings.set(key, { attempt, value });
      }
    }
    if (attempt.lcwoResult) latestLcwo.set(attempt.lcwoResult.kind, attempt);
    for (const word of learnedWordsFromScratchpad(attempt.scratchpad)) {
      const normalized = word.toLowerCase();
      if (!reportedWords.has(normalized)) {
        learned.set(normalized, learned.get(normalized) ?? word);
        source(attempt.id, `Confirmed learned word: ${word}`);
      }
    }
  }
  for (const [category, values] of files) answers[`${category}Files`] = [...values].join(", ");
  for (const [key, { attempt, value }] of latestRatings) {
    answers[key] = value;
    source(attempt.id, `${REPORT_FIELDS.find(field => field.key === key)?.label ?? key}: ${value}`);
  }
  for (const [kind, attempt] of latestLcwo) {
    const result = attempt.lcwoResult!;
    const prefix = kind === "callsign" ? "callsign" : kind;
    const mappings: [keyof typeof result, string][] = [["speedWpm", `${prefix}Wpm`],
      ["groupLength", `${prefix}Length`], ["maximumLength", `${prefix}MaximumLength`],
      ["score", `${prefix}Score`], ["errorCount", `${prefix}Errors`], ["errorPercent", `${prefix}ErrorPercent`]];
    let used = false;
    for (const [metric, key] of mappings) {
      const value = result[metric];
      if (Object.hasOwn(answers, key) && typeof value === "number" && Number.isFinite(value)) {
        answers[key] = String(value);
        used = true;
      }
    }
    if (used) source(attempt.id, `Latest ${kind} LCWO result`);
  }
  answers.learnedWords = [...learned.values()].join(", ");
  const runner = selectReportRunner(windowed);
  if (runner) {
    const result = runner.result;
    answers.runnerWpm = String(result.wpm);
    answers.runnerVerifiedPoints = String(result.verifiedPoints);
    const speeds = [...new Set([result.wpm, ...result.speeds])];
    source(runner.attemptId, `Morse Runner: ${result.verifiedPoints} Verified Pts; ${result.elapsedSeconds / 60} minutes; ${result.mode === "SingleCall" ? "Single Call" : "WPX"}; ${result.wpm} WPM starting speed; ${result.status}; band conditions ${result.conditions ? "on" : "off"}${speeds.length > 1 ? `; speeds used ${speeds.join(", ")} WPM` : ""}${result.source === "legacy" ? "; recovered from saved note" : ""}`);
    if (result.elapsedSeconds < 900) warnings.add(`The selected Morse Runner result is from a ${result.elapsedSeconds / 60}-minute run. Its actual points are reported without scaling.`);
    if (speeds.length > 1) warnings.add(`The selected Morse Runner run used ${speeds.join(", ")} WPM. Review the suggested starting speed.`);
    if (result.source === "legacy") warnings.add("Morse Runner details were recovered from a saved note; its practice date uses the saved block date.");
  }
  return { answers, sourceAttemptIds: [...sourceDescriptions.keys()],
    sources: [...sourceDescriptions].map(([attemptId, descriptions]) => ({ attemptId, description: [...descriptions].join("; ") })),
    warnings: [...warnings], ...(runner ? { runner } : {}) };
}
