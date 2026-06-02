# Homepage Radio Dispatch Design

## Goal

Improve the home page so it feels more personal, more current, and more useful
as the front door for `rwjblue.com`, `n1rwj.com`, and `n1rwj.radio`.

The first impression should be radio-led: Robert Jackson as N1RWJ, with
portable HF, CW, POTA, station work, and practical debugging habits carrying the
identity of the page. Software remains part of the story, but as supporting
context rather than equal top-level weight.

## Current Issues

- The home page has a clear structure, but it still reads like a static landing
  page rather than a personal dispatch from an active bench.
- The top-right "Current bench" panel is hand-written prose with no links, so it
  does not help readers move deeper into the site.
- Recent notes and projects are useful, but they sit below a top section that
  does not yet prove the site is alive.
- There is no durable "my shack" or station setup page for readers who want to
  understand the radios, antennas, portable kits, and operating workflows behind
  the notes.

## Homepage Structure

Use a "Radio Dispatch" structure:

- Keep the broad two-column hero area.
- Lead with a more personal radio-first intro using Robert's name and N1RWJ.
- Replace the static "Current bench" panel with a linked "On the bench" panel.
- Pull recent writing higher in the hierarchy so the page feels current.
- Keep projects visible, but below recent notes and behind the first impression.

The top-right "On the bench" panel should contain real destinations:

- Latest note: date and title from the newest note.
- Radio setup: link to the new shack/setup page.
- RI POTA project: link to the existing tracker.
- Radio notes: link to the radio landing page or radio notes.

## Content Model

Add a durable radio setup page at `/radio/shack/`. The page title should be "My
shack", with supporting copy that makes clear it includes home station,
portable, antenna, and operating workflow notes.

The first version should be concise and maintainable. It should cover:

- Home station: radio, antenna, operating position, and remote-operation status
  if relevant.
- Portable kit: field radios, antennas, logging, power, and pack choices.
- Operating focus: CW, POTA, contest practice, and experiments.
- Last-updated language so the page can evolve without pretending to be final.

The home page does not need a new collection. It should continue deriving recent
notes and projects from existing Astro content collections. The "On the bench"
links can be a small local array in `src/pages/index.astro`.

The radio landing page should link to `/radio/shack/` so the new page is also
discoverable from the primary radio navigation path.

## Components And Data Flow

Implementation should stay Astro-native and close to existing patterns:

- `src/pages/index.astro` keeps sorting notes and projects with `getCollection`.
- `src/pages/index.astro` adds local data for the linked "On the bench" panel.
- The latest note entry in the panel is derived from the newest note rather than
  duplicated by hand.
- `src/pages/radio/shack.astro` provides the durable radio setup writeup.
- `src/pages/radio/index.astro` adds a visible path to the new setup page.
- `src/styles/global.css` reuses the existing restrained workshop language:
  border-top sections, list rows, artifact links, and compact metadata.

Avoid adding shared helpers unless implementation exposes meaningful duplication
or unclear responsibilities.

## Visual Direction

Keep the current quiet, utilitarian workshop aesthetic. Do not turn the home
page into a card-heavy portfolio or a marketing hero.

The improvement should come from:

- clearer hierarchy,
- more human radio-first copy,
- linked destinations in the hero sidebar,
- stronger placement for recent notes,
- and a real setup page behind the radio identity.

Responsive behavior matters. On mobile, the linked "On the bench" panel should
remain useful but should not push recent notes too far down without a clear
reason.

## Validation

Run standard Astro validation:

- `mise run check`
- `mise run build`

Use `agent-browser` for screen verification rather than directly driving Chrome.
The implementation pass should inspect:

- the home page at a desktop viewport,
- the home page at a mobile viewport,
- `/radio/`,
- and `/radio/shack/`.

Suggested browser workflow:

- `agent-browser open http://localhost:4321/`
- `agent-browser set viewport 1440 1000`
- `agent-browser screenshot --full`
- `agent-browser set viewport 390 844`
- `agent-browser screenshot --full`
- repeat targeted checks for `/radio/` and `/radio/shack/`

No separate unit tests are required unless implementation introduces shared
helpers or behavior that is better validated outside the rendered pages.

## Out Of Scope

- A new content collection for home page modules.
- A full radio equipment database.
- A complete redesign of notes, projects, or article templates.
- Live radio/POTA/propagation data on the home page.
- Cloudflare, deployment, or routing changes beyond the new static page.
