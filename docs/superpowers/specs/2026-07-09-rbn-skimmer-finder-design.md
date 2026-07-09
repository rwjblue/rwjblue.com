# RBN Skimmer Finder Design

## Goal

Add a client-side radio utility that helps a portable operator find the nearest
active Reverse Beacon Network skimmers for their current operating location,
then open RBN with useful spot filters prefilled.

The page should answer two questions:

- Which active skimmers are closest enough to approximate what I may hear?
- How do I quickly use those skimmers on RBN for a set of target calls?

## Page

Create a new Astro page at `/radio/rbn-skimmers/` and link it from the radio
index alongside the existing interactive CW tool.

The page is a utility, not a long-form article. It should present the controls
and results immediately:

- Operating location controls.
- Active skimmer status.
- Ranked nearest-skimmer table.
- Compact map showing the operating location and nearest skimmers.
- RBN handoff builder for target calls.

## Data Sources

The page should fetch active RBN node data directly in the browser from:

`https://www.reversebeacon.net/nodes/detail_json.php`

That endpoint currently sends permissive CORS headers and includes the active
node list used by RBN's detailed node page. The feature must tolerate fetch
failure and show a clear error state. A checked-in fallback snapshot is
acceptable if the implementation can keep it small and clearly label the data
as stale, but the primary path should use live RBN data.

The utility should not fetch or render live spot data directly in its first
version. Instead, it should build an official RBN URL and let RBN render live
spots.

## Location Input

Support two operating-location paths:

- Browser geolocation via `navigator.geolocation`.
- Manual Maidenhead grid entry.

Browser geolocation should stay client-side. The page does not need to store
or send the user's location to this site. If geolocation is denied,
unavailable, or times out, the manual grid input remains the fallback path.

Manual grid input should accept at least 4- and 6-character Maidenhead grids
and use the grid center for distance calculations. If an invalid grid is
entered, show an inline validation message and leave existing results intact.

## Skimmer Normalization

RBN node records include callsign, grid, skimmer options, band ranges, and last
seen status. The client code should normalize each valid node into a compact
shape used by both the table and the map:

- `call`
- `grid`
- `lat`
- `lon`
- `distanceMiles`
- `distanceKm`
- `spotPolicy`, derived from strings such as `ALL spots` or `CQ only`
- `bands`, deduplicated and ordered by common HF/VHF band order
- `lastSeen`
- `skimmerVersion`

Nodes without usable grids should be ignored for distance ranking.

Distance should use great-circle calculation. A grid coordinate represents the
center of the reported grid square, so distances are approximate and should be
presented that way.

## Results Table

The table is the primary decision surface. It should list the nearest active
skimmers, defaulting to a practical number such as the nearest 10.

Columns:

- Rank.
- Callsign.
- Grid.
- Approximate distance.
- Bands.
- Spot policy.
- Last seen.

Rows should be selectable. The default selected rows should be the closest one
or two valid skimmers, because those are the most useful for an immediate RBN
handoff. Users can adjust the selection before opening RBN.

## Map

Include a compact Leaflet map using the site's existing Leaflet pattern. The
map supports spatial sanity-checking; it is not the primary control surface.

The map should show:

- The operating location.
- The listed nearest skimmers.
- Numbered or otherwise rank-distinguishable skimmer markers.

When results change, the map should refit to the operating location and shown
skimmers. Marker popups should include callsign, grid, distance, and bands.

The map should remain usable on mobile. If the map library fails to load or
the map cannot initialize, the table must still work.

## RBN Handoff

Add a target-calls input near the results. It should accept comma- or
space-separated callsigns and wildcards, preserving RBN-compatible values such
as `K2A,K2B,K2C` or `K2*`.

The page should build a link to RBN's main page with readable query
parameters:

- `spotter_call` from the selected skimmer callsigns.
- `spotted_call` from the target-calls input.
- `max_age` with a default such as `6,hours`.
- `rows` with a default such as `50`.

Example:

`https://www.reversebeacon.net/main.php?spotter_call=NU4F,AA0O&spotted_call=K2A,K2H&max_age=6,hours&rows=50`

The page may show the generated URL and should provide a clear "Open on RBN"
action. If no target calls are entered, the link can still open RBN filtered to
the selected skimmers only.

## Privacy and Persistence

Location should not be sent to this site. Browser geolocation is only used in
memory for calculations. Manual grid values and preferred target calls may be
stored in `localStorage` only if that matches the existing client-side utility
pattern and is not surprising in the UI.

The page should not require an account, server-side API route, Cloudflare
Worker, or Pages Function.

## Error States

Handle these states explicitly:

- RBN active-node fetch fails.
- RBN returns no usable node records.
- User denies or cannot use browser geolocation.
- Manual grid is invalid.
- No skimmers can be ranked because no location is available.
- No selected skimmers are available for the RBN handoff.

Failure messages should be brief and operational: explain what happened and
what the user can do next.

## Implementation Shape

Keep domain logic in a testable TypeScript module, separate from the Astro
page and DOM code. The library should cover:

- Maidenhead grid parsing and grid-center conversion.
- Great-circle distance.
- RBN node normalization.
- Band list extraction and ordering.
- Nearest-skimmer ranking.
- Target-call parsing.
- RBN URL construction.

The Astro page should provide markup and load a small client script that wires
controls, fetches RBN node data, renders results, updates the map, and builds
the RBN handoff link.

## Testing

Add Node tests for the library functions before implementation:

- Converts 4- and 6-character Maidenhead grids to expected center
  coordinates.
- Rejects invalid grids.
- Computes distance order correctly for sample skimmers.
- Normalizes RBN node bands and spot policy.
- Selects the nearest skimmers by default.
- Parses comma- and space-separated target calls.
- Builds the expected RBN main-page URL.

Run `mise run check` and `mise run build` after Astro/CSS/client-code changes.
Because this is a visual and interactive utility, verify the page in a browser
at mobile and desktop widths before reporting completion.
