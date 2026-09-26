import { generateQso, QSO_TEMPLATES, type QsoTemplate } from "./qso-generator.ts";
import type { ActiveBlock } from "./storage.ts";
import type { TrainingAttempt } from "./types.ts";

export interface PracticeQso {
  id: string;
  kind?: "story";
  title: string;
  stations: [string, string];
  /** QSO transmissions alternate stations; story lines use a single narrator. */
  lines: string[];
}

/** Original illustrative exchanges; these are not recordings of real contacts. */
export const PRACTICE_QSOS: readonly (PracticeQso | QsoTemplate)[] = [
  ...QSO_TEMPLATES,
  {
    id: "story-trail", kind: "story", title: "The trail marker (short)", stations: ["Narrator", "Narrator"],
    lines: [
      "AT THE EDGE OF THE WOODS MAY FOUND A SMALL BLUE STONE.",
      "SHE LEFT IT BESIDE THE TRAIL AND WALKED UP THE HILL.",
      "ON HER WAY HOME THE FOG HID THE PATH.",
      "THEN SHE SAW THE BLUE STONE AND KNEW WHICH WAY TO GO.",
      "SOMETIMES A SMALL THING CAN MAKE A BIG DIFFERENCE.",
    ],
  },
  {
    id: "story-radio", kind: "story", title: "The quiet band (medium)", stations: ["Narrator", "Narrator"],
    lines: [
      "BEN TOOK HIS SMALL RADIO TO THE PARK ON A COOL AUTUMN MORNING.",
      "HE PUT A WIRE IN A TREE AND SAT AT A WOODEN TABLE.",
      "FOR A WHILE HE HEARD ONLY THE WIND AND THE SOFT HISS OF THE RADIO.",
      "HE CALLED CQ THREE TIMES AND WAITED.",
      "A FAINT SIGNAL CAME BACK FROM A STATION NEAR THE SEA.",
      "THE OTHER OPERATOR WAS NAMED ROSE AND SHE WAS USING FIVE WATTS.",
      "BEN TURNED UP THE VOLUME AND ASKED HER TO SEND HER NAME AGAIN.",
      "THIS TIME HE COPIED EVERY LETTER.",
      "THEY TALKED ABOUT THEIR ANTENNAS AND THE WEATHER.",
      "ROSE HAD RAIN WHILE BEN HAD CLEAR SKIES.",
      "WHEN THEY SAID GOODBYE THE SUN WAS HIGH ABOVE THE TREES.",
      "BEN PACKED HIS BAG WITH ONE CONTACT IN HIS LOG AND A SMILE ON HIS FACE.",
    ],
  },
  {
    id: "story-light", kind: "story", title: "A light across the lake (longer)", stations: ["Narrator", "Narrator"],
    lines: [
      "EVERY EVENING ELLA WALKED DOWN THE OLD ROAD TO THE LAKE.",
      "ONE NIGHT SHE NOTICED A SMALL LIGHT ON THE FAR SHORE.",
      "IT FLASHED TWICE THEN WENT DARK THEN FLASHED TWICE AGAIN.",
      "THE NEXT DAY SHE ASKED HER NEIGHBOR TOM ABOUT THE LIGHT.",
      "HIS FRIEND RUTH HAD JUST MOVED INTO THE CABIN ACROSS THE WATER.",
      "TOM SMILED AND TOOK A FLASHLIGHT FROM A DRAWER.",
      "HE SHOWED ELLA HOW SHORT AND LONG FLASHES COULD STAND FOR LETTERS.",
      "THAT EVENING THEY WALKED TO THE LAKE TOGETHER.",
      "WHEN THE LIGHT APPEARED TOM SENT A SLOW GREETING ACROSS THE WATER.",
      "AFTER A SHORT PAUSE THE ANSWER CAME BACK.",
      "SHE INVITED THEM TO VISIT FOR TEA THE NEXT AFTERNOON.",
      "ELLA SENT HER NAME AND THEN A CAREFUL THANK YOU.",
      "THE LAKE WAS JUST AS WIDE AS BEFORE BUT THE FAR SHORE NO LONGER FELT SO FAR AWAY.",
    ],
  },
];
export const QSO_PITCHES = [450, 500] as const;
export interface QsoPracticeDraft {
  qsoId: string;
  wpm: number;
  used: string[];
  /** Persist the complete exchange so replay, speed edits and reloads agree. */
  generated?: PracticeQso;
}
export function practiceSelection(id: string): PracticeQso | QsoTemplate {
  const selection = PRACTICE_QSOS.find(item => item.id === id);
  if (!selection) throw new Error("Choose a QSO or story from the list.");
  return selection;
}
export function practiceQso(draft: QsoPracticeDraft, random = Math.random): PracticeQso {
  const selection = practiceSelection(draft.qsoId);
  if (selection.kind !== "qso") return selection;
  if (draft.generated?.id !== selection.id) draft.generated = generateQso(selection.id, random);
  return draft.generated!;
}
export function newPracticeQso(draft: QsoPracticeDraft, random = Math.random): void {
  if (practiceSelection(draft.qsoId).kind !== "qso") return;
  draft.generated = generateQso(draft.qsoId, random, draft.generated?.stations);
}
export function checkQsoSpeed(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < 10 || wpm > 40) throw new Error("Use a speed between 10 and 40 WPM.");
}
export function recordQsoSettings(draft: QsoPracticeDraft): void {
  const item = practiceQso(draft);
  const note = `${item.title}: ${draft.wpm} WPM, ${item.kind === "story" ? "narrator 450 Hz" : `station tones 450 / 500 Hz, ${item.stations.join(" / ")}`}`;
  if (!draft.used.includes(note) && draft.used.length < 15) draft.used.push(note);
  else if (!draft.used.includes(note) && draft.used.length === 15) draft.used.push("Additional selections or speeds were played during this block.");
}
export function qsoPracticeNote(draft: QsoPracticeDraft): string {
  return `Browser QSO and story listening (original practice material, not on-air contacts).\n${draft.used.join("\n") || "No audio played."}`;
}
export function qsoPracticeAttempt(active: ActiveBlock, endedAt: string): TrainingAttempt | undefined {
  if (!active.qsoPractice || !Number.isFinite(active.activeSeconds)) return;
  const activeSeconds = Math.min(14400, Math.floor(active.activeSeconds));
  if (activeSeconds < 1) return;
  return {
    id: active.id, assignmentId: "other-practice", taskId: "other:general",
    startedAt: new Date(Math.min(Date.parse(active.startedAt), Date.parse(endedAt) - activeSeconds * 1000)).toISOString(),
    endedAt, activeSeconds, completed: false, context: "practice", review: true,
    note: qsoPracticeNote(active.qsoPractice),
  };
}
export function createQsoPracticeBlock(now: string, id: string, previous?: QsoPracticeDraft): ActiveBlock {
  const draft: QsoPracticeDraft = { qsoId: previous?.qsoId ?? PRACTICE_QSOS[0].id, wpm: previous?.wpm ?? 20, used: [] };
  practiceQso(draft);
  return {
    id, assignmentId: "other-practice", task: {
      id: "other:general", kind: "review", title: "QSO and story listening",
      instructions: "Follow a complete contact or a short story. Listen for whole words and the details being shared.",
      sourceUrl: "", optional: true,
    },
    startedAt: now, targetMinutes: 10, activeSeconds: 0, completedPasses: 0,
    previousPasses: 0, targetPasses: 0, position: 0, coverage: [], bookmarks: [], context: "practice", review: true,
    qsoPractice: draft,
  };
}
