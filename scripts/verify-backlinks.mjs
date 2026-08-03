import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const park = read("dist/radio/pota/US-6991/index.html");
const beacons = read("dist/radio/beacons/index.html");
const kx2 = read("dist/radio/equipment/elecraft-kx2/index.html");
const spooltenna = read("dist/radio/equipment/spooltenna-ultra/index.html");
const znLite = read("dist/radio/equipment/n3zn-zn-lite-ii/index.html");
const expedition = read(
  "dist/radio/equipment/dx-commander-expedition/index.html",
);
const receiveLoop = read(
  "dist/radio/equipment/loop-on-ground-receive-antenna/index.html",
);
const cwQso = read("dist/radio/cw-qso/index.html");
const rss = read("dist/rss.xml");
const talkResourcePath =
  "/notes/2026-07-31-morse-code-for-the-technician-resources/";

assert.match(park, /Referenced by/);
assert.match(
  park,
  /href="\/notes\/2026-06-19-rhode-island-to-florida-rove-day-one\/"/,
);
assert.match(beacons, /Referenced by/);
assert.match(
  beacons,
  /href="\/notes\/2026-07-23-learning-to-read-the-bands-with-ncdxf-beacons\/"/,
);
assert.match(kx2, /Referenced by/);
assert.match(
  kx2,
  /href="\/notes\/2026-06-03-kx2-usb-c-side-rails-install\/"/,
);
assert.match(spooltenna, /Referenced by/);
assert.match(
  spooltenna,
  /href="\/notes\/2026-07-18-k2hrc-rhode-island-pota\/"/,
);
assert.match(znLite, /Referenced by/);
assert.match(
  znLite,
  /href="\/notes\/2026-05-30-east-bay-pota-rove\/"/,
);
assert.match(expedition, /Referenced by/);
assert.match(
  expedition,
  /href="\/notes\/2026-07-28-operating-w1aw-1-for-america250\/"/,
);
assert.match(receiveLoop, /Referenced by/);
assert.match(
  receiveLoop,
  /href="\/notes\/2026-07-28-operating-w1aw-1-for-america250\/"/,
);
if (rss.includes(talkResourcePath)) {
  assert.match(cwQso, /Referenced by/);
  assert.match(cwQso, new RegExp(`href="${talkResourcePath}"`));
} else {
  assert.doesNotMatch(cwQso, new RegExp(`href="${talkResourcePath}"`));
}
