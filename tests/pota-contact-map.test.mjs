import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildContactMapData,
  collectDxccEntities,
  countryToLatLon,
  gridToLatLon,
  parseAdif,
  renderSvg,
  shouldRenderDxccSummary,
  stateToLatLon,
} from "../scripts/pota/render-contact-map.mjs";
import { BAND_COLORS, bandColor } from "../src/data/pota/band-colors.mjs";

const sampleAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:4>GRID <BAND:3>40m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <MY_DXCC:3>291 <GRIDSQUARE:6>EM86sn <DXCC:3>291 <STATE:2>TN <EOR>
<CALL:5>STATE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <STATE:2>IN <EOR>
<CALL:4>NONE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <EOR>
`;

const roveAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:5>FIRST <BAND:3>20m <QSO_DATE:8>20260530 <TIME_ON:6>195100 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41km12 <GRIDSQUARE:6>EN13ab <DXCC:3>291 <STATE:2>SD <EOR>
<CALL:6>SECOND <BAND:3>30m <QSO_DATE:8>20260530 <TIME_ON:6>215900 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41hn34 <DXCC:3>291 <STATE:2>MI <EOR>
<CALL:5>THIRD <BAND:3>20m <QSO_DATE:8>20260531 <TIME_ON:6>000600 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl56 <DXCC:3>110 <EOR>
`;

const ham2kMetadataAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:4>REAL <BAND:3>20m <QSO_DATE:8>20260604 <TIME_ON:6>141649 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl03 <GRIDSQUARE:6>EM85jx <DXCC:3>291 <STATE:2>TN <EOR>
<CALL:5>BREAK <BAND:3>20m <QSO_DATE:8>20260604 <TIME_ON:6>141700 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl03 <GRIDSQUARE:6>FN41jl <DXCC:3>291 <STATE:2>RI <EOR>
<CALL:5>SOLAR <BAND:3>20m <QSO_DATE:8>20260604 <TIME_ON:6>141800 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl03 <GRIDSQUARE:6>FN41jl <DXCC:3>291 <STATE:2>RI <EOR>
<CALL:7>WEATHER <BAND:3>20m <QSO_DATE:8>20260604 <TIME_ON:6>141900 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl03 <GRIDSQUARE:6>FN41jl <DXCC:3>291 <STATE:2>RI <EOR>
<CALL:5>START <BAND:3>20m <QSO_DATE:8>20260604 <TIME_ON:6>142000 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41jl03 <GRIDSQUARE:6>FN41jl <DXCC:3>291 <STATE:2>RI <EOR>
<X_HAM2K_SOLAR:26>2026-06-04T15:41:54Z SFI <X_HAM2K_WEATHER:29>2026-06-04T15:41:57Z Sunny <EOR>
`;

const mixedDxccAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:5>USONE <BAND:3>40m <QSO_DATE:8>20260605 <TIME_ON:6>140000 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:6>FN41jl <MY_DXCC:3>291 <GRIDSQUARE:6>EM85jx <DXCC:3>291 <STATE:2>TN <EOR>
<CALL:5>USTWO <BAND:3>20m <QSO_DATE:8>20260605 <TIME_ON:6>140500 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:6>FN41jl <MY_DXCC:3>291 <DXCC:3>291 <STATE:2>CA <EOR>
<CALL:5>VEONE <BAND:3>20m <QSO_DATE:8>20260605 <TIME_ON:6>141000 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:6>FN41jl <MY_DXCC:3>291 <DXCC:1>1 <EOR>
<CALL:5>IZONE <BAND:3>15m <QSO_DATE:8>20260605 <TIME_ON:6>142000 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:6>FN41jl <MY_DXCC:3>291 <DXCC:3>248 <EOR>
`;

test("parseAdif extracts records and fields", () => {
  const qson = parseAdif(sampleAdif);

  assert.equal(qson.qsos.length, 3);
  assert.equal(qson.qsos[0].their.call, "GRID");
  assert.equal(qson.qsos[0].their.grid, "EM86sn");
  assert.equal(qson.qsos[1].their.state, "IN");
  assert.equal(qson.qsos[0].our.grid, "FN41dx97");
  assert.equal(qson.qsos[0].our.dxccCode, 291);
});

test("parseAdif excludes Ham2K PoLo metadata entries from QSOs", () => {
  const qson = parseAdif(ham2kMetadataAdif);

  assert.deepEqual(
    qson.qsos.map((qso) => qso.their.call),
    ["REAL"],
  );
});

test("gridToLatLon returns the center of the Maidenhead grid square", () => {
  const point = gridToLatLon("FN41dx");

  assert.equal(point.lat, 41.97916666666667);
  assert.equal(point.lon, -71.70833333333333);
});

test("stateToLatLon only falls back for US DXCC records", () => {
  assert.deepEqual(stateToLatLon("IN", "291"), {
    lat: 39.849426,
    lon: -86.258278,
  });
  assert.equal(stateToLatLon("IN", "110"), null);
  assert.equal(stateToLatLon("", "291"), null);
});

test("countryToLatLon uses DXCC entity coordinates", () => {
  assert.deepEqual(countryToLatLon("230"), { lat: 51.3, lon: 9.7 });
  assert.equal(countryToLatLon("999999"), null);
});

test("buildContactMapData uses grids first and state centroids as fallback", () => {
  const map = buildContactMapData(sampleAdif, {
    title: "Sample map",
    subtitle: "Sample subtitle",
  });

  assert.equal(map.title, "Sample map");
  assert.equal(map.contacts.length, 3);
  assert.equal(map.contacts[0].timestamp, "2026-05-27T00:00:00Z");
  assert.equal(map.contacts[0].originGrid, "FN41dx97");
  assert.deepEqual(map.contacts[0].origin, gridToLatLon("FN41dx97"));
  assert.equal(map.contacts[0].destinationGrid, "EM86sn");
  assert.deepEqual(map.contacts[0].destination, gridToLatLon("EM86sn"));
  assert.equal(map.contacts[0].source, "grid");
  assert.equal(map.contacts[1].destinationState, "IN");
  assert.equal(map.contacts[1].source, "state");
  assert.equal(map.contacts[2].destinationCountry, "291");
  assert.equal(map.contacts[2].source, "country");
  assert.ok(!("originGrid" in map));
  assert.ok(!("origin" in map));
  assert.ok(!("summary" in map));
});

test("buildContactMapData enriches mixed DXCC contact map data", () => {
  const sourceAdi = ["logs/mixed-dxcc.adi"];
  const map = buildContactMapData(mixedDxccAdif, {
    title: "DXCC map",
    subtitle: "DXCC subtitle",
    sourceAdi,
  });

  assert.equal(map.originDxccCode, 291);
  assert.deepEqual(map.sourceAdi, sourceAdi);
  assert.equal(shouldRenderDxccSummary(map), true);
  assert.deepEqual(
    map.contacts.map((contact) => [
      contact.destinationDxccCode,
      contact.destinationDxccName,
      contact.destinationDxccFlag,
    ]),
    [
      [291, "United States", "🇺🇸"],
      [291, "United States", "🇺🇸"],
      [1, "Canada", "🇨🇦"],
      [248, "Italy", "🇮🇹"],
    ],
  );
  assert.deepEqual(map.dxccEntities, [
    { dxccCode: 291, name: "United States", flag: "🇺🇸", count: 2 },
    { dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 1 },
    { dxccCode: 248, name: "Italy", flag: "🇮🇹", count: 1 },
  ]);
  assert.deepEqual(collectDxccEntities(map.contacts), map.dxccEntities);
});

test("collectDxccEntities merges string and numeric DXCC codes", () => {
  assert.deepEqual(
    collectDxccEntities([
      {
        destinationDxccCode: "1",
        destinationDxccName: "Canada",
        destinationDxccFlag: "🇨🇦",
      },
      {
        destinationDxccCode: 1,
        destinationDxccName: "Canada",
        destinationDxccFlag: "🇨🇦",
      },
      {
        destinationDxccCode: 248,
        destinationDxccName: "Italy",
        destinationDxccFlag: "🇮🇹",
      },
    ]),
    [
      { dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 2 },
      { dxccCode: 248, name: "Italy", flag: "🇮🇹", count: 1 },
    ],
  );
});

test("shouldRenderDxccSummary hides home-only maps and handles unknown origins", () => {
  const homeOnlyMap = buildContactMapData(sampleAdif, {
    title: "Home only map",
    subtitle: "Home only subtitle",
  });
  const mixedMap = buildContactMapData(mixedDxccAdif, {
    title: "Mixed map",
    subtitle: "Mixed subtitle",
  });
  const unknownOriginHomeOnlyMap = {
    ...homeOnlyMap,
    originDxccCode: undefined,
  };
  const unknownOriginMixedMap = {
    ...mixedMap,
    originDxccCode: undefined,
  };
  const stringOriginHomeOnlyMap = {
    ...homeOnlyMap,
    originDxccCode: "291",
  };

  assert.equal(shouldRenderDxccSummary(homeOnlyMap), false);
  assert.equal(shouldRenderDxccSummary(mixedMap), true);
  assert.equal(shouldRenderDxccSummary(unknownOriginHomeOnlyMap), false);
  assert.equal(shouldRenderDxccSummary(unknownOriginMixedMap), true);
  assert.equal(shouldRenderDxccSummary(stringOriginHomeOnlyMap), false);
});

test("buildContactMapData preserves per-contact origins and country fallback for roves", () => {
  const map = buildContactMapData(roveAdif, {
    title: "Rove map",
    subtitle: "Rove subtitle",
  });

  assert.equal(map.contacts.length, 3);
  assert.deepEqual(
    map.contacts.map((contact) => contact.timestamp),
    [
      "2026-05-30T19:51:00Z",
      "2026-05-30T21:59:00Z",
      "2026-05-31T00:06:00Z",
    ],
  );
  assert.deepEqual(
    map.contacts.map((contact) => contact.originGrid),
    ["FN41km12", "FN41hn34", "FN41jl56"],
  );
  assert.deepEqual(map.contacts[0].destination, gridToLatLon("EN13ab"));
  assert.equal(map.contacts[0].destinationGrid, "EN13ab");
  assert.equal(map.contacts[1].destinationState, "MI");
  assert.equal(map.contacts[1].source, "state");
  assert.equal(map.contacts[2].destinationCountry, "110");
  assert.equal(map.contacts[2].source, "country");
});

test("bandColor matches Ham2K PoLo band colors", () => {
  assert.equal(BAND_COLORS["160m"], "#b402cc");
  assert.equal(BAND_COLORS["30m"], "#15c2bc");
  assert.equal(bandColor("40m"), "#1686f0");
  assert.equal(bandColor("20m"), "#49c215");
  assert.equal(bandColor("70cm"), "#7e10eb");
  assert.equal(bandColor("unknown"), "#000000");
});

test("renderSvg summarizes the map in QSOs", () => {
  const map = buildContactMapData(sampleAdif, {
    title: "Sample map",
    subtitle: "Sample subtitle",
  });

  const svg = renderSvg(map);

  assert.match(svg, /Generated from ADI data · 3 QSOs/);
  assert.doesNotMatch(svg, /from grid|from state centroid|plotted/);
});

test("contact map UI uses QSO summary and omits state fallback legend copy", () => {
  const componentSource = readFileSync(
    new URL("../src/components/PotaContactMap.astro", import.meta.url),
    "utf8",
  );

  assert.match(componentSource, /map\.contacts\.length}\s+QSOs/);
  assert.match(componentSource, /type="application\/json" id=\{bandColorsId\}/);
  assert.match(componentSource, /JSON\.parse\(bandColorsElement\.textContent \?\? "\{\}"\)/);
  assert.match(componentSource, /collectBandCounts\(map\.contacts\)/);
  assert.doesNotMatch(componentSource, /State centroid fallback/);
  assert.doesNotMatch(componentSource, /plotted ·/);
});
