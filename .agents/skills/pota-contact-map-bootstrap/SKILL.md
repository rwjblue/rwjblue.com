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

without committing the original log file.

## Workflow

1. Pick the note slug.
2. Generate the contact-map JSON:

```bash
mise run pota:contact-map:from-adi -- \
  --input <log.adi> \
  --output src/data/pota/contact-maps/<slug>.json \
  --title "N1RWJ at US-1234" \
  --subtitle "Park Name - 25 QSOs - May 27, 2026"
```

3. Import that JSON in `src/pages/notes/[slug].astro`.
4. Add the slug-to-map entry in the `contactMaps` object in that file.
5. Run `mise run check` and `mise run build`.

## Notes

- The generated JSON is the public artifact; do not commit the raw ADI unless
  there is a specific reason to keep it.
- The map uses Ham2K PoLo band colors for consistency with portable logging
  workflows.
