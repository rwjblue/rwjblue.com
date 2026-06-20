# Contact Map DXCC Summary Design

## Goal

Upgrade POTA contact maps so field notes can show a compact DXCC entity summary
under the existing band legend. The summary should make mixed domestic and DX
logs easier to scan without cluttering ordinary single-entity activations.

Also make contact-map generation reproducible by automatically archiving the
source ADIF files in the existing gitignored `data/pota/source-adi/` tree. A
future generator fix should be able to regenerate the checked-in JSON from the
same local source exports rather than depending on files left in Downloads or
iCloud Drive.

The initial motivating case is the June 19, 2026 Rhode Island-to-Florida rove
day-one note, where the map visually shows several DXCC entities but the current
UI only summarizes total QSOs and band counts.

## Current State

- `scripts/pota/render-contact-map.mjs` parses ADIF through the local Ham2K
  adapter and already receives `qso.their.dxccCode`.
- Generated contact-map JSON contains per-contact map placement data and band
  data, but grid-plotted contacts do not preserve DXCC metadata in the public
  artifact.
- `PotaContactMap.astro` derives a band-count legend from `map.contacts`.
- The current generator has a small hand-written DXCC centroid table for a few
  non-US locations.
- `.mise/tasks/pota/contact-map/from-adi` generates JSON from one ADIF input,
  but it does not archive that input. The gitignored
  `data/pota/source-adi/` convention exists for this purpose and currently holds
  some May 2026 exports.
- Some rove maps, including the June 19, 2026 day-one rove, are built from
  multiple ADIF exports that need to be merged in a stable order.
- Ham2K PoLo uses `@ham2k/lib-dxcc-data` for DXCC names, flags, prefixes, and
  entity coordinates. Its DXCC scoring summary is the source of the visual
  reference.

## Approach

Extend the contact-map pipeline rather than adding note-specific metadata.

1. Add `@ham2k/lib-dxcc-data` as a site dependency.
2. Use `DXCC_BY_CODE` in `scripts/pota/render-contact-map.mjs` to enrich every
   plottable contact with DXCC metadata when ADIF provides `DXCC`.
3. Replace the hand-written DXCC centroid fallback with entity `lat` and `lon`
   from `@ham2k/lib-dxcc-data`, keeping state and grid plotting precedence.
4. Generate a top-level `dxccEntities` array sorted by descending QSO count,
   then by entity name.
5. Render the summary in `PotaContactMap.astro` as a second compact legend row
   below the existing band legend.
6. Extend the contact-map generation task so it archives every source ADIF file
   before writing JSON.
7. Extend the generator to accept multiple ordered ADIF inputs for one map and
   merge them before building the contact-map data.

The preferred visual treatment is a quiet extension of the legend, not a large
achievement card. Example:

```text
40m 5   30m 1   20m 50
7 DXCC Entities   🇺🇸 United States (24)   🇨🇦 Canada   🇵🇷 Puerto Rico   🇮🇹 Italy
```

## Data Model

Each generated contact should retain its placement fields and add optional DXCC
fields:

```json
{
  "destinationDxccCode": 291,
  "destinationDxccName": "United States",
  "destinationDxccFlag": "🇺🇸"
}
```

The map root should add:

```json
{
  "originDxccCode": 291,
  "dxccEntities": [
    {
      "dxccCode": 291,
      "name": "United States",
      "flag": "🇺🇸",
      "count": 24
    }
  ]
}
```

`originDxccCode` should be inferred from the first QSO with `MY_DXCC` if the
parser is extended to support it. If `MY_DXCC` is unavailable, default to `291`
for N1RWJ-generated field-note maps because these maps currently represent US
POTA activations. Keep this explicit in the generator so the display rule is
testable and easy to revisit for non-US operations.

Generated map JSON should also record non-content source provenance so future
regeneration is discoverable:

```json
{
  "sourceAdi": [
    "data/pota/source-adi/2026/06/2026-06-19 N1RWJ at US-6991 Full.adi",
    "data/pota/source-adi/2026/06/2026-06-19 N1RWJ at US-1716 Full.adi",
    "data/pota/source-adi/2026/06/2026-06-19 N1RWJ at US-2149 Full.adi"
  ]
}
```

Do not embed raw ADIF content in the checked-in JSON.

## Source ADIF Archiving

`mise run pota:contact-map:from-adi` should archive input files automatically.
The task should:

- accept one or more `--input <adi>` flags, preserving command-line order;
- copy each input into `data/pota/source-adi/YYYY/MM/`, using the QSO date from
  the first real QSO in that file when available, and falling back to the input
  file modification date when no QSO date is available;
- preserve the original basename when practical;
- avoid silently overwriting an archived file with different content. If the
  target path exists with identical content, reuse it. If it exists with
  different content, add a deterministic suffix or fail with a clear message;
- pass the archived source paths into the generator so the checked-in JSON
  records `sourceAdi`.

For roves or other split logs, multiple archived inputs should be merged as one
operation. The merge should preserve ADIF record order within each file and
preserve the user's file order across files, then let the existing QSO timestamp
sort produce the final contact order.

## Display Rule

Hide the DXCC row when the only contacted entity is the same as the operating
entity. For example, a US-only map from a US activation should continue to show
only the QSO count and band legend.

Show the DXCC row when at least one contacted entity differs from the operating
entity. When shown, include all entities in the mix, including the operating
entity and its count.

If the operating entity is unknown, show the row only when the map has at least
two DXCC entities.

## Existing Map Refresh

After the generator changes, regenerate existing checked-in contact-map JSON
from available ADIF files where the source logs still exist locally.

For maps whose ADIF source is unavailable, keep the existing JSON valid and let
the component treat missing `dxccEntities` as "no DXCC row." Do not fabricate
entity summaries by reverse-geocoding grid squares or maintaining manual
frontmatter lists.

For the June 19, 2026 day-one rove, locate the three source ADI files from
iCloud Downloads or the local archive, run the multi-input generation flow, and
archive all three files under `data/pota/source-adi/2026/06/`.

## Skill Updates

This is primarily a map-system change, but two local skills should mention the
new behavior:

- `pota-contact-map-bootstrap`: generated JSON now includes DXCC summaries when
  ADIF has `DXCC`, and the generation task archives raw ADIF inputs
  automatically.
- `pota-field-report`: contact maps can surface DXCC summaries automatically,
  authors do not need to maintain manual DXCC badge lists for normal field
  notes, and source ADIF exports should be routed through the contact-map task
  instead of left in Downloads.

## Error Handling

- Missing or unknown `DXCC` on a contact should not prevent the contact from
  plotting.
- Unknown DXCC codes should be omitted from `dxccEntities` but may retain the
  raw `destinationDxccCode` on the contact if useful for debugging.
- Entity flags should come from `@ham2k/lib-dxcc-data`; do not hand-maintain a
  separate flag table.
- Existing contact-map JSON without `dxccEntities` must continue to render.
- Archiving failure should stop generation before writing a new JSON artifact,
  so checked-in map data is not updated without a reproducible local source.

## Testing

Add focused tests around the generator and component behavior:

- `buildContactMapData` preserves DXCC metadata for grid, state, and country
  plotted contacts.
- `dxccEntities` counts unique entities and sorts by count.
- A US-only US-origin map does not request DXCC summary rendering.
- A US-origin map with any non-US entity requests summary rendering and includes
  the United States when present.
- Country fallback uses `@ham2k/lib-dxcc-data` coordinates for known entities.
- `PotaContactMap.astro` renders a DXCC legend row guarded by the display rule.
- The task archives a single ADIF input under the expected `YYYY/MM/` directory.
- The task handles multiple ordered ADIF inputs and records all archived paths
  in `sourceAdi`.
- Existing archived inputs with identical content are reused without churn.
- Existing archived inputs with different content are handled without silent
  overwrite.

For implementation verification, run:

- `mise run check`
- `mise run build`
- Browser verification of an updated map at desktop and mobile widths.

## Out of Scope

- A site-wide DXCC awards tracker.
- Manual note frontmatter for DXCC entities.
- Reworking share-card DXCC achievements beyond preserving compatibility with
  generated contact maps.
- Changing map marker styling or line rendering.
