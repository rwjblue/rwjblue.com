export type CwQsoRole = "cq" | "ans";

export const COPY_FIELDS = {
  copyCall: "Call",
  copyBasic: "Basic exchange",
  copyStation: "Rig, antenna, power, weather",
  copyBackground: "Age, job, ham age",
  copyWrapUp: "Wrap up",
} as const;

export type CwQsoFieldId =
  | keyof typeof COPY_FIELDS
  | "myCall"
  | "myName"
  | "myQth"
  | "myRst"
  | "myRig"
  | "myPwr"
  | "myAnt"
  | "myWx"
  | "myHamYears"
  | "myAge"
  | "myJob"
  | "greet"
  | "hisCall"
  | "hisName"
  | "hisQth"
  | "hisRst"
  | "hisRig"
  | "hisPwr"
  | "hisAnt"
  | "hisWx"
  | "hisHamYears"
  | "hisAge"
  | "hisJob"
  | "band"
  | "freq"
  | "comment";

export interface CwQsoValues {
  copyCall: string;
  copyBasic: string;
  copyStation: string;
  copyBackground: string;
  copyWrapUp: string;
  myCall: string;
  myName: string;
  myQth: string;
  myRst: string;
  myRig: string;
  myPwr: string;
  myAnt: string;
  myWx: string;
  myHamYears: string;
  myAge: string;
  myJob: string;
  greet: string;
  hisCall: string;
  hisName: string;
  hisQth: string;
  hisRst: string;
  hisRig: string;
  hisPwr: string;
  hisAnt: string;
  hisWx: string;
  hisHamYears: string;
  hisAge: string;
  hisJob: string;
  band: string;
  freq: string;
  comment: string;
}

export interface CwQsoLogEntry {
  call: string;
  qsoDate: string;
  timeOn: string;
  timeOff: string;
  band: string;
  freq: string;
  mode: "CW";
  rstSent: string;
  rstRcvd: string;
  name: string;
  qth: string;
  operator: string;
  myQth: string;
  comment: string;
  savedAt: number;
}

interface RenderToken {
  text: string;
  className: "me" | "him" | "ph";
}

interface CwStepText {
  titleCq: string;
  titleAns: string;
  tipCq: string;
  tipAns: string;
}

export const LOG_KEY = "cwqso.log";

export const FIELD_DEFAULTS: Record<CwQsoFieldId, string> = {
  copyCall: "",
  copyBasic: "",
  copyStation: "",
  copyBackground: "",
  copyWrapUp: "",
  myCall: "[YOURCALL]",
  myName: "[NAME]",
  myQth: "[QTH]",
  myRst: "599",
  myRig: "[RIG]",
  myPwr: "[PWR]",
  myAnt: "[ANT]",
  myWx: "[WX]",
  myHamYears: "[YRS]",
  myAge: "[AGE]",
  myJob: "[JOB]",
  greet: "GE",
  hisCall: "[THEIRCALL]",
  hisName: "[THEIRNAME]",
  hisQth: "[THEIRQTH]",
  hisRst: "___",
  hisRig: "[THEIRRIG]",
  hisPwr: "[THEIRPWR]",
  hisAnt: "[THEIRANT]",
  hisWx: "[THEIRWX]",
  hisHamYears: "[THEIRYRS]",
  hisAge: "[THEIRAGE]",
  hisJob: "[THEIRJOB]",
  band: "",
  freq: "",
  comment: "",
};

export const PERSISTED_FIELDS: ReadonlySet<CwQsoFieldId> = new Set([
  "myCall",
  "myName",
  "myQth",
  "myRst",
  "myRig",
  "myPwr",
  "myAnt",
  "myWx",
  "myHamYears",
  "myAge",
  "myJob",
  "band",
  "freq",
]);

export const STEP_OWNER: Record<number, "stn1" | "stn2"> = {
  1: "stn1",
  2: "stn2",
  3: "stn1",
  4: "stn2",
  5: "stn1",
  6: "stn2",
  7: "stn1",
  8: "stn2",
  9: "stn1",
  10: "stn2",
};

export const STEP_TEXT: Record<number, CwStepText> = {
  1: {
    titleCq: "Call CQ",
    titleAns: "They call CQ - listen",
    tipCq:
      'Send your callsign twice so a listener can lock onto it. Listen 5-10 sec, then repeat the call if no answer. <strong>PSE</strong> is optional politeness; <strong>K</strong> means "any station, come back."',
    tipAns:
      'Listen for someone calling CQ. They send their callsign twice and end with <strong>K</strong>. Copy their call and put it in "Their callsign" above before you answer.',
  },
  2: {
    titleCq: "A station answers",
    titleAns: "Answer their CQ",
    tipCq:
      `They'll typically just send their callsign twice. Copy it - fill it into the "Their callsign" field above and the rest of the examples update.`,
    tipAns:
      "Send only your callsign, twice. No DE, no preamble - just your call. They'll come back with the first exchange.",
  },
  3: {
    titleCq: "First exchange - greet + report + QTH + name",
    titleAns: "Their first exchange",
    tipCq:
      '<strong>TNX FER CALL</strong> = thanks for the call. <strong>UR RST</strong> introduces their signal report; <strong>QTH</strong> introduces your location, and <strong>NAME</strong> your name. <strong>&lt;BT&gt;</strong> separates topics. Start and end this basic turn with their call DE your call; <strong>K</strong> hands it back.',
    tipAns:
      "Copy their RST, QTH, and name - each sent twice so you can verify. Use the fields below for details and the free-form area for anything else you hear.",
  },
  4: {
    titleCq: "Their exchange back to you",
    titleAns: "Your reply - thank + report + QTH + name",
    tipCq:
      'Copy their RST, QTH, and name below. If you miss something, see "If you missed something" in the reference panel. You can go straight to Wrap Up after this exchange.',
    tipAns:
      "Greet them by name, then TNX FER RPRT (thanks for the report). Send UR RST, QTH, and NAME, repeating the details twice. Use <strong>&lt;BT&gt;</strong> between topics. Begin and end with their call DE your call, finishing with K.",
  },
  5: {
    titleCq: "Rig, power, antenna, and weather",
    titleAns: "Their station and weather details",
    tipCq:
      "After the basic exchange, use BK to resume and BK to hand it back. Keep the station description compact and readable.",
    tipAns:
      "Copy their rig, power, antenna, and weather. If you miss one item, ask just for that item instead of restarting the whole turn.",
  },
  6: {
    titleCq: "Their station and weather details",
    titleAns: "Your station and weather details",
    tipCq:
      "Copy their station details. If you want a short QSO, you can skip from step 4 to the closing instead of taking this extension.",
    tipAns:
      "Start with BK, send your rig, power, antenna, and weather details, then pass it back with BK.",
  },
  7: {
    titleCq: "Age, job, and how long you've been a ham",
    titleAns: "Their background details",
    tipCq:
      "Use BK at the start and end of this turn too. Share as much or as little background as feels natural.",
    tipAns:
      "Copy their ham-years, age, and job details. Once the exchange gets this far, it often feels more conversational and less rigid.",
  },
  8: {
    titleCq: "Their background details",
    titleAns: "Your background details",
    tipCq:
      "Copy their background details. Pull out only the specific item you missed if you need a repeat.",
    tipAns:
      "Start with BK, send your ham-years, age, and job details, then hand it back with BK.",
  },
  9: {
    titleCq: "Wrap up - thanks + 73",
    titleAns: "They wrap up",
    tipCq:
      'Return to their call DE your call for the closing. <strong>FB QSO</strong> = "fine business QSO" (great contact). <strong>CUAGN</strong> = see you again. <strong>SK</strong> marks the end of the contact.',
    tipAns:
      "Listen for their closing turn. After a longer ragchew, this usually includes thanks for the QSO and the info before 73 and SK.",
  },
  10: {
    titleCq: "Their final",
    titleAns: "Your final",
    tipCq:
      "QSO complete. Log it while the extra station and background details are still fresh.",
    tipAns:
      "Use their call DE your call again for your final, ending with SK. Then log it while the details are still fresh.",
  },
};

export function createEmptyValues(): CwQsoValues {
  return {
    copyCall: "",
    copyBasic: "",
    copyStation: "",
    copyBackground: "",
    copyWrapUp: "",
    myCall: "",
    myName: "",
    myQth: "",
    myRst: "",
    myRig: "",
    myPwr: "",
    myAnt: "",
    myWx: "",
    myHamYears: "",
    myAge: "",
    myJob: "",
    greet: "",
    hisCall: "",
    hisName: "",
    hisQth: "",
    hisRst: "",
    hisRig: "",
    hisPwr: "",
    hisAnt: "",
    hisWx: "",
    hisHamYears: "",
    hisAge: "",
    hisJob: "",
    band: "",
    freq: "",
    comment: "",
  };
}

export function getAutoGreeting(date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? "GM" : hour < 18 ? "GA" : "GE";
}

export function normalizeRole(role: string | null | undefined): CwQsoRole {
  return role === "ans" ? "ans" : "cq";
}

export function getDisplayValue(
  values: CwQsoValues,
  field: CwQsoFieldId,
): string {
  const raw = values[field].trim();
  return raw === "" ? FIELD_DEFAULTS[field] : raw.toUpperCase();
}

export function isFilled(values: CwQsoValues, field: CwQsoFieldId): boolean {
  return values[field].trim() !== "";
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

function tokenFor(
  values: CwQsoValues,
  field: CwQsoFieldId,
  whenFilled: "me" | "him",
): RenderToken {
  return {
    text: getDisplayValue(values, field),
    className: isFilled(values, field) ? whenFilled : "ph",
  };
}

function tokenHtml(token: RenderToken): string {
  return `<span class="${token.className}">${escapeHtml(token.text)}</span>`;
}

function s1Call(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myCall", "me")
    : tokenFor(values, "hisCall", "him");
}

function s2Call(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisCall", "him")
    : tokenFor(values, "myCall", "me");
}

function s1Name(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myName", "me")
    : tokenFor(values, "hisName", "him");
}

function s2Name(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisName", "him")
    : tokenFor(values, "myName", "me");
}

function s1Qth(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myQth", "me")
    : tokenFor(values, "hisQth", "him");
}

function s2Qth(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisQth", "him")
    : tokenFor(values, "myQth", "me");
}

function s1Rst(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myRst", "me")
    : tokenFor(values, "hisRst", "him");
}

function s2Rst(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisRst", "him")
    : tokenFor(values, "myRst", "me");
}

function s1Greet(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "greet", "me")
    : tokenFor(values, "greet", "him");
}

function s1Rig(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myRig", "me")
    : tokenFor(values, "hisRig", "him");
}

function s2Rig(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisRig", "him")
    : tokenFor(values, "myRig", "me");
}

function s1Pwr(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myPwr", "me")
    : tokenFor(values, "hisPwr", "him");
}

function s2Pwr(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisPwr", "him")
    : tokenFor(values, "myPwr", "me");
}

function s1Ant(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myAnt", "me")
    : tokenFor(values, "hisAnt", "him");
}

function s2Ant(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisAnt", "him")
    : tokenFor(values, "myAnt", "me");
}

function s1Wx(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myWx", "me")
    : tokenFor(values, "hisWx", "him");
}

function s2Wx(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisWx", "him")
    : tokenFor(values, "myWx", "me");
}

function s1HamYears(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myHamYears", "me")
    : tokenFor(values, "hisHamYears", "him");
}

function s2HamYears(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisHamYears", "him")
    : tokenFor(values, "myHamYears", "me");
}

function s1Age(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myAge", "me")
    : tokenFor(values, "hisAge", "him");
}

function s2Age(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisAge", "him")
    : tokenFor(values, "myAge", "me");
}

function s1Job(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "myJob", "me")
    : tokenFor(values, "hisJob", "him");
}

function s2Job(role: CwQsoRole, values: CwQsoValues): RenderToken {
  return role === "cq"
    ? tokenFor(values, "hisJob", "him")
    : tokenFor(values, "myJob", "me");
}

function renderLine(parts: Array<string | RenderToken>): string {
  return parts
    .map((part) => (typeof part === "string" ? escapeHtml(part) : tokenHtml(part)))
    .join("");
}

export function renderTransmissions(role: CwQsoRole, values: CwQsoValues) {
  const station1Call = s1Call(role, values);
  const station2Call = s2Call(role, values);
  const station1Name = s1Name(role, values);
  const station2Name = s2Name(role, values);
  const station1Qth = s1Qth(role, values);
  const station2Qth = s2Qth(role, values);
  const station1Rst = s1Rst(role, values);
  const station2Rst = s2Rst(role, values);
  const greeting = s1Greet(role, values);
  const station1Rig = s1Rig(role, values);
  const station2Rig = s2Rig(role, values);
  const station1Pwr = s1Pwr(role, values);
  const station2Pwr = s2Pwr(role, values);
  const station1Ant = s1Ant(role, values);
  const station2Ant = s2Ant(role, values);
  const station1Wx = s1Wx(role, values);
  const station2Wx = s2Wx(role, values);
  const station1HamYears = s1HamYears(role, values);
  const station2HamYears = s2HamYears(role, values);
  const station1Age = s1Age(role, values);
  const station2Age = s2Age(role, values);
  const station1Job = s1Job(role, values);
  const station2Job = s2Job(role, values);
  const myCall = tokenFor(values, "myCall", "me");

  return {
    tx1: renderLine(["CQ CQ CQ DE ", station1Call, " ", station1Call, " PSE K"]),
    tx2: renderLine([station2Call, " ", station2Call]),
    tx3: [
      renderLine([station2Call, " DE ", station1Call]),
      renderLine([greeting, " TNX FER CALL <BT>"]),
      renderLine(["UR RST ", station1Rst, " ", station1Rst, " <BT>"]),
      renderLine(["QTH ", station1Qth, " ", station1Qth, " <BT>"]),
      renderLine(["NAME ", station1Name, " ", station1Name, " <BT>"]),
      "HW?",
      renderLine([station2Call, " DE ", station1Call, " K"]),
    ].join("\n"),
    tx4: [
      renderLine([station1Call, " DE ", station2Call]),
      renderLine([greeting, " ", station1Name, " TNX FER RPRT <BT>"]),
      renderLine(["UR RST ", station2Rst, " ", station2Rst, " <BT>"]),
      renderLine(["QTH ", station2Qth, " ", station2Qth, " <BT>"]),
      renderLine(["NAME ", station2Name, " ", station2Name, " <BT>"]),
      "HW?",
      renderLine([station1Call, " DE ", station2Call, " K"]),
    ].join("\n"),
    tx5: [
      "BK",
      renderLine(["RIG HR ", station1Rig, " ES PWR ", station1Pwr, " <BT>"]),
      renderLine(["ANT HR ", station1Ant, " <BT>"]),
      renderLine(["WX HR ", station1Wx, " <BT>"]),
      "HW? BK",
    ].join("\n"),
    tx6: [
      "BK",
      renderLine(["RIG HR ", station2Rig, " ES PWR ", station2Pwr, " <BT>"]),
      renderLine(["ANT HR ", station2Ant, " <BT>"]),
      renderLine(["WX HR ", station2Wx, " <BT>"]),
      "HW? BK",
    ].join("\n"),
    tx7: [
      "BK",
      renderLine(["HAM FER ", station1HamYears, " <BT>"]),
      renderLine(["AGE HR ", station1Age, " <BT>"]),
      renderLine(["JOB HR ", station1Job, " <BT>"]),
      "HW? BK",
    ].join("\n"),
    tx8: [
      "BK",
      renderLine(["HAM FER ", station2HamYears, " <BT>"]),
      renderLine(["AGE HR ", station2Age, " <BT>"]),
      renderLine(["JOB HR ", station2Job, " <BT>"]),
      "HW? BK",
    ].join("\n"),
    tx9: [
      renderLine([station2Call, " DE ", station1Call, " TNX FER FB QSO ES INFO <BT>"]),
      "HPE CUAGN SN 73",
      renderLine([station2Call, " DE ", station1Call, " TU SK"]),
    ].join("\n"),
    tx10: [
      renderLine([station1Call, " DE ", station2Call]),
      "TNX INFO ES QSO 73",
      renderLine([station1Call, " DE ", station2Call, " TU SK"]),
    ].join("\n"),
    wQrz: renderLine(["DE ", myCall, " ", myCall]),
    wAgnName: getDisplayValue(values, "myName"),
    wAgnQth: getDisplayValue(values, "myQth"),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function utcDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}

export function utcTime(date: Date): string {
  return `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}`;
}

export function utcTimeSec(date: Date): string {
  return `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}`;
}

export function createLogEntry(
  values: CwQsoValues,
  now: Date,
  qsoStart: number | null,
): CwQsoLogEntry {
  const startDate = qsoStart ? new Date(qsoStart) : now;

  return {
    call: getDisplayValue(values, "hisCall"),
    qsoDate: utcDate(startDate),
    timeOn: utcTime(startDate),
    timeOff: utcTime(now),
    band: values.band.trim(),
    freq: values.freq.trim(),
    mode: "CW",
    rstSent: getDisplayValue(values, "myRst"),
    rstRcvd: isFilled(values, "hisRst") ? getDisplayValue(values, "hisRst") : "",
    name: isFilled(values, "hisName") ? getDisplayValue(values, "hisName") : "",
    qth: isFilled(values, "hisQth") ? getDisplayValue(values, "hisQth") : "",
    operator: getDisplayValue(values, "myCall"),
    myQth: getDisplayValue(values, "myQth"),
    comment: [
      values.comment.trim(),
      ...Object.entries(COPY_FIELDS).map(([field, label]) => {
        const copy = values[field as keyof typeof COPY_FIELDS].trim();
        return copy ? `${label}: ${copy}` : "";
      }),
    ].filter(Boolean).join("\n\n"),
    savedAt: now.getTime(),
  };
}

export function adifTag(name: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value.length === 0) return "";
  return `<${name}:${value.length}>${value} `;
}

export function buildAdifRecord(entry: CwQsoLogEntry): string {
  return [
    adifTag("CALL", entry.call),
    adifTag("QSO_DATE", entry.qsoDate),
    adifTag("TIME_ON", entry.timeOn),
    adifTag("TIME_OFF", entry.timeOff),
    adifTag("BAND", entry.band),
    adifTag("FREQ", entry.freq),
    adifTag("MODE", entry.mode),
    adifTag("RST_SENT", entry.rstSent),
    adifTag("RST_RCVD", entry.rstRcvd),
    adifTag("NAME", entry.name),
    adifTag("QTH", entry.qth),
    adifTag("OPERATOR", entry.operator),
    adifTag("STATION_CALLSIGN", entry.operator),
    adifTag("MY_CITY", entry.myQth),
    adifTag("COMMENT", entry.comment),
    "<EOR>",
  ]
    .join("")
    .trim();
}

export function buildAdifFile(log: CwQsoLogEntry[], now = new Date()): string {
  const header = [
    "ADIF export from CW QSO Walkthrough",
    adifTag("ADIF_VER", "3.1.4").trim(),
    adifTag("PROGRAMID", "CW QSO Walkthrough").trim(),
    adifTag("CREATED_TIMESTAMP", `${utcDate(now)} ${utcTimeSec(now)}`).trim(),
    "<EOH>",
  ].join("\n");

  return `${header}\n${log.map(buildAdifRecord).join("\n")}\n`;
}
