import type { ActiveBlock } from "./storage.ts";
import type { TrainingAttempt } from "./types.ts";

export const COMMON_WORDS = "THE OF AND TO A IN IS FOR THAT WAS ON WITH HE IT AS AT HIS BY BE FROM ARE THIS I BUT HAVE AN HAS NOT THEY OR";
export interface WordSettings {
  wpm: number;
  gapSeconds: number;
  pitch: number;
  shuffle: boolean;
  repeat: boolean;
  spokenAnswers?: boolean;
  /** Legacy preference, removed when restoring a draft. */
  audioSource?: "generated" | "recording";
}
export interface WordPracticeDraft {
  defaultsVersion?: 2;
  /** Device listening preference, independent of the recording configuration. */
  volume?: number;
  title: string;
  text: string;
  settings: WordSettings;
  /** Distinct settings actually played, bounded for the synced note. */
  used: string[];
}
export const DEFAULT_WORD_SETTINGS: WordSettings = { wpm: 40, gapSeconds: 1, pitch: 450, shuffle: true, repeat: true, spokenAnswers: false };

export function parsePracticeWords(text: string): string[] {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 200 || text.length > 10000) throw new Error("Enter between 1 and 200 words (up to 10,000 characters).");
  // Accept letters, numbers, punctuation and explicit prosigns; never interpret
  // morse-pro inline control tags from pasted instructor text.
  for (const word of words) {
    if (word.length > 40 || !/^(?:[A-Z0-9.,?/'!()&:;=+_"$@-]|<[A-Z]{2,3}>)+$/.test(word)) throw new Error(`Cannot send ${word.slice(0, 40)}. Use words, punctuation, or prosigns such as <AR>.`);
  }
  return words;
}

export function checkWordSettings(settings: WordSettings): void {
  if (!Number.isFinite(settings.wpm) || settings.wpm < 10 || settings.wpm > 60
    || !Number.isFinite(settings.gapSeconds) || settings.gapSeconds < 0 || settings.gapSeconds > 5
    || !Number.isFinite(settings.pitch) || settings.pitch < 300 || settings.pitch > 1000
    || (settings.spokenAnswers !== undefined && typeof settings.spokenAnswers !== "boolean")
    || (settings.audioSource !== undefined && !["generated", "recording"].includes(settings.audioSource))
    || typeof settings.shuffle !== "boolean" || typeof settings.repeat !== "boolean") throw new Error("Use 10-60 WPM, 0-5 seconds extra pause, and a 300-1000 Hz pitch.");
}

export function wordSettingsNote(draft: WordPracticeDraft): string {
  const s = draft.settings;
  return `${draft.title.slice(0, 100)}: ${parsePracticeWords(draft.text).length} entries, ${s.wpm} WPM, ${s.gapSeconds}s extra word pause, ${s.pitch} Hz, ${s.shuffle ? "shuffled" : "list order"}, ${s.spokenAnswers ? "3 repeats + spoken answer" : "compact"}, repeat ${s.repeat ? "on" : "off"}`;
}

export function wordPracticeNote(draft: WordPracticeDraft): string {
  return `Browser word recognition (Morse Pro).\n${draft.used.join("\n") || "No audio played."}`;
}

/** Finish a quick listening visit without an editable time or completion claim. */
export function wordPracticeAttempt(active: ActiveBlock, endedAt: string): TrainingAttempt | undefined {
  if (!active.wordPractice || !Number.isFinite(active.activeSeconds)) return;
  const activeSeconds = Math.min(14400, Math.floor(active.activeSeconds));
  if (activeSeconds < 1) return;
  return {
    id: active.id, assignmentId: "other-practice", taskId: "other:word-recognition",
    startedAt: new Date(Math.min(Date.parse(active.startedAt), Date.parse(endedAt) - activeSeconds * 1000)).toISOString(),
    endedAt, activeSeconds, completed: false, context: "practice", review: true,
    note: wordPracticeNote(active.wordPractice),
  };
}

export function recordWordSettings(draft: WordPracticeDraft): void {
  const summary = wordSettingsNote(draft);
  if (draft.used.includes(summary)) return;
  if (draft.used.length < 15) draft.used.push(summary);
  else if (draft.used.length === 15) draft.used.push("Additional settings were selected during this block.");
}

/** Preserve what the old fixed-recording controls displayed, then remove the source preference. */
export function restoreWordSettings(settings: WordSettings): void {
  if (settings.audioSource === "recording") Object.assign(settings, { wpm: 40, pitch: 450, gapSeconds: 1, shuffle: false });
  delete settings.audioSource;
}

export function createWordPracticeBlock(now: string, id: string, previous?: WordPracticeDraft): ActiveBlock {
  const draft: WordPracticeDraft = previous ? { ...structuredClone(previous), used: [] } : {
    title: "30 common words", text: COMMON_WORDS, settings: { ...DEFAULT_WORD_SETTINGS }, used: [],
  };
  // Upgrade the old defaults once, while preserving other customized values.
  if (previous && !previous.defaultsVersion) {
    if (draft.settings.wpm === 30) draft.settings.wpm = DEFAULT_WORD_SETTINGS.wpm;
    if (draft.settings.pitch === 600) draft.settings.pitch = DEFAULT_WORD_SETTINGS.pitch;
  }
  restoreWordSettings(draft.settings);
  draft.defaultsVersion = 2;
  return {
    id, assignmentId: "other-practice", task: {
      id: "other:word-recognition", kind: "review", title: "Word recognition",
      instructions: "Listen for whole words. Adjust the speed and pause between words, or shuffle the list for a new round.",
      sourceUrl: "", optional: true,
    },
    startedAt: now, targetMinutes: 10, activeSeconds: 0, completedPasses: 0,
    previousPasses: 0, targetPasses: 0, position: 0, coverage: [], bookmarks: [],
    context: "practice", review: true,
    wordPractice: draft,
  };
}

/** AudioContext time freezes on suspension; cap late callbacks at the buffer end. */
export function wordPlaybackPosition(offset: number, started: number, now: number, duration: number): number {
  return Math.min(duration, Math.max(offset, offset + Math.max(0, now - started)));
}
