# Offline radio field kit

The radio section progressively installs a deliberately small offline field
kit in browsers that support service workers. The normal online site remains
unchanged when service workers are unavailable or blocked.

The production build precaches these route shells and only the local scripts,
styles, icon, and manifest they require:

- `/radio/`
- `/radio/glossary/`
- `/radio/shack/`
- `/radio/cw-practice/`
- `/radio/cw-qso/`
- `/radio/beacons/`
- `/radio/field-log/`
- `/radio/rbn-skimmers/`

Other public HTML pages under `/radio/` are cached only after a successful
visit and use a network-first strategy. Their runtime cache, including
on-demand same-origin assets, is limited to 24 requests. Search indexes, map
tiles, images outside the selected shells, and external/live data are not
cached.

`scripts/build-service-worker.mjs` runs after Astro and derives a deterministic
cache version from the service-worker generator, selected HTML, and generated
local dependencies. A new version activates immediately, removes older
field-kit caches, and claims open pages. Selected pages refresh from the network
when possible and use the current-version cache when the request fails or the
server returns an error.

RBN active-node data and OpenStreetMap tiles still require a connection. The
RBN tool may identify locally stored node data by age, but it must not present
that data as current. The field log timeline, beacon schedule, CW tools, and
written references remain useful without those network services.
