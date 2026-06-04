import { AdifParser } from "adif-parser-ts";

// Minimal local adapter based on @ham2k/lib-qson-adif so we can reuse
// Ham2K's ADIF parsing behavior without patching published package exports.

export function adifToQSON(str, options) {
  const qson = parseADIF(str, options);
  qson.version = "0.4";
  return qson;
}

function parseADIF(str, options = {}) {
  let headers = {};
  const qsos = [];
  const errors = [];

  const adif = AdifParser.parseAdi(cleanupBadADIF(str));

  headers = adif.header;

  if (headers?.programid === "LoTW") {
    options.genericQSL = false;
  } else {
    options.genericQSL = "qsl";
  }

  let qsoCount = 0;
  adif.records.forEach((adifQSO) => {
    if (!isQsoRecord(adifQSO)) {
      return;
    }

    const qso = parseAdifQSO(adifQSO);
    if (qso) {
      qsoCount += 1;
      qso._number = qsoCount;
      if (options.source) {
        qso._source = `${options.source}:qso-${qsoCount}`;
      }

      if (qso._error) {
        errors.push(qso);
      } else {
        qsos.push(qso);
      }
    }
  });

  qsos.sort((a, b) => {
    if ((a.startAtMillis || 0) !== (b.startAtMillis || 0)) {
      return (a.startAtMillis || 0) - (b.startAtMillis || 0);
    }

    return a._number - b._number;
  });

  return {
    source: "adif",
    rawHeaders: headers,
    qsos,
    errors,
  };
}

const HAM2K_POLO_METADATA_CALLS = new Set([
  "BREAK",
  "SOLAR",
  "START",
  "WEATHER",
]);

function isQsoRecord(adifQSO) {
  const call = adifQSO.call?.trim().toUpperCase();

  if (!call) {
    return false;
  }

  return !HAM2K_POLO_METADATA_CALLS.has(call);
}

function condSet(src, dest, field, destField, formatValue) {
  let value = src[field] ?? src[`${field}_intl`];

  if (value !== undefined) {
    value = formatValue ? formatValue(value) : value;
    dest[destField ?? field] = value;
  }

  return value;
}

const REGEXP_FOR_EOH = /<BR>(?=(.*)<EOH>)/gi;
const REGEXP_FOR_MIXW_BAD_ADIF = /<(PROGRAMID|PROGRAMVERSION)>(.+)([\n\r]+)/gi;

function cleanupBadADIF(str) {
  str = str.replaceAll(REGEXP_FOR_EOH, "");
  str = str.replaceAll(
    REGEXP_FOR_MIXW_BAD_ADIF,
    (_match, field, value, newline) => `<${field}:${value.length}>${value}${newline}`,
  );
  return str;
}

function parseAdifQSO(adifQSO) {
  const qso = { our: {}, their: {} };

  try {
    condSet(adifQSO, qso.their, "call", "call", normalizeCallsign);
    condSet(adifQSO, qso.their, "state", "state");
    condSet(adifQSO, qso.their, "dxcc", "dxccCode", (value) => parseInt(value, 10));
    condSet(adifQSO, qso.their, "gridsquare", "grid");

    condSet(adifQSO, qso.our, "operator", "operator", normalizeCallsign);
    condSet(adifQSO, qso.our, "operator", "call", normalizeCallsign);
    condSet(adifQSO, qso.our, "station_callsign", "call", normalizeCallsign);
    condSet(adifQSO, qso.our, "my_gridsquare", "grid");

    qso.freq = parseFrequency(adifQSO.freq);
    qso.band = (adifQSO.band && adifQSO.band.toLowerCase()) || bandForFrequency(qso.freq);
    qso.mode = adifQSO.mode;

    if (adifQSO.qso_date) {
      qso.startAt = adifDateToISO(adifQSO.qso_date, adifQSO.time_on || adifQSO.time_off || "000000");
      qso.startAtMillis = Date.parse(qso.startAt).valueOf();
    }

    if (adifQSO.qso_date_off) {
      qso.endAt = adifDateToISO(adifQSO.qso_date_off, adifQSO.time_off || "235959");
      qso.endAtMillis = Date.parse(qso.endAt).valueOf();
    } else if (adifQSO.time_off && adifQSO.qso_date) {
      qso.endAt = adifDateToISO(adifQSO.qso_date, adifQSO.time_off || "235959");
      qso.endAtMillis = Date.parse(qso.endAt).valueOf();
      if (qso.startAtMillis && qso.endAtMillis < qso.startAtMillis) {
        qso.endAtMillis += 24 * 60 * 60 * 1000;
        qso.endAt = new Date(qso.endAtMillis).toISOString();
      }
    }

    if (!qso.endAt && qso.startAt) {
      qso.endAt = qso.startAt;
      qso.endAtMillis = qso.startAtMillis;
    }

    if (!qso.startAt && qso.endAt) {
      qso.startAt = qso.endAt;
      qso.startAtMillis = qso.endAtMillis;
    }

    return qso;
  } catch (error) {
    qso._error = `${error.name}: ${error.message}`;
    return qso;
  }
}

function normalizeCallsign(value) {
  return value.replace("_", "/");
}

const REGEXP_FOR_NUMERIC_FREQUENCY = /^[\d.]+$/;

function parseFrequency(freq) {
  if (freq && REGEXP_FOR_NUMERIC_FREQUENCY.test(freq)) {
    const value = Number.parseFloat(freq) * 1000;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  return freq;
}

function adifDateToISO(date, time) {
  const formattedTime = time
    ? [time.substring(0, 2) || "00", time.substring(2, 4) || "00", time.substring(4, 6) || "00"].join(":")
    : "00:00:00";

  return [
    date.substring(0, 4),
    date.substring(4, 6),
    date.substring(6, 8),
  ].join("-") + `T${formattedTime}Z`;
}

function bandForFrequency(freq) {
  return bandForExactFrequencyInMHz(freq) ?? bandForExactFrequencyInMHz(freq * 1000) ?? "other";
}

function bandForExactFrequencyInMHz(freq) {
  if (freq >= 130 && freq <= 140) return "2190m";
  if (freq >= 450 && freq <= 499) return "630m";
  if (freq >= 500 && freq <= 505) return "560m";
  if (freq >= 1700 && freq <= 2100) return "160m";
  if (freq >= 3400 && freq <= 4100) return "80m";
  if (freq >= 5300 && freq <= 5500) return "60m";
  if (freq >= 6900 && freq <= 7400) return "40m";
  if (freq >= 10000 && freq <= 10200) return "30m";
  if (freq >= 13900 && freq <= 14400) return "20m";
  if (freq >= 18000 && freq <= 18200) return "17m";
  if (freq >= 20900 && freq <= 21600) return "15m";
  if (freq >= 24500 && freq <= 25200) return "12m";
  if (freq >= 27900 && freq <= 30000) return "10m";
  if (freq >= 50000 && freq <= 54000) return "6m";
  if (freq >= 54001 && freq <= 69999) return "5m";
  if (freq >= 70000 && freq <= 71000) return "4m";
  if (freq >= 140000 && freq <= 150000) return "2m";
  if (freq >= 219000 && freq <= 230000) return "1.25m";
  if (freq >= 400000 && freq <= 460000) return "70cm";
  if (freq >= 900000 && freq <= 930000) return "33cm";
  if (freq >= 1180000 && freq <= 1420000) return "23cm";
  if (freq >= 2300000 && freq <= 2450000) return "13cm";
  if (freq >= 3290000 && freq <= 3510000) return "9cm";
  if (freq >= 5640000 && freq <= 5926000) return "6cm";
  if (freq >= 10000000 && freq <= 10500000) return "3cm";
  if (freq >= 24000000 && freq <= 24250000) return "1.25cm";
  if (freq >= 47000000 && freq <= 47200000) return "6mm";
  if (freq >= 75000000 && freq <= 81000000) return "4mm";
  if (freq >= 122250000 && freq <= 123000000) return "2.5mm";
  if (freq >= 134000000 && freq <= 141000000) return "2mm";
  if (freq >= 241000000 && freq <= 250000000) return "1mm";
  if (freq >= 300000000 && freq <= 7500000000) return "submm";
  return undefined;
}
