import type { TrainingTask } from "./types.ts";

// Official CW Academy student-resource links, checked September 7, 2026.
// Keep the PDFs external; these reminders supplement, not replace, assignments.
export const MORSE_RUNNER_GUIDE_URL = "https://cwops.org/wp-content/uploads/2025/01/Morse-Runner-CE.pdf";
export const MORSE_RUNNER_BASICS_URL = "https://cwops.org/cwa/Using%20Morse%20Runner.pdf";
export const MORSE_RUNNER_DOWNLOAD_URL = "https://github.com/w7sst/MorseRunner/releases";
export const WEB_MORSE_RUNNER_URL = "https://fritzsche.github.io/WebMorseRunner/";
export const WEB_MORSE_RUNNER_HELP_URL = "https://github.com/fritzsche/WebMorseRunner#usage";
export const MORSE_RUNNER_RESULTS_PROMPT = "Optional: actual WPM, Verified Pts, score, and any NR/NIL errors or questions.";

export function isMorseRunner(task: TrainingTask): boolean {
  return task.kind === "simulator" && /\bmorse[\s-]+runner\b/i.test(`${task.title} ${task.instructions}`);
}

/** Derive only explicit run settings; never substitute the guide's example speed. */
export function morseRunnerSetup(task: TrainingTask): { run: string; mode: string; conditions: string } | undefined {
  if (!isMorseRunner(task)) return undefined;
  const instructions = `${task.instructions} ${task.settings ?? ""}`;
  const speed = Number.isFinite(task.speedWpm) && task.speedWpm! > 0
    ? `${task.speedWpm} WPM starting speed` : "the assigned starting speed";
  const duration = Number.isFinite(task.minutes) && task.minutes! > 0
    ? `${task.minutes} minutes total across saved runs` : "the total assigned practice time";
  const activity = /\bactivity(?:\s+level)?\s+(\d+)\b/i.exec(instructions)?.[1];
  // Translate the original desktop curriculum to Web Morse Runner's Mode
  // selector. A reference to the CQ WPX contest alone does not set Run mode.
  const competition = /\bWPX\s+competition\b/i.test(instructions);
  const singleCalls = /\bsingle[\s-]+calls?\b|same settings as Session 1/i.test(instructions);
  const mode = competition
    ? "Mode: WPX Contest, then Run. Call CQ (F1) to begin."
    : singleCalls
      ? "Mode: Single Call, then Run. Stations call you automatically."
      : "Choose the Mode that matches the original exercise instructions; ask your instructor if unclear.";
  // Web Morse Runner v0.19.1-beta uses the selected duration and does not
  // enforce WPX band conditions. Desktop CE's overrides do not apply here.
  const conditions = competition
    ? "Web WPX Contest keeps your selected duration and does not force band conditions on. Use the assigned activity level and your instructor's band settings."
    : singleCalls
      ? "Leave band-condition boxes unchecked unless your assignment or instructor says otherwise."
      : "Use the band conditions specified in the original instructions.";
  return { run: `${speed} · ${duration}${activity ? ` · Activity ${activity}` : ""}`, mode, conditions };
}
