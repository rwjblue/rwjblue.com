# Rhode Island POTA Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, map-first project page that tracks progress toward activating every Rhode Island POTA reference by December 31, 2026.

**Architecture:** POTA API responses are fetched by file-based mise tasks into local JSON caches. A normalization module merges cached park data, recent profile activity, durable activation ledger entries, and note tags into a generated JSON file imported by Astro. The project page renders a Leaflet map and remaining-first checklist from local data only.

**Tech Stack:** Astro 6, TypeScript/JavaScript, Node test runner, Leaflet, file-based mise tasks.

---

## File Structure

- Create `src/lib/pota/ri-tracker.ts`: pure normalization functions and shared types.
- Create `src/data/pota/ri-tracker.json`: small committed seed/generated tracker data so the page builds before the full data snapshot commit.
- Create `data/pota/ri/activations.json`: durable activation ledger seed.
- Create `src/pages/projects/2026-activate-all-ri-pota.astro`: custom project page with map and checklist.
- Create `src/content/projects/2026-activate-all-ri-pota.md`: project index entry.
- Modify `src/pages/radio/index.astro`: link to the POTA tracker from the radio page.
- Modify `src/styles/global.css`: map-first tracker styling.
- Modify `tests/site-content.test.mjs`: static wiring tests for route, Leaflet, task names, and note tag links.
- Create `tests/pota-ri-tracker.test.mjs`: behavior tests for normalization.
- Create `scripts/pota/ri-tracker.mjs`: CLI for fetching caches, merging ledger entries, and generating tracker JSON.
- Create `.mise/tasks/pota/ri/update-parks`, `.mise/tasks/pota/ri/update-profile`, `.mise/tasks/pota/ri/backfill-activations`, `.mise/tasks/pota/ri/build-tracker-data`, and `.mise/tasks/pota/ri/update-tracker`: file-based wrappers around the CLI.

## Task 1: Normalization Tests And Module

**Files:**
- Create: `tests/pota-ri-tracker.test.mjs`
- Create: `src/lib/pota/ri-tracker.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing normalization tests**

Create `tests/pota-ri-tracker.test.mjs` with fixtures that prove:

- all official parks are included, including multi-state references;
- completion can come from any profile callsign;
- old ledger activations remain when absent from the profile snapshot;
- profile activations merge into the durable ledger;
- note tags like `us-7865` link notes to matching references;
- remaining references sort before completed references.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/pota-ri-tracker.test.mjs`

Expected: fail because `src/lib/pota/ri-tracker.ts` does not exist.

- [ ] **Step 3: Implement normalization**

Create `src/lib/pota/ri-tracker.ts` exporting:

- `mergeProfileActivations(ledger, profile)`;
- `buildTrackerData({ parks, ledger, profile, notes, generatedAt })`.

Use plain arrays and objects, normalize references to uppercase, normalize note
tags to lowercase, and sort remaining references before completed references.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/pota-ri-tracker.test.mjs`

Expected: pass.

## Task 2: CLI And Mise Tasks

**Files:**
- Create: `scripts/pota/ri-tracker.mjs`
- Create: `.mise/tasks/pota/ri/update-parks`
- Create: `.mise/tasks/pota/ri/update-profile`
- Create: `.mise/tasks/pota/ri/backfill-activations`
- Create: `.mise/tasks/pota/ri/build-tracker-data`
- Create: `.mise/tasks/pota/ri/update-tracker`
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Write failing task wiring tests**

Extend `tests/site-content.test.mjs` to assert the five `pota:ri:*` task files
exist, are file-based tasks, and call `scripts/pota/ri-tracker.mjs`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: fail because the task files and CLI do not exist.

- [ ] **Step 3: Implement CLI and wrappers**

Create a Node CLI with commands:

- `update-parks`;
- `update-profile`;
- `backfill-activations`;
- `build-tracker-data`;
- `update-tracker`.

Use atomic writes through temporary files, preserve existing cache files on
fetch failure, and make `build-tracker-data` work offline from existing caches.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: pass.

## Task 3: Project Page, Map, And Checklist

**Files:**
- Create: `src/pages/projects/2026-activate-all-ri-pota.astro`
- Create: `src/content/projects/2026-activate-all-ri-pota.md`
- Create: `src/data/pota/ri-tracker.json`
- Create: `data/pota/ri/activations.json`
- Modify: `src/pages/radio/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/site-content.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing static page tests**

Extend `tests/site-content.test.mjs` to assert:

- the custom project route exists;
- the project content entry exists;
- the page imports `src/data/pota/ri-tracker.json`;
- the page uses Leaflet;
- the page includes OpenStreetMap attribution;
- the radio page links to `/projects/2026-activate-all-ri-pota/`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: fail because the page, content entry, and links do not exist.

- [ ] **Step 3: Install Leaflet**

Run: `npm install leaflet`

Expected: `package.json` and `package-lock.json` include `leaflet`.

- [ ] **Step 4: Implement the page**

Create the map-first Astro page. The page should import generated JSON, render
summary stats, render a Leaflet map with green/yellow markers and popups, render
a remaining-first checklist, and keep the checklist useful when map tiles fail.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`

Expected: pass.

## Task 4: Validation

**Files:**
- Verify changed files only.

- [ ] **Step 1: Run Astro validation**

Run: `mise run check`

Expected: pass.

- [ ] **Step 2: Run production build**

Run: `mise run build`

Expected: pass.

- [ ] **Step 3: Run browser verification**

Start the dev server with `mise run dev`, open
`/projects/2026-activate-all-ri-pota/`, and verify desktop and mobile layouts.
Confirm the map renders, markers appear, popups open, and the checklist remains
readable.

## Task 5: Commit Split

**Files:**
- Code commit: implementation files, tests, tasks, package changes, seed data.
- Data commit: full raw POTA caches and generated tracker data after running
  the update tasks.

- [ ] **Step 1: Commit code changes**

Commit the implementation without full downloaded POTA cache snapshots.

- [ ] **Step 2: Run update tasks**

Run `mise run pota:ri:update-tracker` and, when desired,
`mise run pota:ri:backfill-activations`.

- [ ] **Step 3: Commit data snapshot separately**

Commit raw cache JSON, durable ledger updates, and generated tracker JSON in a
separate data commit.
