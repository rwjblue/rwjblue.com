# CW Practice Schedule

The CW Practice Schedule at `/radio/cw-practice/` presents the recurring K1USN
SST, ICWC MST, and CWops CWT sessions in either the visitor's current local time
zone or UTC. It also publishes a subscribable iCalendar feed at
`/radio/cw-practice/calendar.ics`.

## Schedule Sources

The schedule is maintained in `src/lib/cw-practice.ts`. It is deliberately
checked into the repository rather than scraped at request time. The official
organizer pages are the authority; contestcalendar.com may be useful for
cross-checking, but it is not an application dependency.

Schedule last verified July 13, 2026:

| Activity | Weekly UTC sessions | Official source |
| --- | --- | --- |
| K1USN SST | Monday 0000-0100Z; Friday 2000-2100Z | [K1USN SST rules](https://www.k1usn.com/sst_rules.html) |
| ICWC MST | Monday 1300-1400Z and 1900-2000Z; Tuesday 0300-0400Z | [ICWC MST rules](https://internationalcwcouncil.org/mst-contest/) |
| CWops CWT | Wednesday 1300-1400Z and 1900-2000Z; Thursday 0300-0400Z and 0700-0800Z | [CWops CWT rules](https://cwops.org/cwops-tests/) |

The exchange and frequency summaries in the UI and calendar also come from
those pages:

- SST stations send a first name and a state from the lower 48, a Canadian
  province, or the literal `DX` from anywhere else, including Alaska and
  Hawaii. The current rules explicitly say not to send a country prefix; they
  supersede the older summary on the SST landing page.
- MST stations send a first name and sequential QSO serial number.
- CWT members send a first name and CWops number. Non-members send a first name
  and state, province, or DX country prefix. CW Academy students send a first
  name and `CWA` instead of a location.

## Supplemental Practice Resources

The page also presents two less-structured ways to practice. These are kept
outside the featured SST/MST/CWT sequence and the iCalendar feed because they
do not have the same dependable, fixed-duration event model.

Supplemental resources last verified July 29, 2026:

| Resource | Presentation | Official source |
| --- | --- | --- |
| Nervous Novice CW Net (NNN) | Next Monday or Thursday at 7 PM Central; 7.033 MHz primary and 7.035 MHz backup | [W5IAS net details](https://w5ias.com/sooner-sprint/) and [June 2026 frequency notice](https://w5ias.com/2026/06/29/cw-nets-change-frequencies/) |
| CWops Giving Back | Evergreen guidance plus a link to the live volunteer roster | [CWops Giving Back](https://cwops.org/giving-back/) |

`src/lib/cw-practice-resources.ts` calculates the next NNN start from a 7 PM
`America/Chicago` wall-clock recurrence. This preserves the organizer's local
evening schedule through CDT/CST changes and lets the existing Local time/UTC
control format the result for the visitor. The UI does not claim an on-air
window because W5IAS does not publish a dependable duration and occasionally
posts cancellations or frequency changes.

Giving Back is volunteer-based rather than one synchronized net. Most
volunteers operate around 7 PM in their own local time, generally at 15-20 WPM,
and the roster can change. The page therefore explains how to recognize a
Giving Back call and links to the official live roster instead of copying that
roster into the site or generating calendar events.

## Browser Schedule Calculation

`src/lib/cw-practice.ts` stores each weekly session as a UTC weekday and hour.
`upcomingCwSessions()` calculates the next occurrence of every rule from the
current instant. A session remains the current occurrence until its one-hour
window ends; after that it rolls forward by one week.

For each of the nine rules, the function generates the next occurrence and the
following week's occurrence, sorts all 18 candidates chronologically, and then
returns the requested number. The page asks for ten sessions. It uses the first
two for the featured cards and the following seven for the agenda.

`src/lib/cw-practice-client.ts` formats those UTC instants using `Intl`:

- **Local time** uses the browser/device's current IANA time zone.
- **UTC** uses UTC directly.

No offset arithmetic or fixed Eastern-time conversion is stored in the app, so
daylight-saving changes and travel are handled by the browser's time-zone data.

## Calendar Feed

The calendar does not contain a finite list of future dates. `buildCwCalendar()`
emits nine `VEVENT` records, one for each weekly session, and each record has
`RRULE:FREQ=WEEKLY` with no `COUNT` or `UNTIL`. Calendar clients can therefore
expand the recurrence indefinitely according to their own display horizon.

Events use UTC `DTSTART` and `DTEND` values, stable `UID` values, and a shared
`SEQUENCE`. A schedule or exchange change should retain the UIDs and increment
`CW_CALENDAR_SEQUENCE`, allowing subscribed clients to update existing events
instead of creating duplicates.

Subscription links are built in the browser from the current page host. A
visitor on `n1rwj.com` therefore subscribes to the `n1rwj.com` feed, while a
visitor on `rwjblue.com` stays on `rwjblue.com`. The Worker uses the requested
feed origin for each event's `URL` and schedule link, so calendar items return
to the same site domain from which the calendar was subscribed.

`worker/index.ts` handles only the calendar path. On each calendar request it
builds the small iCalendar document in memory from the same `cwActivities` data
used by the page. Every other request bypasses Worker code and is served from
the static-assets binding, as configured by `assets.run_worker_first` in
`wrangler.jsonc`.

```text
Browser page -> static Astro/CSS/JS assets -> local schedule calculation

Calendar app -> GET /radio/cw-practice/calendar.ics
             -> Cloudflare Worker
             -> buildCwCalendar(cwActivities)
             -> text/calendar response
```

The feed advertises a six-hour refresh interval. HTTP responses may be cached
for five minutes by a client and one hour by a shared cache. These are hints and
cache bounds; the calendar application ultimately decides when to fetch a
subscribed feed. This is a read-only iCalendar subscription, not CalDAV.

## Updating The Schedule

1. Verify the schedule and exchange against all three official organizer pages.
2. Edit the activity definitions in `src/lib/cw-practice.ts`.
3. If subscribed event content or recurrence changed, increment
   `CW_CALENDAR_SEQUENCE`. Update `CW_CALENDAR_VERSION` when the verification
   date changes. The endpoint ETag includes both values.
4. Update the verification date or explanatory text in this document.
5. Run `npm test`, `mise run check`, `mise run build`, and
   `mise run deploy -- --dry-run`.
6. Deploy with `mise run deploy`.

For NNN or Giving Back changes, verify both official pages and update
`src/lib/cw-practice-resources.ts`, the supplemental cards and walkthroughs,
and this document. Do not add either resource to the calendar until its
organizer publishes a stable recurrence and duration suitable for a subscribed
event.

The current model assumes every listed event recurs weekly without exceptions.
One-off cancellations or special-time sessions would require explicit exception
data or organizer-backed ingestion; neither is implemented today.
