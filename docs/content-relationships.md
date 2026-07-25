# Content Relationships

Notes can opt into an editorial series with validated frontmatter:

```yaml
series:
  slug: rhode-island-to-florida-rove
  title: Rhode Island-to-Florida POTA rove
  order: 1
```

The slug and title must agree across the series, and each positive integer order
may be used only once. Public entries generate `/series/<slug>/` and
previous/next navigation. Draft and unlisted notes are never collected into a
series.

Related content is selected automatically from shared top-level tags across
public notes and projects. More shared tags rank first, then newer content, with
title and URL tie-breakers for deterministic builds. Editorial series links and
automatic related content are separate concepts.

## Backlinks

Build-time backlinks scan Markdown links and HTML `href` values in public note
and project source content. Canonical paths collapse fragments, query strings,
trailing-slash differences, `index.html`, and POTA reference casing. External
URLs, assets, generated share pages, self-links, and duplicate references are
ignored.

Supported public notes, projects, radio tools, and canonical park pages opt into
the shared `Referenced by` component. Draft and unlisted notes neither create
backlinks nor render a backlink section.
