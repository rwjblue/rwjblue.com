# Contact Map DXCC Summary Design

## Goal

Upgrade POTA contact maps so field notes can show a compact DXCC entity summary
under the existing band legend. The summary should make mixed domestic and DX
logs easier to scan without cluttering ordinary single-entity activations.

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

## Skill Updates

This is primarily a map-system change, but two local skills should mention the
new behavior:

- `pota-contact-map-bootstrap`: generated JSON now includes DXCC summaries when
  ADIF has `DXCC`.
- `pota-field-report`: contact maps can surface DXCC summaries automatically,
  and authors do not need to maintain manual DXCC badge lists for normal field
  notes.

## Error Handling

- Missing or unknown `DXCC` on a contact should not prevent the contact from
  plotting.
- Unknown DXCC codes should be omitted from `dxccEntities` but may retain the
  raw `destinationDxccCode` on the contact if useful for debugging.
- Entity flags should come from `@ham2k/lib-dxcc-data`; do not hand-maintain a
  separate flag table.
- Existing contact-map JSON without `dxccEntities` must continue to render.

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
