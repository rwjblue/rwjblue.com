# POTA Data

Rhode Island reference metadata and reviewed display geometry come from the
versioned `@ripota/parks` package. The dependency is pinned to an immutable
GitHub release asset in `package.json` and `package-lock.json`; do not fetch or
hand-edit a second Rhode Island park inventory in this repository.

`src/lib/pota/ri-park-source.ts` adapts the package for the site. It combines
the stable package metadata with a small, generated public-statistics cache at
`data/pota/ri/cache/public-stats.json`. Refreshing those counters verifies that
the live POTA API still has the same reference inventory and core metadata as
the pinned package. A mismatch stops the refresh so the shared dataset can be
updated and released first.

The other durable and generated layers remain local:

- `data/pota/ri/activations.json` is the N1RWJ activation ledger.
- `data/pota/ri/cache/profile-N1RWJ.json` and `cache/activations/` are API
  response caches used to maintain the ledger.
- `data/pota/parks/cache/` contains metadata only for non-Rhode Island parks.
- `src/data/pota/ri-tracker.json` and `src/data/pota/parks.json` are generated
  site data and should not be edited by hand.

Canonical Rhode Island park pages embed the package's reviewed display
geometry at build time. The geometry does not enter the shared browser bundle,
and non-Rhode Island pages keep their existing point maps. Where the package
provides a reviewed `mapPoint`, map consumers use it for presentation while
retaining the official POTA latitude and longitude as source metadata.

Run `mise run pota:update` after a profile, activation, or field-note change.
Use `--full-backfill` when historical RI activation data also needs refreshing.
For a new or changed Rhode Island reference, update and release
`ripota/parks`, bump the pinned release URL here, run `npm install`, and then
run the normal POTA update workflow. Non-RI field notes can continue to use
`mise run pota:park:ensure -- US-1234` before the update.
