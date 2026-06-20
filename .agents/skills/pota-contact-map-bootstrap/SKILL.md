---
name: pota-contact-map-bootstrap
description: Bootstrap a checked-in POTA contact-map JSON file from an ADI log for a field note.
---

# POTA Contact Map Bootstrap

Use this when a field note has an ADI or ADIF export and needs the checked-in
JSON consumed by `PotaContactMap.astro`.

## Goal

Turn an ADI file into:

- `src/data/pota/contact-maps/<slug>.json`

while preserving the source log outside the public site data.

## Workflow

1. Pick the note slug.
2. Generate the contact-map JSON. The task archives the source ADIF under
   `data/pota/source-adi/YYYY/MM/` before writing the public JSON file.

```bash
slug="2026-06-19-rhode-island-to-florida-rove-day-one"
rockville_adi="$HOME/Downloads/2026-06-19 N1RWJ at US-6991 Full.adi"
pachaug_adi="$HOME/Downloads/2026-06-19 N1RWJ at US-1716 Full.adi"
sleepy_hollow_adi="$HOME/Downloads/2026-06-20 N1RWJ at US-2149 Full.adi"

mise run pota:contact-map:from-adi -- \
  --input "$rockville_adi" \
  --input "$pachaug_adi" \
  --input "$sleepy_hollow_adi" \
  --output "src/data/pota/contact-maps/${slug}.json" \
  --title "N1RWJ Rove to Florida Day One" \
  --subtitle "3 parks - 32 QSOs - June 19-20, 2026"
```

3. Import that JSON in `src/pages/notes/[slug].astro`.
4. Add the slug-to-map entry in the `contactMaps` object in that file.
5. Run `mise run check` and `mise run build`.

## Notes

- The task archives the source ADIF automatically and raw ADIF files remain
  gitignored.
- For split rove logs, repeat --input in operating order so the generated
  map preserves the activation sequence.
- The map uses Ham2K PoLo band colors for consistency with portable logging
  workflows.
