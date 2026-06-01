# CQ WPX Contact Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a checked-in contact map to the CQ WPX contest note using the existing note-level contact-map pipeline.

**Architecture:** Keep the existing map renderer and note template unchanged. Copy the CQ WPX ADI export into the gitignored source archive, generate a new checked-in JSON map artifact from that ADI, and wire the note to it with frontmatter plus a regression test that proves the note references the artifact.

**Tech Stack:** Astro content collections, Node test runner, `scripts/pota/render-contact-map.mjs`, mise tasks, Jujutsu

---

### Task 1: Add a regression test for the WPX note wiring

**Files:**
- Modify: `tests/site-content.test.mjs`
- Test: `tests/site-content.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test("cq wpx note is wired to a checked-in contact map artifact", () => {
  const note = read("src/content/notes/2026-05-31-cq-wpx-cw-learning-weekend.md");

  assert.ok(
    existsSync("src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json"),
  );
  assert.match(
    note,
    /contactMap: src\/data\/pota\/contact-maps\/2026-05-31-cq-wpx-cw-learning-weekend\.json/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site-content.test.mjs`
Expected: FAIL because the WPX note does not yet reference the checked-in contact map artifact and the JSON file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

No production code yet. This task only establishes the failing regression around the content wiring.

- [ ] **Step 4: Run test to verify it still fails for the expected reason**

Run: `node --test tests/site-content.test.mjs`
Expected: FAIL on the new WPX contact-map assertions, not from a syntax error in the test file.

- [ ] **Step 5: Commit**

```bash
jj commit tests/site-content.test.mjs -m "Add WPX contact-map wiring regression test"
```

### Task 2: Archive the ADI and generate the checked-in map artifact

**Files:**
- Create: `data/pota/source-adi/2026/05/2026 CQ WPX CW.adi`
- Create: `src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json`

- [ ] **Step 1: Copy the source ADI into the local archive**

Run:

```bash
cp "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/2026 CQ WPX CW.adi" \
  "data/pota/source-adi/2026/05/2026 CQ WPX CW.adi"
```

Expected: The gitignored archive now contains the source ADI inside the repo working tree.

- [ ] **Step 2: Generate the JSON contact map artifact**

Run:

```bash
mise run pota:contact-map:from-adi \
  --input "data/pota/source-adi/2026/05/2026 CQ WPX CW.adi" \
  --output "src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json" \
  --title "CQ WPX CW Contact Map" \
  --subtitle "N1RWJ · 37 QSOs · May 30-31, 2026"
```

Expected: A new checked-in JSON file is written under `src/data/pota/contact-maps/`.

- [ ] **Step 3: Inspect the generated artifact for sanity**

Run:

```bash
sed -n '1,220p' src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json
```

Expected: JSON includes `title`, `subtitle`, `stationCallsign`, and a `contacts` array with plottable contacts.

- [ ] **Step 4: Run the contact-map focused tests**

Run: `node --test tests/pota-contact-map.test.mjs`
Expected: PASS, confirming the existing renderer still matches the checked-in workflow.

- [ ] **Step 5: Commit**

```bash
jj commit src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json -m "Add CQ WPX contact-map data"
```

### Task 3: Wire the note to the generated map and verify the site

**Files:**
- Modify: `src/content/notes/2026-05-31-cq-wpx-cw-learning-weekend.md`
- Modify: `tests/site-content.test.mjs`
- Test: `tests/site-content.test.mjs`

- [ ] **Step 1: Add the note frontmatter reference**

```md
contactMap: src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json
```

Place it in the note frontmatter near the existing `shareImageHero` field.

- [ ] **Step 2: Run the site-content regression test**

Run: `node --test tests/site-content.test.mjs`
Expected: PASS, proving the WPX note is wired to the checked-in map artifact.

- [ ] **Step 3: Run full repo validation**

Run: `mise run check`
Expected: PASS

Run: `mise run build`
Expected: PASS

- [ ] **Step 4: Verify the note visually**

Run: `mise run preview`
Expected: Local preview server starts successfully.

Then open `http://127.0.0.1:4321/notes/2026-05-31-cq-wpx-cw-learning-weekend/` and verify at desktop and mobile widths that the contact map renders below the note content with the expected QSO count and no layout breakage.

- [ ] **Step 5: Commit**

```bash
jj commit src/content/notes/2026-05-31-cq-wpx-cw-learning-weekend.md tests/site-content.test.mjs -m "Wire the CQ WPX note to its contact map"
```
