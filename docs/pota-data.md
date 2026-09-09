# POTA Data

Rhode Island reference metadata and reviewed display geometry come from the
versioned `@ripota/parks` package. The dependency is pinned to an immutable
GitHub release asset in `package.json` and `package-lock.json`; do not fetch or
hand-edit a second Rhode Island park inventory in this repository.

The v4 package root exports `parks` and `getPark(reference)`, with POTA identity
and practical visitor information on each park. The old root `references` and
`getReference` exports have been removed; identity-only `PotaReference` remains
available from `@ripota/parks/types`.

The same visitor metadata is available without npm in the
[v4.0.0 standalone parks.json](https://github.com/ripota/parks/releases/download/v4.0.0/parks.json)
release asset.

`src/lib/pota/ri-park-source.ts` adapts the package for the site. It explicitly
projects the eight identity fields before combining them with the generated
public-statistics cache at
`data/pota/ri/cache/public-stats.json`. Refreshing those counters verifies that
the live POTA API still has the same reference inventory and core metadata as
the pinned package. The package's `diffReferences` API normalizes inventory
comparisons and reports duplicates and invalid reference IDs as well as metadata
drift. A mismatch stops the refresh so the shared dataset can be updated and
released first.

The other durable and generated layers remain local:

- `data/pota/ri/activations.json` is the N1RWJ activation ledger.
- `data/pota/ri/cache/profile-N1RWJ.json` and `cache/activations/` are API
  response caches used to maintain the ledger.
- `data/pota/parks/cache/` contains metadata only for non-Rhode Island parks.
- `src/data/pota/ri-tracker.json` and `src/data/pota/parks.json` are generated
  site data and should not be edited by hand.

Canonical Rhode Island park pages embed the package's `boundaries-web/*`
geometry at build time through `src/lib/pota/ri-park-geometry.ts`. These smaller
map artifacts preserve disconnected parcels and holes, and keep activation-zone
coordinates unchanged. Detailed and source artifacts remain available in the
package for closer inspection. The geometry does not enter the shared browser
bundle, and non-Rhode Island pages keep their existing point maps. The adapter uses
`@ripota/parks/display` for reviewed presentation points without importing the
full geometry catalog. Map consumers retain the official POTA latitude and
longitude as source metadata. The current inventory has no research-needed
references, so it does not require the opt-in schema-v3 fallback catalog.

Canonical Rhode Island park pages also read `getPark` at build time for the park
type, manager, official website, orange clothing guidance, documented amenities,
access details, and setup notes. These details stay out of generated tracker and
park-page JSON and out of the browser map payload. Non-RI pages retain their
existing locally cached information. Orange guidance displays its season and
source rather than making a live requirement calculation, and the page links to
the manager for current notices. An unlisted amenity is not a claim that it is
absent.

Orange guidance remains available year-round in a native disclosure. In the
browser, Rhode Island's current date (`America/New_York`) expands and emphasizes
required, recommended, and area-dependent guidance from August 15 through May 31.
From June 1 through August 14 it starts collapsed with quiet styling; parks with
no general requirement stay quiet all year. The page checks on load, when the tab
becomes visible, and every minute, updating only when the seasonal state changes
so visitors can freely open or close the disclosure. This needs no rebuild and
does not alter the package's actual seasons or rules.

Run `mise run pota:update` after a profile, activation, or field-note change.
Use `--full-backfill` when historical RI activation data also needs refreshing.
For a new or changed Rhode Island reference, update and release
`ripota/parks`, bump the pinned release URL here, run `npm install`, and then
run the normal POTA update workflow when identity or activity data changes. A
visitor-information-only package upgrade needs a site rebuild; it does not need
a network POTA refresh. Use `pota:ri:build-tracker-data` and
`pota:park:build-page-data` for any required regeneration from existing caches.
Non-RI field notes can continue to use
`mise run pota:park:ensure -- US-1234` before the update.
