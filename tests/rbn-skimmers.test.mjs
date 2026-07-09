import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRbnMainUrl,
  defaultSelectedSkimmers,
  normalizeRbnNode,
  parseTargetCalls,
  rankSkimmers,
} from "../src/lib/rbn-skimmers.ts";

const origin = { lat: 26.7886381, lon: -80.0337704 };

const nu4f = {
  call: "NU4F",
  grid: "EL96WD",
  sk_ver: "v.1.6.0.145",
  sk_opt: "normal<br>ALL spots",
  lst_age: "online",
  band: {
    1: ["CW", "160m", "1800~1840"],
    3: ["CW", "80m", "3500~3570"],
    4: ["CW", "40m", "7000~7040"],
    8: ["CW", "20m", "14000~14070"],
    14: ["CW", "10m", "28000~28070"],
  },
};

const aa0o = {
  call: "AA0O",
  grid: "EL87PS",
  sk_ver: "v.1.6.0.145",
  sk_opt: "normal<br>ALL spots",
  lst_age: "online",
  band: {
    1: ["CW", "80m", "3500~3570"],
    3: ["CW", "40m", "7000~7035"],
    8: ["CW", "20m", "14000~14070"],
  },
};

test("normalizeRbnNode extracts spot policy and ordered unique bands", () => {
  const normalized = normalizeRbnNode(nu4f, origin);

  assert.equal(normalized?.call, "NU4F");
  assert.equal(normalized?.grid, "EL96WD");
  assert.equal(normalized?.spotPolicy, "ALL spots");
  assert.deepEqual(normalized?.bands, ["160m", "80m", "40m", "20m", "10m"]);
  assert.equal(normalized?.lastSeen, "online");
  assert.ok(normalized && normalized.distanceMiles > 40);
  assert.ok(normalized && normalized.distanceMiles < 50);
});

test("rankSkimmers sorts usable nodes by distance", () => {
  const ranked = rankSkimmers([aa0o, { ...nu4f, call: "NU4F" }, { call: "BAD" }], origin);

  assert.deepEqual(
    ranked.map((skimmer) => skimmer.call),
    ["NU4F", "AA0O"],
  );
});

test("defaultSelectedSkimmers selects the closest one or two skimmers", () => {
  const ranked = rankSkimmers([aa0o, nu4f], origin);

  assert.deepEqual(defaultSelectedSkimmers(ranked), ["NU4F", "AA0O"]);
  assert.deepEqual(defaultSelectedSkimmers(ranked.slice(0, 1)), ["NU4F"]);
});

test("parseTargetCalls accepts comma and whitespace separated calls", () => {
  assert.deepEqual(parseTargetCalls(" k2a, k2b  k2* "), ["K2A", "K2B", "K2*"]);
});

test("buildRbnMainUrl builds readable RBN query parameters", () => {
  const url = buildRbnMainUrl({
    spotterCalls: ["NU4F", "AA0O"],
    targetCalls: ["K2A", "K2H"],
    maxAge: 6,
    maxAgeUnits: "hours",
    rows: 50,
  });

  assert.equal(
    url,
    "https://www.reversebeacon.net/main.php?spotter_call=NU4F%2CAA0O&spotted_call=K2A%2CK2H&max_age=6%2Chours&rows=50",
  );
});
