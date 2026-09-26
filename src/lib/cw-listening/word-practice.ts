import { COMMON_WORDS, ENGLISH_WORDS_TITLE, QSO_WORDS_TITLE } from "../../data/cw-listening/words.ts";
export { COMMON_WORDS, COMMON_QSO_WORDS, ENGLISH_WORDS_TITLE, QSO_WORDS_TITLE, WORD_LISTS } from "../../data/cw-listening/words.ts";
/** Compatibility for existing imports; the public label no longer includes a count. */
export const COMMON_77_WORDS_TITLE = QSO_WORDS_TITLE;
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
  /** Legacy custom volume, removed in favor of native audio controls. */
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

export function restoreWordPractice(draft: WordPracticeDraft): void {
  restoreWordSettings(draft.settings);
  delete draft.volume;
  const titles: Record<string, string> = {
    "Bob's 77-word reference": QSO_WORDS_TITLE,
    "77 most common words": QSO_WORDS_TITLE,
    "30 common words": ENGLISH_WORDS_TITLE,
  };
  draft.title = titles[draft.title] ?? draft.title;
  draft.used = draft.used.map(note => {
    const previous = Object.keys(titles).find(title => note.startsWith(`${title}:`));
    return previous ? titles[previous] + note.slice(previous.length) : note;
  });
}

/** AudioContext time freezes on suspension; cap late callbacks at the buffer end. */
export function wordPlaybackPosition(offset: number, started: number, now: number, duration: number): number {
  return Math.min(duration, Math.max(offset, offset + Math.max(0, now - started)));
}

export function createWordDraft(previous?: WordPracticeDraft): WordPracticeDraft {
  const draft: WordPracticeDraft = previous ? { ...structuredClone(previous), used: [] } : {
    title: ENGLISH_WORDS_TITLE, text: COMMON_WORDS, settings: { ...DEFAULT_WORD_SETTINGS }, used: [],
  };
  if (previous && !previous.defaultsVersion) {
    if (draft.settings.wpm === 30) draft.settings.wpm = DEFAULT_WORD_SETTINGS.wpm;
    if (draft.settings.pitch === 600) draft.settings.pitch = DEFAULT_WORD_SETTINGS.pitch;
  }
  restoreWordPractice(draft);
  draft.defaultsVersion = 2;
  return draft;
}
