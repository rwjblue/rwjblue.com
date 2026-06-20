# Contact Map DXCC Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducible ADIF-backed contact-map generation with DXCC summaries and a compact DXCC legend row.

**Architecture:** Keep `scripts/pota/render-contact-map.mjs` as the contact-map data pipeline and add focused helpers for DXCC enrichment, source archiving, and multi-input merging. Keep `PotaContactMap.astro` as a pure renderer that consumes generated JSON and decides whether the DXCC row should be visible from explicit map metadata.

**Tech Stack:** Astro, Node ESM scripts, `node:test`, mise file tasks, `@ham2k/lib-dxcc-data`, Leaflet.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add `@ham2k/lib-dxcc-data`.
- Modify `scripts/pota/ham2k-qson-adif.mjs`: parse `MY_DXCC` into `qso.our.dxccCode`.
- Modify `scripts/pota/render-contact-map.mjs`: accept repeated `--input`, archive inputs, merge ADIF content, enrich contacts with DXCC data, add `sourceAdi`, and expose testable helpers.
- Modify `tests/pota-contact-map.test.mjs`: cover parser, DXCC summaries, country fallback, archiving, multi-input support, and UI source checks.
- Modify `src/components/PotaContactMap.astro`: add DXCC entity types, compute row visibility, render the A-style legend extension.
- Modify `src/styles/global.css`: add small styling for the DXCC legend row and flag/name tokens.
- Modify `.agents/skills/pota-contact-map-bootstrap/SKILL.md`: document auto-archiving and repeated `--input`.
- Modify `.agents/skills/pota-field-report/SKILL.md`: steer field-note authors through the archiving generation task.
- Regenerate available `src/data/pota/contact-maps/*.json` from archived ADIF inputs, including the June 19 day-one rove once its three ADI files are located.

### Design Boundaries

- The generator owns all DXCC data derivation. Astro should not infer DXCC from grids or callsigns.
- The raw ADIF archive remains gitignored; checked-in JSON records only source paths.
- Missing legacy `dxccEntities` data must render as before.
- The UI row is hidden for home-entity-only maps and shown for mixed-entity maps.

---

### Task 1: Add DXCC Dependency And Parse Operating DXCC

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/pota/ham2k-qson-adif.mjs`
- Modify: `tests/pota-contact-map.test.mjs`

- [ ] **Step 1: Add a failing parser assertion**

Append this assertion to the existing `parseAdif extracts records and fields` test in `tests/pota-contact-map.test.mjs` after the `qson.qsos[0].our.grid` assertion:

```js
  assert.equal(qson.qsos[0].our.dxccCode, 291);
```

Update the first `sampleAdif` record so it includes `MY_DXCC`:

```adif
<CALL:4>GRID <BAND:3>40m <QSO_DATE:8>20260527 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41dx97 <MY_DXCC:3>291 <GRIDSQUARE:6>EM86sn <DXCC:3>291 <STATE:2>TN <EOR>
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: FAIL with an assertion showing `undefined !== 291` for `qson.qsos[0].our.dxccCode`.

- [ ] **Step 3: Parse `MY_DXCC`**

In `scripts/pota/ham2k-qson-adif.mjs`, add this line after the existing `my_gridsquare` parse:

```js
    condSet(adifQSO, qso.our, "my_dxcc", "dxccCode", (value) => parseInt(value, 10));
```

- [ ] **Step 4: Install the DXCC data dependency**

Run:

```bash
npm install @ham2k/lib-dxcc-data@1.0.1
```

Expected: `package.json` gains `@ham2k/lib-dxcc-data` under `dependencies`, and `package-lock.json` gains the resolved package entry.

- [ ] **Step 5: Verify the parser test passes**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: PASS for all existing contact-map tests.

- [ ] **Step 6: Commit**

Run:

```bash
jj commit -m "Add DXCC data dependency and parse MY_DXCC"
```

---

### Task 2: Enrich Contact Map Data With DXCC Summaries

**Files:**
- Modify: `scripts/pota/render-contact-map.mjs`
- Modify: `tests/pota-contact-map.test.mjs`

- [ ] **Step 1: Add failing DXCC summary tests**

Update the import list in `tests/pota-contact-map.test.mjs`:

```js
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
```

Add this test after the rove fallback test:

```js
const mixedDxccAdif = `
<ADIF_VER:5>3.1.5
<EOH>
<CALL:3>US1 <BAND:3>20m <QSO_DATE:8>20260619 <TIME_ON:6>130000 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41cm81 <MY_DXCC:3>291 <GRIDSQUARE:6>EN82cr <DXCC:3>291 <STATE:2>MI <EOR>
<CALL:3>US2 <BAND:3>20m <QSO_DATE:8>20260619 <TIME_ON:6>130100 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41cm81 <MY_DXCC:3>291 <GRIDSQUARE:6>EM90hf <DXCC:3>291 <STATE:2>FL <EOR>
<CALL:2>VE <BAND:3>20m <QSO_DATE:8>20260619 <TIME_ON:6>130200 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41cm81 <MY_DXCC:3>291 <DXCC:1>1 <EOR>
<CALL:1>I <BAND:3>20m <QSO_DATE:8>20260619 <TIME_ON:6>130300 <STATION_CALLSIGN:5>N1RWJ <MY_GRIDSQUARE:8>FN41cm81 <MY_DXCC:3>291 <GRIDSQUARE:6>JN61fw <DXCC:3>248 <EOR>
`;

test("buildContactMapData preserves DXCC metadata and summarizes entities", () => {
  const map = buildContactMapData(mixedDxccAdif, {
    title: "DXCC map",
    subtitle: "DXCC subtitle",
    sourceAdi: ["data/pota/source-adi/2026/06/sample.adi"],
  });

  assert.equal(map.originDxccCode, 291);
  assert.deepEqual(map.sourceAdi, ["data/pota/source-adi/2026/06/sample.adi"]);
  assert.equal(map.contacts[0].destinationDxccCode, 291);
  assert.equal(map.contacts[0].destinationDxccName, "United States");
  assert.equal(map.contacts[0].destinationDxccFlag, "🇺🇸");
  assert.equal(map.contacts[2].destinationDxccCode, 1);
  assert.equal(map.contacts[2].destinationDxccName, "Canada");
  assert.equal(map.contacts[2].destinationDxccFlag, "🇨🇦");
  assert.deepEqual(map.dxccEntities, [
    { dxccCode: 291, name: "United States", flag: "🇺🇸", count: 2 },
    { dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 1 },
    { dxccCode: 248, name: "Italy", flag: "🇮🇹", count: 1 },
  ]);
  assert.equal(shouldRenderDxccSummary(map), true);
});

test("DXCC summary hides home-only maps and shows mixed maps", () => {
  assert.equal(
    shouldRenderDxccSummary({
      originDxccCode: 291,
      dxccEntities: [{ dxccCode: 291, name: "United States", flag: "🇺🇸", count: 3 }],
    }),
    false,
  );
  assert.equal(
    shouldRenderDxccSummary({
      originDxccCode: 291,
      dxccEntities: [
        { dxccCode: 291, name: "United States", flag: "🇺🇸", count: 3 },
        { dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 1 },
      ],
    }),
    true,
  );
  assert.equal(
    shouldRenderDxccSummary({
      dxccEntities: [{ dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 1 }],
    }),
    false,
  );
  assert.equal(
    shouldRenderDxccSummary({
      dxccEntities: [
        { dxccCode: 1, name: "Canada", flag: "🇨🇦", count: 1 },
        { dxccCode: 248, name: "Italy", flag: "🇮🇹", count: 1 },
      ],
    }),
    true,
  );
});

test("countryToLatLon uses Ham2K DXCC coordinates", () => {
  assert.deepEqual(countryToLatLon("230"), { lat: 51.3, lon: 9.7 });
  assert.equal(countryToLatLon("999999"), null);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: FAIL because `collectDxccEntities`, `shouldRenderDxccSummary`, and the new DXCC fields are not implemented.

- [ ] **Step 3: Implement DXCC helpers and replace `DXCC_CENTROIDS`**

At the top of `scripts/pota/render-contact-map.mjs`, add:

```js
import { DXCC_BY_CODE } from "@ham2k/lib-dxcc-data";
```

Replace the `DXCC_CENTROIDS` object and `countryToLatLon` with:

```js
export function dxccEntityForCode(dxcc) {
  if (!dxcc) {
    return null;
  }

  return DXCC_BY_CODE[String(dxcc)] ?? DXCC_BY_CODE[Number.parseInt(dxcc, 10)] ?? null;
}

export function countryToLatLon(dxcc) {
  const entity = dxccEntityForCode(dxcc);

  if (!entity || typeof entity.lat !== "number" || typeof entity.lon !== "number") {
    return null;
  }

  return { lat: entity.lat, lon: entity.lon };
}

export function collectDxccEntities(contacts) {
  const counts = new Map();

  for (const contact of contacts) {
    const entity = dxccEntityForCode(contact.destinationDxccCode);
    if (!entity) {
      continue;
    }

    const dxccCode = entity.dxccCode;
    const current = counts.get(dxccCode) ?? {
      dxccCode,
      name: entity.name,
      flag: entity.flag,
      count: 0,
    };
    current.count += 1;
    counts.set(dxccCode, current);
  }

  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return a.name.localeCompare(b.name);
  });
}

export function shouldRenderDxccSummary(map) {
  const entities = map?.dxccEntities ?? [];
  if (entities.length < 1) {
    return false;
  }

  if (!map.originDxccCode) {
    return entities.length >= 2;
  }

  return entities.some((entity) => String(entity.dxccCode) !== String(map.originDxccCode));
}
```

- [ ] **Step 4: Add DXCC metadata in `buildContactMapData`**

Inside the contact mapping callback, after `destinationCountry` is declared, add:

```js
      const destinationDxcc = dxccEntityForCode(destinationCountry);
```

After the existing `destinationCountry` field handling, add:

```js
      if (destinationCountry) {
        contact.destinationDxccCode = Number.parseInt(destinationCountry, 10);
      }

      if (destinationDxcc) {
        contact.destinationDxccName = destinationDxcc.name;
        contact.destinationDxccFlag = destinationDxcc.flag;
      }
```

Change the `buildContactMapData` signature:

```js
export function buildContactMapData(content, { title, subtitle, sourceAdi = [] } = {}) {
```

Before the return statement, add:

```js
  const originDxccCode = firstQso?.our?.dxccCode ?? 291;
  const dxccEntities = collectDxccEntities(contacts);
```

Add these fields to the returned object:

```js
    originDxccCode,
    dxccEntities,
    sourceAdi,
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: PASS for all contact-map tests.

- [ ] **Step 6: Commit**

Run:

```bash
jj commit -m "Add DXCC summaries to contact map data"
```

---

### Task 3: Archive Source ADIF And Support Multiple Inputs

**Files:**
- Modify: `scripts/pota/render-contact-map.mjs`
- Modify: `tests/pota-contact-map.test.mjs`

- [ ] **Step 1: Add failing archive and multi-input tests**

Update the test imports at the top:

```js
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
```

Add `archiveSourceAdif`, `buildContactMapDataFromInputs`, and `parseArgs` to the script import list:

```js
  archiveSourceAdif,
  buildContactMapDataFromInputs,
  parseArgs,
```

Add these tests near the other generator tests:

```js
test("parseArgs accepts multiple ordered input flags", () => {
  assert.deepEqual(
    parseArgs([
      "--input",
      "first.adi",
      "--input",
      "second.adi",
      "--output",
      "out.json",
      "--title",
      "Merged",
      "--subtitle",
      "Two inputs",
    ]),
    {
      inputs: ["first.adi", "second.adi"],
      output: "out.json",
      title: "Merged",
      subtitle: "Two inputs",
    },
  );
});

test("archiveSourceAdif copies input into date-based archive and reuses identical files", async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "contact-map-archive-"));
  const input = path.join(tempRoot, "2026-06-19 N1RWJ at US-6991 Full.adi");
  writeFileSync(input, sampleAdif, "utf8");

  const first = await archiveSourceAdif(input, {
    archiveRoot: path.join(tempRoot, "archive"),
  });
  const second = await archiveSourceAdif(input, {
    archiveRoot: path.join(tempRoot, "archive"),
  });

  assert.equal(first, second);
  assert.match(first, /2026\/05\/2026-06-19 N1RWJ at US-6991 Full\.adi$/);
  assert.equal(readFileSync(first, "utf8"), sampleAdif);

  rmSync(tempRoot, { recursive: true, force: true });
});

test("archiveSourceAdif avoids silent overwrite for different content", async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "contact-map-archive-"));
  const archiveRoot = path.join(tempRoot, "archive");
  const inputA = path.join(tempRoot, "same-name.adi");
  const inputB = path.join(tempRoot, "nested", "same-name.adi");
  writeFileSync(inputA, sampleAdif, "utf8");
  writeFileSync(inputB, roveAdif, "utf8");

  const first = await archiveSourceAdif(inputA, { archiveRoot });
  const second = await archiveSourceAdif(inputB, { archiveRoot });

  assert.notEqual(first, second);
  assert.match(second, /same-name-2\.adi$/);
  assert.equal(readFileSync(first, "utf8"), sampleAdif);
  assert.equal(readFileSync(second, "utf8"), roveAdif);

  rmSync(tempRoot, { recursive: true, force: true });
});

test("buildContactMapDataFromInputs merges archived inputs and records source paths", async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "contact-map-inputs-"));
  const first = path.join(tempRoot, "first.adi");
  const second = path.join(tempRoot, "second.adi");
  writeFileSync(first, sampleAdif, "utf8");
  writeFileSync(second, roveAdif, "utf8");

  const map = await buildContactMapDataFromInputs([first, second], {
    archiveRoot: path.join(tempRoot, "archive"),
    title: "Merged map",
    subtitle: "Merged subtitle",
  });

  assert.equal(map.contacts.length, 6);
  assert.equal(map.sourceAdi.length, 2);
  assert.ok(map.sourceAdi.every((source) => statSync(source).isFile()));

  rmSync(tempRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: FAIL because the archive and multi-input functions are not exported.

- [ ] **Step 3: Export and update `parseArgs`**

Change `function parseArgs(argv)` to:

```js
export function parseArgs(argv) {
  const options = {
    inputs: [],
    title: "Contact map",
    subtitle: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--input":
        options.inputs.push(argv[++i]);
        break;
      case "--output":
        options.output = argv[++i];
        break;
      case "--title":
        options.title = argv[++i];
        break;
      case "--subtitle":
        options.subtitle = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.inputs.length === 0 || !options.output) {
    throw new Error("At least one --input and --output are required.");
  }

  return options;
}
```

Update `usage()` so the input line reads:

```text
    --input FILE [--input FILE ...] \\
```

- [ ] **Step 4: Add archive helpers**

Add these helpers before `buildContactMapData`:

```js
function yyyymmddFromQson(qson) {
  const qso = qson.qsos.find((entry) => entry.startAt || entry.endAt);
  return (qso?.startAt ?? qso?.endAt)?.slice(0, 10).replaceAll("-", "") ?? null;
}

async function fileMtimeDate(inputPath) {
  const stat = await fs.stat(inputPath);
  const date = new Date(stat.mtime);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function archivePathForDate(archiveRoot, yyyymmdd, basename) {
  return path.join(archiveRoot, yyyymmdd.slice(0, 4), yyyymmdd.slice(4, 6), basename);
}

async function sameFileContent(pathA, pathB) {
  try {
    const [a, b] = await Promise.all([fs.readFile(pathA), fs.readFile(pathB)]);
    return a.equals(b);
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function uniqueArchivePath(targetPath, inputPath) {
  if (await sameFileContent(targetPath, inputPath)) {
    return targetPath;
  }

  const parsed = path.parse(targetPath);
  for (let index = 2; index < 100; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (await sameFileContent(candidate, inputPath)) {
      return candidate;
    }

    try {
      await fs.access(candidate);
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }

  throw new Error(`Unable to choose a unique archive path for ${inputPath}`);
}

export async function archiveSourceAdif(inputPath, { archiveRoot = "data/pota/source-adi" } = {}) {
  const content = await fs.readFile(inputPath, "utf8");
  const qson = parseAdif(content);
  const date = yyyymmddFromQson(qson) ?? await fileMtimeDate(inputPath);
  const targetPath = archivePathForDate(archiveRoot, date, path.basename(inputPath));
  const finalPath = await uniqueArchivePath(targetPath, inputPath);

  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  if (!(await sameFileContent(finalPath, inputPath))) {
    await fs.copyFile(inputPath, finalPath);
  }

  return finalPath;
}
```

- [ ] **Step 5: Add multi-input builder**

Add this function after `buildContactMapData`:

```js
export async function buildContactMapDataFromInputs(inputs, options = {}) {
  const archivedSources = [];
  const contents = [];

  for (const input of inputs) {
    const archived = await archiveSourceAdif(input, {
      archiveRoot: options.archiveRoot,
    });
    archivedSources.push(archived);
    contents.push(await fs.readFile(archived, "utf8"));
  }

  return buildContactMapData(contents.join("\n"), {
    title: options.title,
    subtitle: options.subtitle,
    sourceAdi: archivedSources,
  });
}
```

- [ ] **Step 6: Update `main()` to use repeated inputs**

Replace the first `main()` lines through `buildContactMapData` with:

```js
  const options = parseArgs(process.argv.slice(2));
  const mapData = await buildContactMapDataFromInputs(options.inputs, {
    title: options.title,
    subtitle: options.subtitle,
  });
```

- [ ] **Step 7: Run the focused test and verify it passes**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: PASS for all contact-map tests.

- [ ] **Step 8: Commit**

Run:

```bash
jj commit -m "Archive contact map ADIF sources"
```

---

### Task 4: Render The DXCC Legend Row

**Files:**
- Modify: `src/components/PotaContactMap.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/pota-contact-map.test.mjs`

- [ ] **Step 1: Add failing UI source checks**

Extend the `contact map UI uses QSO summary and omits state fallback legend copy` test with:

```js
  assert.match(componentSource, /shouldRenderDxccSummary\(map\)/);
  assert.match(componentSource, /contact-map-dxcc/);
  assert.match(componentSource, /DXCC Entities/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: FAIL because the component does not render DXCC summary markup yet.

- [ ] **Step 3: Add DXCC types and rendering helpers**

In `src/components/PotaContactMap.astro`, add:

```ts
interface ContactMapDxccEntity {
  dxccCode: number;
  name: string;
  flag?: string;
  count: number;
}
```

Add fields to `ContactMapData`:

```ts
  originDxccCode?: number;
  dxccEntities?: ContactMapDxccEntity[];
```

Add helper functions before `const { map }`:

```ts
function shouldRenderDxccSummary(map: ContactMapData) {
  const entities = map.dxccEntities ?? [];
  if (entities.length < 1) {
    return false;
  }

  if (!map.originDxccCode) {
    return entities.length >= 2;
  }

  return entities.some((entity) => String(entity.dxccCode) !== String(map.originDxccCode));
}

function formatDxccCount(entity: ContactMapDxccEntity) {
  return entity.count > 1 ? ` (${entity.count})` : "";
}
```

- [ ] **Step 4: Render the row below the band legend**

After the existing `.contact-map-legend` `div`, add:

```astro
  {
    shouldRenderDxccSummary(map) && (
      <div class="contact-map-dxcc" aria-label="DXCC entity summary">
        <span class="contact-map-dxcc-heading">{map.dxccEntities?.length} DXCC Entities</span>
        {
          map.dxccEntities?.map((entity) => (
            <span class="contact-map-dxcc-entity">
              {entity.flag && <span class="contact-map-dxcc-flag" aria-hidden="true">{entity.flag}</span>}
              <span>{entity.name}{formatDxccCount(entity)}</span>
            </span>
          ))
        }
      </div>
    )
  }
```

- [ ] **Step 5: Add compact styling**

In `src/styles/global.css`, after `.contact-map-legend i`, add:

```css
.contact-map-dxcc {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  padding-top: 8px;
  color: var(--muted);
  font-size: 0.86rem;
}

.contact-map-dxcc-heading,
.contact-map-dxcc-entity {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.contact-map-dxcc-heading {
  color: var(--ink);
  font-weight: 900;
}

.contact-map-dxcc-entity {
  font-weight: 700;
}

.contact-map-dxcc-flag {
  font-size: 1rem;
  line-height: 1;
}
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```bash
mise run test -- tests/pota-contact-map.test.mjs
```

Expected: PASS for all contact-map tests.

- [ ] **Step 7: Commit**

Run:

```bash
jj commit -m "Render DXCC summaries on contact maps"
```

---

### Task 5: Refresh Available Maps And Locate June 19 Sources

**Files:**
- Modify: `src/data/pota/contact-maps/*.json` for maps whose ADIF source is available
- Add gitignored files under `data/pota/source-adi/2026/06/`

- [ ] **Step 1: List archived sources and current contact maps**

Run:

```bash
find data/pota/source-adi -maxdepth 4 -type f | sort
find src/data/pota/contact-maps -maxdepth 1 -name '*.json' | sort
```

Expected: existing May ADIF files are listed; current map JSON files are listed.

- [ ] **Step 2: Regenerate May maps from archived files**

Run the matching generation commands for archived May files:

```bash
mise run pota:contact-map:from-adi -- \
  --input "data/pota/source-adi/2026/05/2026-05-25 N1RWJ Rove - Full.adi" \
  --output "src/data/pota/contact-maps/2026-05-25-pota-rove.json" \
  --title "N1RWJ POTA Rove" \
  --subtitle "Rhode Island coast - 40 QSOs - May 25, 2026"

mise run pota:contact-map:from-adi -- \
  --input "data/pota/source-adi/2026/05/2026-05-27 N1RWJ at US-6984 Full.adi" \
  --output "src/data/pota/contact-maps/2026-05-27-black-hut-wildlife-management-area-pota.json" \
  --title "N1RWJ at US-6984" \
  --subtitle "Black Hut Wildlife Management Area - 11 QSOs - May 27, 2026"

mise run pota:contact-map:from-adi -- \
  --input "data/pota/source-adi/2026/05/2026-05-29 N1RWJ at US-7715 Full.adi" \
  --output "src/data/pota/contact-maps/2026-05-29-durfee-hill-wildlife-management-area-pota.json" \
  --title "N1RWJ at US-7715" \
  --subtitle "Durfee Hill Wildlife Management Area - 13 QSOs - May 29, 2026"

mise run pota:contact-map:from-adi -- \
  --input "data/pota/source-adi/2026/05/2026 CQ WPX CW.adi" \
  --output "src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json" \
  --title "CQ WPX CW Learning Weekend" \
  --subtitle "N1RWJ - 37 QSOs - May 30-31, 2026"

mise run pota:contact-map:from-adi -- \
  --input "data/pota/source-adi/2026/05/2026-05-31 N1RWJ at US-8293 Full.adi" \
  --output "src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json" \
  --title "CQ WPX CW Learning Weekend" \
  --subtitle "N1RWJ - 37 QSOs - May 30-31, 2026"
```

After running the commands, inspect the diff and keep only map JSON changes that correspond to the intended source file. If two commands target the same output and produce conflicting content, keep the command that matches the note's actual source log and record the mismatch in the final implementation notes.

- [ ] **Step 3: Locate June 19 day-one ADI files**

Run this shell block to locate and validate the three source files:

```bash
SEARCH_ROOTS=(
  "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads"
  "$HOME/Downloads"
)

ROCKVILLE_ADI="$(
  find "${SEARCH_ROOTS[@]}" -type f \
    \( -iname '*US-6991*.adi' -o -iname '*US-6991*.adif' -o -iname '*Rockville*.adi' -o -iname '*Rockville*.adif' \) \
    2>/dev/null | sort | head -1
)"
SILVER_SANDS_ADI="$(
  find "${SEARCH_ROOTS[@]}" -type f \
    \( -iname '*US-1716*.adi' -o -iname '*US-1716*.adif' -o -iname '*Silver*Sands*.adi' -o -iname '*Silver*Sands*.adif' \) \
    2>/dev/null | sort | head -1
)"
TALLMAN_ADI="$(
  find "${SEARCH_ROOTS[@]}" -type f \
    \( -iname '*US-2149*.adi' -o -iname '*US-2149*.adif' -o -iname '*Tallman*.adi' -o -iname '*Tallman*.adif' \) \
    2>/dev/null | sort | head -1
)"

test -n "$ROCKVILLE_ADI"
test -n "$SILVER_SANDS_ADI"
test -n "$TALLMAN_ADI"
printf 'Rockville: %s\nSilver Sands: %s\nTallman: %s\n' \
  "$ROCKVILLE_ADI" "$SILVER_SANDS_ADI" "$TALLMAN_ADI"
```

Expected: three files for Rockville `US-6991`, Silver Sands `US-1716`, and Tallman Mountain `US-2149`.

- [ ] **Step 4: Regenerate the June 19 day-one map from three ordered inputs**

Run the command with the variables from Step 3 in operating order:

```bash
mise run pota:contact-map:from-adi -- \
  --input "$ROCKVILLE_ADI" \
  --input "$SILVER_SANDS_ADI" \
  --input "$TALLMAN_ADI" \
  --output "src/data/pota/contact-maps/2026-06-19-rhode-island-to-florida-rove-day-one.json" \
  --title "N1RWJ Rove Day 1" \
  --subtitle "Rockville, Silver Sands, and Tallman Mountain - 56 QSOs - June 19-20, 2026"
```

Expected: output JSON has `sourceAdi` with three archived files under `data/pota/source-adi/2026/06/`, `dxccEntities` with the mixed-entity summary, and 56 contacts.

- [ ] **Step 5: Inspect regenerated map diffs**

Run:

```bash
jj diff src/data/pota/contact-maps
```

Expected: regenerated JSON adds `originDxccCode`, `dxccEntities`, per-contact DXCC metadata, and `sourceAdi`. Contact counts and titles remain correct.

- [ ] **Step 6: Commit**

Run:

```bash
jj commit -m "Refresh contact maps with DXCC metadata"
```

---

### Task 6: Update Local Skills

**Files:**
- Modify: `.agents/skills/pota-contact-map-bootstrap/SKILL.md`
- Modify: `.agents/skills/pota-field-report/SKILL.md`
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Add failing skill-content checks**

In `tests/site-content.test.mjs`, in the existing `pota image sanitizer and contact-map bootstrap are available as file-based mise tasks` test, add:

```js
  assert.match(bootstrapSkill, /archives the source ADIF/);
  assert.match(bootstrapSkill, /repeat --input/);
  assert.match(skill, /archives the source ADIF/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
mise run test -- tests/site-content.test.mjs
```

Expected: FAIL because the skills do not mention archiving or repeated inputs.

- [ ] **Step 3: Update `pota-contact-map-bootstrap`**

Replace the workflow command description with this text:

```markdown
2. Generate the contact-map JSON. The task archives the source ADIF under
   `data/pota/source-adi/YYYY/MM/` before writing JSON. For split rove logs,
   repeat `--input` in operating order. Example for a three-stop rove:

```bash
FIRST_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-6991 Full.adi"
SECOND_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-1716 Full.adi"
THIRD_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-2149 Full.adi"

mise run pota:contact-map:from-adi -- \
  --input "$FIRST_ADI" \
  --input "$SECOND_ADI" \
  --input "$THIRD_ADI" \
  --output src/data/pota/contact-maps/2026-06-19-rhode-island-to-florida-rove-day-one.json \
  --title "N1RWJ Rove Day 1" \
  --subtitle "Rockville, Silver Sands, and Tallman Mountain - 56 QSOs - June 19-20, 2026"
```
```

Add this bullet under Notes:

```markdown
- The task archives the source ADIF automatically. Do not manually copy a
  second copy into the archive unless the task fails before archiving.
```

- [ ] **Step 4: Update `pota-field-report`**

In the contact-map section, replace the current single-input example with:

```markdown
The contact-map task archives the source ADIF automatically and writes the
public JSON artifact. For split rove logs, repeat `--input` in operating order:

```bash
FIRST_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-6991 Full.adi"
SECOND_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-1716 Full.adi"
THIRD_ADI="$HOME/Downloads/2026-06-19 N1RWJ at US-2149 Full.adi"

mise run pota:contact-map:from-adi -- \
  --input "$FIRST_ADI" \
  --input "$SECOND_ADI" \
  --input "$THIRD_ADI" \
  --output src/data/pota/contact-maps/2026-06-19-rhode-island-to-florida-rove-day-one.json \
  --title "N1RWJ Rove Day 1" \
  --subtitle "Rockville, Silver Sands, and Tallman Mountain - 56 QSOs - June 19-20, 2026"
```
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
mise run test -- tests/site-content.test.mjs
```

Expected: PASS for site-content tests.

- [ ] **Step 6: Commit**

Run:

```bash
jj commit -m "Document archived ADIF contact map workflow"
```

---

### Task 7: Full Verification And Browser Check

**Files:**
- No planned source edits unless verification finds a concrete defect.

- [ ] **Step 1: Run all tests**

Run:

```bash
mise run test
```

Expected: PASS.

- [ ] **Step 2: Run Astro validation**

Run:

```bash
mise run check
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
mise run build
```

Expected: PASS and `dist/` is generated.

- [ ] **Step 4: Start the dev server**

Run:

```bash
mise run dev -- --host 127.0.0.1
```

Expected: Astro reports a localhost URL, usually `http://127.0.0.1:4321/`.

- [ ] **Step 5: Verify the June 19 note visually**

Open:

```text
http://127.0.0.1:4321/notes/2026-06-19-rhode-island-to-florida-rove-day-one/
```

Check desktop width around `1440x1000`:

- map renders;
- band legend remains first row;
- DXCC row appears below it;
- United States is included when other entities are present;
- row does not overlap the map or surrounding text.

Check mobile width around `390x844`:

- DXCC row wraps cleanly;
- flags and labels remain readable;
- no horizontal overflow.

- [ ] **Step 6: Verify a US-only note visually**

Open a note whose regenerated map has only United States contacts:

```text
http://127.0.0.1:4321/notes/2026-05-27-black-hut-wildlife-management-area-pota/
```

Check:

- map renders;
- band legend renders;
- DXCC row is hidden.

- [ ] **Step 7: Stop the dev server**

Stop the running dev server with `Ctrl-C` in its terminal session.

- [ ] **Step 8: Commit verification fixes if needed**

If verification required source fixes, run:

```bash
jj commit -m "Polish contact map DXCC verification issues"
```

If no source fixes were needed, do not create an empty verification commit.

---

## Completion Criteria

- `@ham2k/lib-dxcc-data` is installed and used for DXCC names, flags, and coordinates.
- Contact-map JSON generated from ADIF includes per-contact DXCC metadata, `originDxccCode`, `dxccEntities`, and `sourceAdi`.
- Repeated `--input` works and archives every source ADIF under `data/pota/source-adi/YYYY/MM/`.
- Existing archived ADIF files are reused when identical and not silently overwritten when different.
- `PotaContactMap.astro` renders a compact DXCC legend row only for mixed-entity maps.
- June 19 day-one rove map is regenerated from three ordered ADI files if those files are located.
- `mise run test`, `mise run check`, and `mise run build` pass.
- Desktop and mobile browser checks pass for mixed-entity and home-only maps.
