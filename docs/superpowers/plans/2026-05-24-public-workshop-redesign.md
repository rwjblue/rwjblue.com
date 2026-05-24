# Public Workshop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the one-page placeholder into a small static public workshop with homepage activity signals and first-class software/radio sections.

**Architecture:** Keep the Astro site static and simple. Add markdown-backed content collections for notes and projects, then expose them through a compact homepage, notes index, project index, radio page, and now page.

**Tech Stack:** Astro, Markdown content collections, plain CSS, Node built-in test runner.

---

### Task 1: Test The Site Shape

**Files:**
- Create: `tests/site-content.test.mjs`
- Modify: `package.json`

- [x] Add a Node test that checks for the expected content routes, content collections, and homepage/navigation copy.
- [x] Add an `npm test` script.
- [x] Run the test and verify it fails before implementation.

### Task 2: Add Content Collections And Pages

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/notes/*.md`
- Create: `src/content/projects/*.md`
- Create: `src/pages/notes/index.astro`
- Create: `src/pages/projects/index.astro`
- Create: `src/pages/radio/index.astro`
- Create: `src/pages/now/index.astro`

- [x] Define `notes` and `projects` collections.
- [x] Add initial lightweight note and project entries.
- [x] Add compact index pages for notes, projects, radio, and now.

### Task 3: Redesign Homepage And Styles

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

- [x] Replace the large landing-page hero with a compact identity/workshop layout.
- [x] Add internal navigation.
- [x] Add Current Bench, Recent From The Bench, and Selected Artifacts sections.
- [x] Flatten the visual treatment and tune typography for a denser, handcrafted technical site.

### Task 4: Verify

- [x] Run `npm test`.
- [x] Run `mise run check`.
- [x] Run `mise run build`.
- [x] Start the dev server and inspect desktop/mobile in the browser.
