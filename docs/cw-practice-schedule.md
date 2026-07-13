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
| K1USN SST | Monday 0000-0100Z; Friday 2000-2100Z | [K1USN SST](https://www.k1usn.com/sst) |
| ICWC MST | Monday 1300-1400Z and 1900-2000Z; Tuesday 0300-0400Z | [ICWC MST rules](https://internationalcwcouncil.org/mst-contest/) |
| CWops CWT | Wednesday 1300-1400Z and 1900-2000Z; Thursday 0300-0400Z and 0700-0800Z | [CWops CWT rules](https://cwops.org/cwops-tests/) |

The exchange and frequency summaries in the UI and calendar also come from
those pages. For CWT, members send a first name and CWops number, non-members
send a first name and state, province, or DX prefix, and CW Academy students
send a first name and `CWA` instead of a location.

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

The current model assumes every listed event recurs weekly without exceptions.
One-off cancellations or special-time sessions would require explicit exception
data or organizer-backed ingestion; neither is implemented today.
