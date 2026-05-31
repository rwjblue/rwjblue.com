# Source ADI Archive

This directory is the local archive for source `ADI` / `ADIF` exports used to
generate checked-in contact-map JSON files.

The archive is intentionally kept in the repo working tree for convenience, but
the log files themselves are ignored by git.

Suggested layout:

- `YYYY/MM/` for ordinary single-activation exports
- keep the original export filename when practical
- prefer `Full.adi` exports over limited exports

Current convention notes:

- A rove may be represented by a single `Full.adi` export that includes multiple
  park stops and break markers.
- Checked-in map JSON should continue to live under
  `src/data/pota/contact-maps/`.
- Regeneration should read from this archive rather than ad hoc download
  locations once the relevant export has been copied here.
