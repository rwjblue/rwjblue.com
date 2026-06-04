# Radio POTA Park Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build canonical `/radio/pota/US-1234/` pages with park metadata, activation ledgers, inline field-note links, project labels, and supporting park-cache tasks.

**Architecture:** Add a general POTA park data module separate from the RI tracker. A script maintains cached park metadata and generated page data, while the RI tracker consumes canonical URLs without owning detail pages.

**Tech Stack:** Astro static routes, TypeScript modules run with `node --experimental-strip-types`, node:test, mise task wrappers, Leaflet for the small park map.

---

## File Structure

- `src/lib/pota/parks.ts`: new shared builder for canonical park pages, note attachment, project labels, and known-reference discovery.
- `scripts/pota/parks.mjs`: new CLI for `ensure`, `build-page-data`, and `backfill-known` park workflows.
- `.mise/tasks/pota/park/ensure`: new task wrapper for ensuring one or more references.
- `.mise/tasks/pota/park/build-page-data`: new task wrapper to rebuild generated page data from local caches.
- `.mise/tasks/pota/park/backfill-known`: new task wrapper to ensure all known local references.
- `data/pota/parks/cache/*.json`: checked-in cached park metadata files used by canonical pages.
- `src/data/pota/parks.json`: generated canonical park-page data.
- `src/pages/radio/pota/[reference].astro`: new static page route for canonical park pages.
- `src/pages/projects/2026-activate-all-ri-pota.astro`: update checklist and popup links to canonical pages.
- `src/lib/pota/ri-tracker.ts`: add canonical URL to tracker references and expose full qualifying activation lists if needed by links/tests.
- `scripts/pota/ri-tracker.mjs`: read note dates and rebuild against updated tracker shape.
- `src/styles/global.css`: add focused styles for park pages and activation ledger rows.
- `.agents/skills/pota-field-report/SKILL.md`: update field-report workflow for park ensure task and canonical links.
- `.agents/skills/ri-pota/skill.md`: update RI challenge workflow for canonical park pages and park ensure backfill.
- `AGENTS.md`: document new task and canonical URL convention.
- `tests/pota-parks.test.mjs`: new tests for canonical park-page data.
- `tests/pota-ri-tracker.test.mjs`: update tests for canonical URLs and note dates.

## Task 1: Canonical Park Data Builder

**Files:**
- Create: `src/lib/pota/parks.ts`
- Test: `tests/pota-parks.test.mjs`

- [ ] **Step 1: Write failing tests for park data generation**

Create `tests/pota-parks.test.mjs` with tests covering:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPotaParkPages } from "../src/lib/pota/parks.ts";

const parks = [
  {
    reference: "US-6992",
    name: "JL Curran State Park",
    latitude: 41.7448,
    longitude: -71.5488,
    grid: "FN41fr",
    locationDesc: "US-RI",
    attempts: 120,
    activations: 118,
    qsos: 4021,
  },
  {
    reference: "US-0516",
    name: "Sachuest Point National Wildlife Refuge",
    latitude: 41.4798,
    longitude: -71.2436,
    grid: "FN41jl",
    locationDesc: "US-RI",
  },
];

const activations = [
  {
    reference: "US-6992",
    park: "JL Curran State Park",
    date: "2026-05-28",
    callsign: "N1RWJ",
    qsos: { total: 11, cw: 11, data: 0, phone: 0 },
    source: "profile",
  },
  {
    reference: "US-6992",
    park: "JL Curran State Park",
    date: "2026-05-20",
    callsign: "N1RWJ",
    qsos: { total: 23, cw: 23, data: 0, phone: 0 },
    source: "profile",
  },
];

const notes = [
  {
    id: "2026-06-03-jl-curran-state-park-pota",
    title: "JL Curran State Park Pack Mule Activation",
    date: "2026-05-28",
    tags: ["radio", "pota", "us-6992"],
  },
];

test("buildPotaParkPages lists all activations newest first", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.equal(curran.href, "/radio/pota/US-6992/");
  assert.deepEqual(
    curran.activations.map((activation) => activation.date),
    ["2026-05-28", "2026-05-20"],
  );
  assert.equal(curran.activationCount, 2);
  assert.equal(curran.qsoTotal, 34);
});

test("buildPotaParkPages attaches field notes by matching date and tag", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.deepEqual(curran.activations[0].notes, [
    {
      id: "2026-06-03-jl-curran-state-park-pota",
      title: "JL Curran State Park Pack Mule Activation",
      date: "2026-05-28",
      href: "/notes/2026-06-03-jl-curran-state-park-pota/",
    },
  ]);
  assert.deepEqual(curran.activations[1].notes, []);
});

test("buildPotaParkPages labels RI challenge qualifying activations", () => {
  const data = buildPotaParkPages({
    parks,
    activations,
    notes,
    projectRules: [
      {
        id: "2026-ri-pota",
        label: "2026 RI POTA Challenge",
        href: "/projects/2026-activate-all-ri-pota/",
        references: ["US-6992"],
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        minimumQsos: 10,
      },
    ],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });

  const curran = data.parks.find((park) => park.reference === "US-6992");

  assert.deepEqual(curran.activations[0].projects, [
    {
      id: "2026-ri-pota",
      label: "2026 RI POTA Challenge",
      href: "/projects/2026-activate-all-ri-pota/",
    },
  ]);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- tests/pota-parks.test.mjs`

Expected: FAIL because `src/lib/pota/parks.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/pota/parks.ts`**

Add exported interfaces and `buildPotaParkPages({ parks, activations, notes, projectRules, generatedAt })`. Normalize references to uppercase, sort activations newest first, attach notes by matching reference tag plus date, derive project labels from date/reference/QSO rules, and return `{ generatedAt, parks }`.

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test -- tests/pota-parks.test.mjs`

Expected: PASS for all new tests.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
jj commit tests/pota-parks.test.mjs src/lib/pota/parks.ts -m "Add POTA park page data builder"
```

## Task 2: Park Cache Script And Tasks

**Files:**
- Create: `scripts/pota/parks.mjs`
- Create: `.mise/tasks/pota/park/ensure`
- Create: `.mise/tasks/pota/park/build-page-data`
- Create: `.mise/tasks/pota/park/backfill-known`
- Create/update: `data/pota/parks/cache/*.json`
- Create/update: `src/data/pota/parks.json`
- Test: `tests/pota-parks.test.mjs`

- [ ] **Step 1: Write failing tests for known-reference discovery**

Extend `tests/pota-parks.test.mjs` with a test for a `collectKnownReferences` export that combines note tags, activation references, and project references into sorted uppercase references.

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- tests/pota-parks.test.mjs`

Expected: FAIL because `collectKnownReferences` does not exist.

- [ ] **Step 3: Implement known-reference collection**

Add `collectKnownReferences({ notes, activations, projectReferences })` to `src/lib/pota/parks.ts`.

- [ ] **Step 4: Add `scripts/pota/parks.mjs`**

Implement commands:

```text
ensure US-1234 [US-5678...]
build-page-data
backfill-known
```

The script should first reuse existing caches from `data/pota/parks/cache/`,
`data/pota/ri/cache/parks-US-RI.json`, and `data/pota/rove-to-fl/cache/*.json`.
When a reference is missing and network is needed, fetch park metadata from
POTA API, normalize it to the local park shape, and write
`data/pota/parks/cache/US-1234.json`.

- [ ] **Step 5: Add mise task wrappers**

Add executable bash wrappers for the three script commands using
`node --experimental-strip-types scripts/pota/parks.mjs <command>`.

- [ ] **Step 6: Backfill current known parks from local caches**

Run: `mise run pota:park:backfill-known`

Expected: writes park cache files for current field-note tags, activation
ledger references, and RI challenge references without requiring network for RI
parks.

- [ ] **Step 7: Build generated page data**

Run: `mise run pota:park:build-page-data`

Expected: writes `src/data/pota/parks.json`.

- [ ] **Step 8: Run tests and commit Task 2**

Run: `npm test -- tests/pota-parks.test.mjs`

Expected: PASS.

Commit only files touched in this task:

```bash
jj commit scripts/pota/parks.mjs .mise/tasks/pota/park/ensure .mise/tasks/pota/park/build-page-data .mise/tasks/pota/park/backfill-known data/pota/parks/cache src/data/pota/parks.json tests/pota-parks.test.mjs src/lib/pota/parks.ts -m "Add POTA park cache workflow"
```

## Task 3: Canonical Park Page Route

**Files:**
- Create: `src/pages/radio/pota/[reference].astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create page route**

Create `src/pages/radio/pota/[reference].astro` importing Leaflet CSS,
`BaseLayout`, and `src/data/pota/parks.json`. Generate static paths from
`parks`, render park header metadata, small map, public stats, activation
ledger, field-note links, and project labels.

- [ ] **Step 2: Add focused CSS**

Add styles for `.pota-park-hero`, `.pota-park-map`, `.pota-activation-list`,
`.pota-activation`, `.pota-activation-notes`, and `.pota-project-labels`,
including mobile layout rules.

- [ ] **Step 3: Verify Astro route generation**

Run: `mise run check`

Expected: exit 0.

- [ ] **Step 4: Commit Task 3**

Run:

```bash
jj commit 'src/pages/radio/pota/[reference].astro' src/styles/global.css -m "Add canonical POTA park pages"
```

## Task 4: RI Tracker Canonical Links

**Files:**
- Modify: `src/lib/pota/ri-tracker.ts`
- Modify: `scripts/pota/ri-tracker.mjs`
- Modify: `src/pages/projects/2026-activate-all-ri-pota.astro`
- Modify: `src/data/pota/ri-tracker.json`
- Test: `tests/pota-ri-tracker.test.mjs`

- [ ] **Step 1: Write failing tracker tests**

Extend `tests/pota-ri-tracker.test.mjs` to assert that tracker references expose `href: "/radio/pota/US-1234/"` and notes include `date` for activation matching.

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- tests/pota-ri-tracker.test.mjs`

Expected: FAIL because `href` and note `date` are not present.

- [ ] **Step 3: Update tracker types and builder**

Add `href` to `TrackerReference`, add `date` to tracker notes, and keep
`potaUrl` as the external POTA.app URL.

- [ ] **Step 4: Update note reader**

Update `scripts/pota/ri-tracker.mjs` so `readNotes()` includes the frontmatter
date.

- [ ] **Step 5: Update tracker page links**

Change checklist anchors and Leaflet popup links to use `reference.href` for
local park pages. Keep a separate POTA.app link in popups when useful.

- [ ] **Step 6: Rebuild tracker data**

Run: `mise run pota:ri:build-tracker-data`

Expected: updates `src/data/pota/ri-tracker.json` from local caches.

- [ ] **Step 7: Run tests and commit Task 4**

Run:

```bash
npm test -- tests/pota-ri-tracker.test.mjs
mise run check
```

Expected: both commands exit 0.

Commit only files touched in this task:

```bash
jj commit src/lib/pota/ri-tracker.ts scripts/pota/ri-tracker.mjs src/pages/projects/2026-activate-all-ri-pota.astro src/data/pota/ri-tracker.json tests/pota-ri-tracker.test.mjs -m "Link RI tracker to canonical POTA pages"
```

## Task 5: Skills And Repository Guidance

**Files:**
- Modify: `.agents/skills/pota-field-report/SKILL.md`
- Modify: `.agents/skills/ri-pota/skill.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update POTA field-report skill**

Add instructions to run `mise run pota:park:ensure -- US-1234` for every
referenced park, including every rove stop, and link park mentions to
`/radio/pota/US-1234/`.

- [ ] **Step 2: Update RI POTA skill**

Add instructions to ensure park records after RI tracker refreshes/backfills and
to treat canonical park pages as the target for checklist/map links.

- [ ] **Step 3: Update AGENTS.md**

Document the new canonical POTA page URL and park ensure/backfill tasks.

- [ ] **Step 4: Commit Task 5**

Run:

```bash
jj commit .agents/skills/pota-field-report/SKILL.md .agents/skills/ri-pota/skill.md AGENTS.md -m "Update POTA agent workflows for park pages"
```

## Task 6: Final Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all node:test suites pass.

- [ ] **Step 2: Run Astro validation**

Run: `mise run check`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `mise run build`

Expected: exit 0.

- [ ] **Step 4: Browser verification**

Start preview with `mise run preview` and inspect one desktop and one mobile
width for:

- `/radio/pota/US-6992/`
- `/radio/pota/US-0516/`
- `/projects/2026-activate-all-ri-pota/`

Expected: no layout overlap, small maps render, activation rows show notes and
project labels where applicable, and RI tracker links open canonical pages.
