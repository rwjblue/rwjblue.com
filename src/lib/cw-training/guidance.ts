import type { TrainingTask } from "./types.ts";

export interface ListeningGuidance {
  title: string;
  approach: string;
  scratchpadPrompt: string;
}

// Suggestions supplement the original assignment and instructor directions.
// Repetition targets and pass coverage belong to the player, not this helper.
const guidance: Record<string, ListeningGuidance> = {
  WD: {
    title: "Whole words",
    approach: "Recognize each word by its sound. Hold it in mind before considering a note.",
    scratchpadPrompt: "Optional: words recalled or worth another listen.",
  },
  PR: {
    title: "Phrase meaning",
    approach: "Retain the phrase's meaning in your head. Notes can capture a fragment afterward.",
    scratchpadPrompt: "Optional: phrases or ideas you retained.",
  },
  AFFIX: {
    title: "Word beginnings and endings",
    approach: "Notice the shared beginning or ending, then recognize the complete word by sound.",
    scratchpadPrompt: "Optional: word patterns that clicked or need review.",
  },
  QSO: {
    title: "Conversation details",
    approach: "Follow the exchange mentally, listening for the callsign, name, and location (QTH).",
    scratchpadPrompt: "Optional: callsign, name, location, or uncertain details.",
  },
  POTA: {
    title: "Park exchange",
    approach: "Keep track of both callsigns and any park reference you hear.",
    scratchpadPrompt: "Optional: callsigns, park references, or uncertain details.",
  },
  CWT: {
    title: "Contest exchange",
    approach: "Listen for the callsign, operator's name, and number as one exchange.",
    scratchpadPrompt: "Optional: callsign, name, number, or gaps.",
  },
  SS: {
    title: "Words within a story",
    approach: "Pick out recognizable words as the story unfolds. A complete transcript is not the goal.",
    scratchpadPrompt: "Optional: words or fragments that stood out.",
  },
  DEFAULT: {
    title: "Listening objective",
    approach: "Follow the original objective below. Unless your instructor directs otherwise, try retaining what you hear mentally first.",
    scratchpadPrompt: "Optional: recall, uncertainties, or questions for your instructor.",
  },
};

const affixes = new Set(["DIS", "IM", "IN", "IR", "RE", "UN", "ED", "ES", "ING", "LY"]);
const fileCode = /\b(WD|PR|QSO|POTA|CWT|SS|DIS|IM|IN|IR|RE|UN|ED|ES|ING|LY)\s*\d+\s*[-_\u2013\u2014]\s*\d+\b/i;

/** Original paraphrases of the audio exercise goals, never a transcription task. */
export function listeningGuidance(task: TrainingTask): ListeningGuidance | undefined {
  if (task.kind !== "audio") return undefined;
  const family = (fileCode.exec(task.title)?.[1] ?? fileCode.exec(task.instructions)?.[1])?.toUpperCase();
  let key = family && affixes.has(family) ? "AFFIX" : family;
  if (!key && /\bshort\s+stor(?:y|ies)\b/i.test(`${task.title} ${task.instructions}`)) key = "SS";
  if (!key && /\b(?:prefix|suffix)(?:es)?\b/i.test(`${task.title} ${task.instructions}`)) key = "AFFIX";
  // Return a fresh record so a caller cannot change another exercise's copy.
  return { ...guidance[key ?? "DEFAULT"]! };
}
