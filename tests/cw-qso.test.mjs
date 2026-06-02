import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adifTag,
  buildAdifFile,
  createEmptyValues,
  createLogEntry,
  getAutoGreeting,
  normalizeRole,
  renderTransmissions,
} from "../src/lib/cw-qso.ts";

function sampleValues() {
  return {
    ...createEmptyValues(),
    myCall: "n1rwj",
    myName: "rob",
    myQth: "rhode island ri",
    myRst: "579",
    myRig: "kx3",
    myPwr: "5w",
    myAnt: "efhw up 25 ft",
    myWx: "sunny 68f",
    myHamYears: "3 yrs",
    myAge: "42",
    myJob: "software engineer",
    greet: "GE",
    hisCall: "k9xyz",
    hisName: "bob",
    hisQth: "texas tx",
    hisRst: "559",
    hisRig: "ten tec eagle",
    hisPwr: "50w",
    hisAnt: "dipole up 45 ft",
    hisWx: "rain 60f",
    hisHamYears: "24 yrs",
    hisAge: "55",
    hisJob: "retired army",
    band: "20m",
    freq: "14.050",
    comment: "portable practice",
  };
}

test("normalizeRole falls back to cq", () => {
  assert.equal(normalizeRole("ans"), "ans");
  assert.equal(normalizeRole("cq"), "cq");
  assert.equal(normalizeRole("weird"), "cq");
  assert.equal(normalizeRole(null), "cq");
});

test("getAutoGreeting chooses greeting by local hour", () => {
  assert.equal(getAutoGreeting(new Date("2026-06-02T11:00:00")), "GM");
  assert.equal(getAutoGreeting(new Date("2026-06-02T15:00:00")), "GA");
  assert.equal(getAutoGreeting(new Date("2026-06-02T19:00:00")), "GE");
});

test("renderTransmissions builds cq-side examples with escaped highlighted fields", () => {
  const tx = renderTransmissions("cq", {
    ...sampleValues(),
    hisName: "bob & sue",
  });

  assert.match(tx.tx1, /CQ CQ CQ DE <span class="me">N1RWJ<\/span>/);
  assert.match(tx.tx4, /UR <span class="him">559<\/span>/);
  assert.match(tx.tx5, /RIG HR <span class="me">KX3<\/span>/);
  assert.match(tx.tx6, /RIG HR <span class="him">TEN TEC EAGLE<\/span>/);
  assert.match(tx.tx8, /JOB HR <span class="him">RETIRED ARMY<\/span>/);
  assert.match(tx.tx9, /TNX FER FB QSO ES INFO/);
  assert.equal(tx.tx10, "TNX INFO ES QSO 73 TU SK");
  assert.match(tx.wQrz, /DE <span class="me">N1RWJ<\/span>/);
});

test("renderTransmissions swaps station roles when answering a cq", () => {
  const tx = renderTransmissions("ans", sampleValues());

  assert.match(tx.tx1, /<span class="him">K9XYZ<\/span>/);
  assert.match(tx.tx2, /<span class="me">N1RWJ<\/span>/);
  assert.match(tx.tx3, /<span class="me">N1RWJ<\/span> DE <span class="him">K9XYZ<\/span>/);
});

test("createLogEntry derives utc values and omits missing optional fields", () => {
  const values = {
    ...sampleValues(),
    hisName: "",
    hisQth: "",
    hisRst: "",
  };
  const now = new Date("2026-06-02T13:07:00.000Z");
  const qsoStart = Date.parse("2026-06-02T13:05:00.000Z");
  const entry = createLogEntry(values, now, qsoStart);

  assert.deepEqual(
    {
      call: entry.call,
      qsoDate: entry.qsoDate,
      timeOn: entry.timeOn,
      timeOff: entry.timeOff,
      rstSent: entry.rstSent,
      rstRcvd: entry.rstRcvd,
      name: entry.name,
      qth: entry.qth,
      operator: entry.operator,
      myQth: entry.myQth,
    },
    {
      call: "K9XYZ",
      qsoDate: "20260602",
      timeOn: "1305",
      timeOff: "1307",
      rstSent: "579",
      rstRcvd: "",
      name: "",
      qth: "",
      operator: "N1RWJ",
      myQth: "RHODE ISLAND RI",
    },
  );
});

test("adifTag skips empty values and buildAdifFile emits header and records", () => {
  assert.equal(adifTag("NAME", ""), "");

  const now = new Date("2026-06-02T13:08:09.000Z");
  const entry = createLogEntry(sampleValues(), now, Date.parse("2026-06-02T13:05:00.000Z"));
  const adif = buildAdifFile([entry], now);

  assert.match(adif, /^ADIF export from CW QSO Walkthrough/m);
  assert.match(adif, /<CREATED_TIMESTAMP:15>20260602 130809/);
  assert.match(adif, /<CALL:5>K9XYZ/);
  assert.match(adif, /<MODE:2>CW/);
  assert.match(adif, /<COMMENT:17>portable practice/);
  assert.match(adif, /<EOR>$/m);
});
