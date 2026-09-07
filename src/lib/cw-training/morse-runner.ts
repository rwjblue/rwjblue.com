import type { TrainingTask } from "./types.ts";

// Official CW Academy student-resource links, checked September 7, 2026.
// Keep the PDFs external; these reminders supplement, not replace, assignments.
export const MORSE_RUNNER_GUIDE_URL = "https://cwops.org/wp-content/uploads/2025/01/Morse-Runner-CE.pdf";
export const MORSE_RUNNER_BASICS_URL = "https://cwops.org/cwa/Using%20Morse%20Runner.pdf";
export const MORSE_RUNNER_DOWNLOAD_URL = "https://github.com/w7sst/MorseRunner/releases";
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
    ? `${task.minutes} uninterrupted minutes` : "the full assigned duration";
  const activity = /\bactivity(?:\s+level)?\s+(\d+)\b/i.exec(instructions)?.[1];
  // Inspect instructions, not the importer's abbreviated title: WPX is also a
  // contest selector, and does not by itself imply WPX Competition run mode.
  const competition = /\bWPX\s+competition\b/i.test(instructions);
  const singleCalls = /\bsingle[\s-]+calls?\b|same settings as Session 1/i.test(instructions);
  const mode = competition
    ? "Run menu: WPX Competition. Send CQ (F1) to begin."
    : singleCalls
      ? "Run menu: Single Calls (separate from the contest selector)."
      : "Choose the Run mode specified in the original exercise instructions.";
  // CE v1.85.4 Main.pas Run() enables conditions and uses CompDuration for
  // WPX Competition; Ini.pas defaults that duration to 60 minutes.
  const conditions = competition
    ? "WPX Competition enables band conditions and may reset its timer to 60 minutes. Stop manually at the assigned duration above; check any conflicting settings with your instructor."
    : singleCalls
      ? "Leave band-condition boxes unchecked unless your assignment or instructor says otherwise."
      : "Use the band conditions specified in the original instructions.";
  return { run: `${speed} · ${duration}${activity ? ` · Activity ${activity}` : ""}`, mode, conditions };
}
