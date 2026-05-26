# Notes RSS Feed Design

## Goal

Add a single RSS feed for the site's notes so readers can subscribe to new
field reports, software observations, and site notes without changing the
current authoring model.

The feed publishes full rendered note bodies. The existing `summary`
frontmatter remains useful as each item's short description, but it is not a
divider between excerpt and body.

## Scope

This design covers only notes from `src/content/notes`. Projects are durable
workstreams and are not included in the initial RSS feed.

The initial feed is exposed at `/rss.xml`. The feed itself uses
`https://rwjblue.com` as its site URL. Individual note items can use a different
canonical host based on note tags.

## Feed Shape

The feed title is `Robert Jackson / Notes`.

The feed description describes the notes collection as field logs, software
observations, radio updates, and site notes from Robert Jackson.

Feed items are loaded from the Astro `notes` content collection and sorted by
`date` descending.

Each item includes:

- `title` from note frontmatter.
- `description` from note `summary`.
- `pubDate` from note `date`.
- `categories` from note `tags`.
- `content` containing the full rendered Markdown body.
- `link` and `guid` set to the note's canonical absolute URL.

Canonical item URLs are tag-based:

- Notes tagged `radio` use `https://n1rwj.com/notes/{id}/`.
- All other notes use `https://rwjblue.com/notes/{id}/`.

This rule is intentionally simple. A future `canonicalHost` frontmatter field
can replace or override the tag rule if the site needs per-note control.

## Implementation Approach

Add `@astrojs/rss` for RSS generation and follow Astro's documented RSS
approach for content collections.

Create `src/pages/rss.xml.ts` as the RSS endpoint. It does the following:

- call `getCollection("notes")`;
- sort notes by `note.data.date` descending;
- render each note body to HTML for RSS content;
- sanitize rendered HTML before putting it in the feed;
- preserve image tags so photo-heavy field reports remain useful in feed
  readers;
- generate absolute item links with a small canonical URL helper.

The canonical URL helper can live in the RSS endpoint for now. It is small and
explicit:

- if `note.data.tags.includes("radio")`, use `https://n1rwj.com`;
- otherwise use `https://rwjblue.com`.

Update `src/layouts/BaseLayout.astro` with RSS autodiscovery:

```astro
<link
  rel="alternate"
  type="application/rss+xml"
  title="Robert Jackson / Notes"
  href="/rss.xml"
/>
```

No visible navigation link is required for the first version.

## Error Handling And Stability

The feed is generated at build time. Build failures are acceptable if a note
cannot be rendered or required metadata is invalid, because the existing content
schema already treats invalid notes as build-time errors.

`link` and `guid` both use the canonical item URL. This keeps item identity
stable as long as the note slug and canonical domain rule remain stable.

Changing a note from non-radio to radio later would change its feed identity.
That is acceptable for the initial design because the rule is simple and easy
to reason about. If this becomes a real editorial problem, add explicit
canonical host frontmatter.

## Validation

Extend `tests/site-content.test.mjs` with focused checks that:

- `src/pages/rss.xml.ts` exists;
- the RSS endpoint loads `getCollection("notes")`;
- the endpoint contains the `radio`, `n1rwj.com`, and `rwjblue.com` canonical
  domain rule;
- `BaseLayout.astro` includes an RSS alternate link for `/rss.xml`.

After implementation, run:

```bash
mise run check
mise run build
```

Inspect `dist/rss.xml` after the build to confirm:

- the latest note appears first;
- radio notes link to `https://n1rwj.com/notes/.../`;
- non-radio notes link to `https://rwjblue.com/notes/.../`;
- item body content is present, not only summaries.
