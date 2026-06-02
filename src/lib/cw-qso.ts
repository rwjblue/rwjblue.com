export type CwQsoRole = "cq" | "ans";

export type CwQsoFieldId =
  | "myCall"
  | "myName"
  | "myQth"
  | "myRst"
  | "greet"
  | "hisCall"
  | "hisName"
  | "hisQth"
  | "hisRst"
  | "band"
  | "freq"
  | "comment";

export interface CwQsoValues {
  myCall: string;
  myName: string;
  myQth: string;
  myRst: string;
  greet: string;
  hisCall: string;
  hisName: string;
  hisQth: string;
  hisRst: string;
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
  myCall: "[YOURCALL]",
  myName: "[NAME]",
  myQth: "[QTH]",
  myRst: "599",
  greet: "GE",
  hisCall: "[THEIRCALL]",
  hisName: "[THEIRNAME]",
  hisQth: "[THEIRQTH]",
  hisRst: "___",
  band: "",
  freq: "",
  comment: "",
};

export const PERSISTED_FIELDS: ReadonlySet<CwQsoFieldId> = new Set([
  "myCall",
  "myName",
  "myQth",
  "myRst",
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
    titleCq: "First exchange - greet + report + name + QTH",
    titleAns: "Their first exchange",
    tipCq:
      '<strong>DR OM</strong> = "dear old man" (friendly, used for any op). <strong>TU fer call</strong> = thanks for the call. RST and QTH each sent twice. <strong>HW?</strong> = how copy? <strong>BK</strong> = back to you.',
    tipAns:
      "Copy their RST, name, and QTH - each sent twice so you can verify. Fill them into the fields above so your reply (next step) populates correctly.",
  },
  4: {
    titleCq: "Their exchange back to you",
    titleAns: "Your reply - thank + report + name + QTH",
    tipCq:
      'Copy their RST, name, and QTH. Fill them in above so the sign-off line populates correctly. If you miss something, see "If you missed something" on the right.',
    tipAns:
      "HI [their name] is a personal greeting. TU fer RPRT means thanks for the report. RST and QTH twice. Bracket your transmission with the calls: [THEIR] DE [YOU] ... [YOU] DE [THEIR] BK.",
  },
  5: {
    titleCq: "Wrap up - thanks + 73",
    titleAns: "They wrap up",
    tipCq:
      ' <strong>FB QSO</strong> = "fine business QSO" (great contact). <strong>HPE CUAGN SN</strong> = hope to see you again soon. <strong>73</strong> = best regards. <strong>EE</strong> = the "dit-dit" closer (two short dits, a friendly farewell).',
    tipAns:
      "Listen for their wrap-up. They'll thank you by name, send 73, then close with EE. Your response is short - TU 73 EE.",
  },
  6: {
    titleCq: "Their final",
    titleAns: "Your final",
    tipCq:
      "QSO complete. Log it: time (UTC), band/freq, mode (CW), their call, RST sent/received, name, QTH.",
    tipAns:
      "Short and sweet - TU 73 EE closes the QSO. Log it: time (UTC), band/freq, mode (CW), their call, RST sent/received, name, QTH.",
  },
};

export function createEmptyValues(): CwQsoValues {
  return {
    myCall: "",
    myName: "",
    myQth: "",
    myRst: "",
    greet: "",
    hisCall: "",
    hisName: "",
    hisQth: "",
    hisRst: "",
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
  const myCall = tokenFor(values, "myCall", "me");

  return {
    tx1: renderLine(["CQ CQ CQ DE ", station1Call, " ", station1Call, " PSE K"]),
    tx2: renderLine([station2Call, " ", station2Call]),
    tx3: [
      renderLine([station2Call, " DE ", station1Call]),
      renderLine([greeting, " DR OM ES TU FER CALL"]),
      renderLine(["RST ", station1Rst, " ", station1Rst, " IN ", station1Qth, " ", station1Qth]),
      renderLine(["ES OP ", station1Name, " ", station1Name]),
      "HW? BK",
    ].join("\n"),
    tx4: [
      renderLine([station1Call, " DE ", station2Call]),
      renderLine(["HI ", station1Name, " TU FER RPRT"]),
      renderLine(["UR ", station2Rst, " ", station2Rst, " IN ", station2Qth, " ", station2Qth]),
      renderLine(["ES OP ", station2Name, " ", station2Name]),
      renderLine([station1Call, " DE ", station2Call, " BK"]),
    ].join("\n"),
    tx5: [
      renderLine([station2Call, " DE ", station1Call, " TU ", station2Name]),
      "FB QSO ES HPE CUAGN SN 73",
      renderLine([station2Call, " DE ", station1Call, " TU EE"]),
    ].join("\n"),
    tx6: "TU 73 EE",
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
    comment: values.comment.trim(),
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
