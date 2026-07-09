# RBN Skimmer Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side `/radio/rbn-skimmers/` utility that ranks active RBN skimmers near an operating location and builds an official RBN handoff URL.

**Architecture:** Keep radio-domain logic in `src/lib/rbn-skimmers.ts` so it is testable with Node's built-in test runner. Put DOM wiring in `src/lib/rbn-skimmers-client.ts`, with Astro providing static markup and a Leaflet-backed map container. Reuse existing global page and utility styling patterns.

**Tech Stack:** Astro 6, TypeScript, Node test runner, Leaflet, RBN active-node JSON, browser Geolocation API.

---

### Task 1: Core RBN Skimmer Logic

**Files:**
- Create: `src/lib/rbn-skimmers.ts`
- Test: `tests/rbn-skimmers.test.mjs`

- [ ] **Step 1: Write failing tests for grid parsing, ranking, normalization, target parsing, and URL building**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRbnMainUrl,
  defaultSelectedSkimmers,
  gridToLatLon,
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

test("gridToLatLon returns the center of 4- and 6-character grids", () => {
  assert.deepEqual(roundPoint(gridToLatLon("EL96")), { lat: 26.5, lon: -79 });
  assert.deepEqual(roundPoint(gridToLatLon("EL96WD")), {
    lat: 26.1458,
    lon: -80.125,
  });
});

test("gridToLatLon rejects invalid grids", () => {
  assert.equal(gridToLatLon("EL9"), null);
  assert.equal(gridToLatLon("EL9XWD"), null);
  assert.equal(gridToLatLon("ZZ99AA"), null);
});

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

function roundPoint(point) {
  if (!point) return null;
  return {
    lat: Number(point.lat.toFixed(4)),
    lon: Number(point.lon.toFixed(4)),
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/rbn-skimmers.test.mjs`

Expected: FAIL because `src/lib/rbn-skimmers.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/rbn-skimmers.ts`**

Implement exported functions and types:

```ts
export interface LatLon { lat: number; lon: number }
export interface RbnNodeRecord { call?: string; grid?: string; sk_ver?: string; sk_opt?: string; lst_age?: string; band?: Record<string, unknown> | unknown[] }
export interface RankedSkimmer { call: string; grid: string; lat: number; lon: number; distanceMiles: number; distanceKm: number; spotPolicy: string; bands: string[]; lastSeen: string; skimmerVersion: string }
export function gridToLatLon(grid: string): LatLon | null
export function normalizeRbnNode(node: RbnNodeRecord, origin: LatLon): RankedSkimmer | null
export function rankSkimmers(nodes: RbnNodeRecord[], origin: LatLon): RankedSkimmer[]
export function defaultSelectedSkimmers(skimmers: RankedSkimmer[], limit = 2): string[]
export function parseTargetCalls(value: string): string[]
export function buildRbnMainUrl(options: { spotterCalls: string[]; targetCalls?: string[]; maxAge?: number; maxAgeUnits?: "minutes" | "hours" | "days"; rows?: number }): string
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/rbn-skimmers.test.mjs`

Expected: PASS for the new RBN skimmer tests.

### Task 2: Astro Page and Radio Navigation

**Files:**
- Create: `src/pages/radio/rbn-skimmers.astro`
- Modify: `src/pages/radio/index.astro`
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Write failing content tests**

Add assertions to `tests/site-content.test.mjs`:

```js
test("radio page links the RBN skimmer finder utility", () => {
  const radio = read("src/pages/radio/index.astro");

  assert.match(radio, /\/radio\/rbn-skimmers\//);
  assert.match(radio, /RBN Skimmer Finder/);
});

test("rbn skimmer finder page provides utility markup and client boot script", () => {
  assert.ok(existsSync("src/pages/radio/rbn-skimmers.astro"));

  const page = read("src/pages/radio/rbn-skimmers.astro");

  assert.match(page, /title="RBN Skimmer Finder \/ N1RWJ"/);
  assert.match(page, /id="rbn-skimmer-tool"/);
  assert.match(page, /id="rbn-use-location"/);
  assert.match(page, /id="rbn-grid"/);
  assert.match(page, /id="rbn-map"/);
  assert.match(page, /id="rbn-open-link"/);
  assert.match(page, /initRbnSkimmerTool/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/site-content.test.mjs`

Expected: FAIL because the page and radio link are not present.

- [ ] **Step 3: Add the Astro page and radio link**

Create markup with:

- `section.page-intro`
- `section.section-block.wide.rbn-skimmer-tool#rbn-skimmer-tool`
- Location controls: `#rbn-use-location`, `#rbn-grid`, `#rbn-apply-grid`
- Status: `#rbn-status`
- Results: `#rbn-results`
- Map: `#rbn-map`
- Target input and link: `#rbn-targets`, `#rbn-open-link`
- Boot script importing `initRbnSkimmerTool` from `../../lib/rbn-skimmers-client`

Modify `/radio/` to add an artifact item linking to `/radio/rbn-skimmers/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/site-content.test.mjs`

Expected: PASS for the page-content tests.

### Task 3: Client Script and Styling

**Files:**
- Create: `src/lib/rbn-skimmers-client.ts`
- Modify: `src/styles/global.css`
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Write failing static assertions for client behavior hooks**

Add assertions to the RBN page test in `tests/site-content.test.mjs`:

```js
const client = read("src/lib/rbn-skimmers-client.ts");

assert.match(client, /RBN_NODES_URL/);
assert.match(client, /navigator\.geolocation/);
assert.match(client, /rankSkimmers/);
assert.match(client, /buildRbnMainUrl/);
assert.match(client, /L\.map/);
assert.match(client, /localStorage/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/site-content.test.mjs`

Expected: FAIL because the client file does not exist.

- [ ] **Step 3: Implement client script and CSS**

Implement a DOM script that:

- Fetches `https://www.reversebeacon.net/nodes/detail_json.php`.
- Supports geolocation and manual grid entry.
- Renders selected and selectable nearest-skimmer rows.
- Updates a Leaflet map.
- Builds the RBN URL whenever selections or target calls change.
- Saves the last manual grid and target calls to `localStorage`.
- Leaves the table working if map setup fails.

Add CSS classes prefixed with `rbn-` for the controls, status, results table,
map, and handoff panel.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/site-content.test.mjs`

Expected: PASS for the static client assertions.

### Task 4: Verification and Browser QA

**Files:**
- No new files expected.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run Astro validation**

Run: `mise run check`

Expected: Astro sync exits 0.

- [ ] **Step 3: Run production build**

Run: `mise run build`

Expected: Astro build exits 0 and includes `/radio/rbn-skimmers/index.html`.

- [ ] **Step 4: Start dev server for browser QA**

Run: `mise run dev -- --host 127.0.0.1`

Expected: Astro dev server starts and prints a localhost URL.

- [ ] **Step 5: Verify desktop and mobile rendering**

Open `/radio/rbn-skimmers/` in a browser at desktop and mobile widths. Confirm:

- The page loads without console errors from local code.
- Manual grid entry ranks active skimmers.
- The map renders and frames the operating location plus skimmers.
- Selecting rows updates the RBN link.
- Target calls update the RBN link.

- [ ] **Step 6: Stop dev server**

Stop the dev-server process before finishing.
