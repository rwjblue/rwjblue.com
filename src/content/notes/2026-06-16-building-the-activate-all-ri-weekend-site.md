---
title: Building the Activate All RI weekend site
date: 2026-06-16
summary: "Notes on building the ripota.org event tooling for a community weekend to activate every Rhode Island POTA reference."
tags:
  - radio
  - pota
  - field-notes
  - software
---

My personal [2026 Activate All RI POTA](/projects/2026-activate-all-ri-pota/)
project is still its own thing: I want to activate every POTA reference
associated with Rhode Island before the end of the year. That is an individual
operating challenge, and the tracker on this site is built around my own
activation ledger.

There is now a separate community idea taking shape with K1NW and N1BS: a
weekend where Rhode Island POTA operators try to put every Rhode Island
reference on the air during one coordinated event window. That needs a
different kind of tooling. My tracker answers "what have I activated?" The
community weekend site needs to answer "which parks still need coverage, who is
planning to activate them, and when should hunters be listening?"

That is the work I have been doing in the `ripota.org` project.

## At a glance

- **Project:** Activate All RI 2026 event tooling for `ripota.org`
- **Purpose:** Coordinate activators and publish public coverage for all 61 Rhode Island POTA references
- **Current target:** September 11-13, 2026, with September 10 as a possible soft-start day
- **First release:** Activator recruitment, scheduled coverage, public park and schedule views
- **Later releases:** Hunter progress tools, award or recognition workflows, and post-event verification
- **Important boundary:** Official POTA remains the source of truth for rules, accounts, spots, logs, references, and awards

## Field notes

The main design decision was to keep the public side static-first. During an
event weekend, the schedule and coverage pages should be cheap, cacheable, and
boring to serve. The working data can live behind the scenes in D1, but the
public pages should read generated JSON files: event details, park coverage,
the public schedule, and the list of Rhode Island references.

That gives the site two different jobs. The public site is for hunters,
activators, club members, and anyone else trying to see the plan. The organizer
workflow is separate: review submitted routes, approve or reject them, edit
details, handle cancellations, and rebuild the public JSON if something needs a
manual reset.

Another important decision was not to fake "live" activity. A scheduled window
is useful, but it is not the same thing as being on the air. If the site ever
shows a park as currently active, that should come from real POTA spot data.
Until then, the honest labels are things like scheduled, uncovered, completed,
or cancelled and needing replacement.

The map is still worth having, but it is not the primary operating interface.
It can show the shape of the problem: all 61 references, which ones are covered,
and which ones still need help. The detailed event work belongs in table views:
one organized by park for coverage gaps, and one organized by time for hunters.

The first slice is intentionally activator-first. Hunter tools matter, but they
do not need to block the signup and coverage workflow. The plan is to ship the
activator side first, then add a hunter page that can import the official POTA
hunted-parks CSV in the browser and show which Rhode Island references a hunter
still needs. Award or recognition processing can wait until the core event
machinery is working.

## What worked

- Splitting my personal tracker from the community weekend site keeps the two goals clean.
- Stable URLs under `ripota.org/activate-ri-2026/` make the event pages easier to share than one large page with anchors.
- Generated public JSON keeps the public event pages simple while still leaving room for D1-backed moderation.
- Treating live status as spot-backed only avoids misleading hunters during the event.

## To adjust next

- Replace the temporary volunteer page with the real activator route submission form.
- Add the D1 schema, Worker API routes, Turnstile verification, and organizer moderation flow.
- Build the admin workflow so approval, edits, and cancellations regenerate public JSON automatically.
- Keep the later hunter and recognition work in separate phases so the activator coordination site can ship first.
