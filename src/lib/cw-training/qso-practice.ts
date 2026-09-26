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
export const PRACTICE_QSOS: readonly PracticeQso[] = [
  {
    id: "short-contact", title: "A first contact", stations: ["W1ABC", "K2XYZ"],
    lines: [
      "CQ CQ CQ DE W1ABC W1ABC K",
      "W1ABC DE K2XYZ K2XYZ <KN>",
      "K2XYZ DE W1ABC GE TNX FER CALL UR RST 579 579 NAME BOB BOB QTH BOSTON MA BOSTON MA HW? K2XYZ DE W1ABC <KN>",
      "W1ABC DE K2XYZ R R GE BOB UR RST 589 589 NAME ANN ANN QTH ALBANY NY ALBANY NY TNX FER RPT W1ABC DE K2XYZ <KN>",
      "K2XYZ DE W1ABC R TNX ANN NICE TO MEET U TNX FER QSO 73 ES CU AGN K2XYZ DE W1ABC <SK>",
      "W1ABC DE K2XYZ TNX BOB 73 ES CU AGN W1ABC DE K2XYZ <SK>",
    ],
  },
  {
    id: "ragchew", title: "Rigs, antennas, and weather", stations: ["N4ABC", "W7XYZ"],
    lines: [
      "CQ CQ DE N4ABC N4ABC K",
      "N4ABC DE W7XYZ W7XYZ <KN>",
      "W7XYZ DE N4ABC GA UR RST 559 559 NAME SAM SAM QTH RALEIGH NC HW? W7XYZ DE N4ABC <KN>",
      "N4ABC DE W7XYZ R GA SAM UR RST 569 569 NAME LIZ LIZ QTH BOISE ID N4ABC DE W7XYZ <KN>",
      "W7XYZ DE N4ABC R LIZ RIG HR KX3 PWR 10 WATTS ANT DIPOLE UP 30 FT WX SUNNY TEMP 75 F HW ABT U? W7XYZ DE N4ABC <KN>",
      "N4ABC DE W7XYZ R FB SAM UR QRP SIG SOLID HR RIG IC7300 PWR 50 WATTS ANT VERTICAL WX CLOUDY TEMP 60 F N4ABC DE W7XYZ <KN>",
      "W7XYZ DE N4ABC R FB LIZ TNX FER NICE CHAT HPE CU AGN 73 ES GE W7XYZ DE N4ABC <SK>",
      "N4ABC DE W7XYZ TNX SAM ENJOY UR DAY 73 ES CU AGN N4ABC DE W7XYZ <SK>",
    ],
  },
  {
    id: "pota", title: "A POTA contact", stations: ["N1ABC", "K3XYZ"],
    lines: [
      "CQ POTA CQ POTA DE N1ABC N1ABC K",
      "K3XYZ K3XYZ",
      "K3XYZ DE N1ABC UR 559 559 BK",
      "BK R R UR 579 579 PA PA BK",
      "BK TNX FER PA 73 K3XYZ DE N1ABC K",
      "TU 73",
    ],
  },
  {
    id: "repeat", title: "Asking for a repeat", stations: ["W5ABC", "K8XYZ"],
    lines: [
      "CQ CQ DE W5ABC W5ABC K",
      "W5ABC DE K8XYZ K8XYZ <KN>",
      "K8XYZ DE W5ABC GE UR RST 449 449 NAME JIM JIM QTH AUSTIN TX K8XYZ DE W5ABC <KN>",
      "W5ABC DE K8XYZ R GE JIM UR RST 459 459 NAME JO JO PSE RPT QTH QTH? W5ABC DE K8XYZ <KN>",
      "K8XYZ DE W5ABC R JO QTH AUSTIN AUSTIN TX TX HW CPY? K8XYZ DE W5ABC <KN>",
      "W5ABC DE K8XYZ R R AUSTIN TX TNX MY QTH DAYTON OH DAYTON OH W5ABC DE K8XYZ <KN>",
      "K8XYZ DE W5ABC R DAYTON OH TNX JO FER QSO 73 ES CU AGN K8XYZ DE W5ABC <SK>",
      "W5ABC DE K8XYZ TNX JIM 73 W5ABC DE K8XYZ <SK>",
    ],
  },
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
export interface QsoPracticeDraft { qsoId: string; wpm: number; used: string[] }
export function practiceQso(id: string): PracticeQso {
  const qso = PRACTICE_QSOS.find(qso => qso.id === id);
  if (!qso) throw new Error("Choose a QSO or story from the list.");
  return qso;
}
export function checkQsoSpeed(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < 10 || wpm > 40) throw new Error("Use a speed between 10 and 40 WPM.");
}
export function recordQsoSettings(draft: QsoPracticeDraft): void {
  const item = practiceQso(draft.qsoId);
  const note = `${item.title}: ${draft.wpm} WPM, ${item.kind === "story" ? "narrator 450 Hz" : "station tones 450 / 500 Hz"}`;
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
  return {
    id, assignmentId: "other-practice", task: {
      id: "other:general", kind: "review", title: "QSO and story listening",
      instructions: "Follow a complete contact or a short story. Listen for whole words and the details being shared.",
      sourceUrl: "", optional: true,
    },
    startedAt: now, targetMinutes: 10, activeSeconds: 0, completedPasses: 0,
    previousPasses: 0, targetPasses: 0, position: 0, coverage: [], bookmarks: [], context: "practice", review: true,
    qsoPractice: { qsoId: previous?.qsoId ?? PRACTICE_QSOS[0].id, wpm: previous?.wpm ?? 20, used: [] },
  };
}
