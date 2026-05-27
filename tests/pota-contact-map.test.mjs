import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildContactMapData,
  gridToLatLon,
  parseAdif,
  stateToLatLon,
} from "../scripts/pota/render-contact-map.mjs";

const sampleAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:4>GRID <BAND:3>40m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <GRIDSQUARE:6>EM86sn <DXCC:3>291 <STATE:2>TN <EOR>
<CALL:5>STATE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <STATE:2>IN <EOR>
<CALL:4>NONE <BAND:3>20m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <DXCC:3>291 <EOR>
`;

test("parseAdif extracts records and fields", () => {
  const records = parseAdif(sampleAdif);

  assert.equal(records.length, 3);
  assert.equal(records[0].CALL, "GRID");
  assert.equal(records[0].GRIDSQUARE, "EM86sn");
  assert.equal(records[1].STATE, "IN");
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
