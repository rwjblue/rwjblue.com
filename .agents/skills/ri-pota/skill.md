---
name: ri-pota
description: RI POTA challenge planning — find remaining parks, estimate drive times, check live spots and conditions. Use when the user asks about activating RI parks, which parks are left, or where to go for a POTA outing.
---

# RI POTA Challenge

Goal: activate every Rhode Island POTA reference by December 31, 2026.

## Step 1 — Read current state

```bash
cat src/data/pota/ri-tracker.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Summary:', d.summary);
  d.references.filter(r => r.status === 'remaining').forEach(r =>
    console.log(r.reference, r.grid, r.name));
"
```

Or just read `src/data/pota/ri-tracker.json` directly — it has `summary` (completed/remaining/total) and a `references` array with `status`, `latitude`, `longitude`, `grid`, and `name` for every park.

## Step 2 — Estimate drive times

```bash
mise run pota:ri:travel-times
# or from a different home grid:
mise run pota:ri:travel-times -- --grid FN41gs
```

Output is sorted by estimated drive time. Requires network for OSRM routing; falls back to haversine if OSRM is unreachable. Default home grid is **FN41fr**.

## Step 2b — Find rove clusters

```bash
mise run pota:ri:rove-clusters
# wider threshold (more parks per cluster):
mise run pota:ri:rove-clusters -- --threshold 60
# include already-activated parks:
mise run pota:ri:rove-clusters -- --all
```

Groups remaining parks by adjacency (default: 45-min inter-park drive) using connected components. For each cluster, computes a nearest-neighbor round-trip from home and reports ordered stops with segment times and total drive. Isolated parks (no neighbor within threshold) are listed separately. Falls back to haversine if OSRM is unreachable.

## Step 3 — Check live conditions

```
pota_spots(location="US-RI")          # any active RI activators right now
solar_conditions()                     # SFI, Kp, overall HF quality
solar_band_outlook()                   # per-band forecast
```

## Step 4 — Refresh tracker data (if stale)

```bash
mise run pota:ri:update-tracker        # fetches parks + profile, rebuilds JSON
```

Or rebuild from existing caches only (no network):

```bash
mise run pota:ri:build-tracker-data
```

## Park notes

| Reference | Note |
|-----------|------|
| US-0513 Block Island NWR | Ferry from Point Judith (~1 hr each way). Half-day minimum. Drive-time estimates are misleading — add ferry time. |
| US-10545 Hillsdale Preserve | Historical/Archaeological Preserve: no antennas staked into the ground. |

## Key files

| Path | Purpose |
|------|---------|
| `src/data/pota/ri-tracker.json` | Generated tracker state — source of truth for status |
| `data/pota/ri/activations.json` | Activation ledger (hand-editable if needed) |
| `data/pota/ri/cache/` | Raw API response caches |
| `scripts/pota/ri-tracker.mjs` | Tracker data pipeline |
| `scripts/pota/travel-times.mjs` | Drive-time estimator (home → each park) |
| `scripts/pota/rove-clusters.mjs` | Rove cluster finder (groups of nearby parks) |
| `scripts/pota/lib/routing.mjs` | Shared routing utilities (grid, haversine, OSRM) |
| `src/pages/projects/2026-activate-all-ri-pota.astro` | Public tracker page |
