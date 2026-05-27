import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildContactMapData,
  gridToLatLon,
  parseAdif,
  renderSvg,
  stateToLatLon,
} from "../scripts/pota/render-contact-map.mjs";
import { BAND_COLORS, bandColor } from "../src/data/pota/band-colors.mjs";

const sampleAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:4>GRID <BAND:3>40m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <GRIDSQUARE:6>EM86sn <DXCC:3>291 <STATE:2>TN <EOR>
<CALL:5>STATE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <STATE:2>IN <EOR>
<CALL:4>NONE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <EOR>
`;

test("parseAdif extracts records and fields", () => {
  const qson = parseAdif(sampleAdif);

  assert.equal(qson.qsos.length, 3);
  assert.equal(qson.qsos[0].their.call, "GRID");
  assert.equal(qson.qsos[0].their.grid, "EM86sn");
  assert.equal(qson.qsos[1].their.state, "IN");
  assert.equal(qson.qsos[0].our.grid, "FN41dx97");
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

test("buildContactMapData uses grids first and state centroids as fallback", () => {
  const map = buildContactMapData(sampleAdif, {
    title: "Sample map",
    subtitle: "Sample subtitle",
  });

  assert.equal(map.title, "Sample map");
  assert.equal(map.originGrid, "FN41dx");
  assert.deepEqual(map.origin, gridToLatLon("FN41dx"));
  assert.equal(map.contacts.length, 2);
  assert.equal(map.contacts[0].source, "grid");
  assert.equal(map.contacts[1].source, "state");
  assert.deepEqual(map.summary, {
    totalRecords: 3,
    plotted: 2,
    fromGrid: 1,
    fromState: 1,
    unplottable: 1,
    bands: {
      "40m": 1,
      "20m": 1,
    },
  });
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

  const svg = renderSvg({
    ...map,
    totalRecords: map.summary.totalRecords,
  });

  assert.match(svg, /Generated from ADI data · 2 QSOs/);
  assert.doesNotMatch(svg, /from grid|from state centroid|plotted/);
});

test("contact map UI uses QSO summary and omits state fallback legend copy", () => {
  const componentSource = readFileSync(
    new URL("../src/components/PotaContactMap.astro", import.meta.url),
    "utf8",
  );

  assert.match(componentSource, /map\.summary\.plotted}\s+QSOs/);
  assert.match(componentSource, /type="application\/json" id=\{bandColorsId\}/);
  assert.match(componentSource, /JSON\.parse\(bandColorsElement\.textContent \?\? "\{\}"\)/);
  assert.match(componentSource, /background:\$\{bandColors\[band\] \?\? bandColors\.other\}/);
  assert.doesNotMatch(componentSource, /State centroid fallback/);
  assert.doesNotMatch(componentSource, /plotted ·/);
});
