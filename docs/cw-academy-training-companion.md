# CW Academy training companion proposal

Status: approved design, September 5, 2026. The first release is implemented;
current behavior, setup, and limitations live in [CW training](cw-training.md).
This document retains the research and longer-term design, not rollout status.

## Recommendation

Build a private, local-first tool at `/radio/cw-training/` with one promise:

> Open it and immediately start the most useful 10- or 15-minute block.

The destination is one page for deciding what to practice, doing the exercises
that fit a browser, and recording all training. The first release should include
the assigned audio player. A later release can add a focused instant-recognition
trainer. The page also guides and records activities that use a physical key,
radio, contest simulator, or class meeting.

Translate the next class deadline into a small queue of concrete practice
units, guide the current unit, remember what was done, and give the next action.
A Cloudflare Access-protected Worker API and D1 should provide cross-device
sync. IndexedDB should keep the current plan and unsynced attempts available
locally. Practice history should survive the end of the eight-week course, with
an optional maintenance routine afterward.

Do not build a custom account system. Do not mirror CWops audio or reproduce the
full curriculum on the public site.

## What the curriculum actually asks for

The current official Intermediate curriculum is version 2.2, dated September
18, 2025. It has 16 coached sessions over eight weeks. Each session has three
practice days that are completed before that session's online meeting. CW
Academy encourages at least 60 minutes per day, six days per week.

Confirmed schedule: Mondays and Thursdays, 3:30-4:30 p.m. Eastern, starting
Monday, September 7, 2026. Store `America/New_York` as the course time zone,
not a fixed UTC offset. The uninterrupted 16-meeting schedule ends October 29;
advisor changes remain editable. Monday and Thursday practice is due before
3:30 p.m., and the coaching hour is separate from the personal practice target.

The practice week follows the two class deadlines:

| Practice date | Assignment due at | Curriculum position |
| --- | --- | --- |
| Saturday | Monday class | Session N, day 1 |
| Sunday | Monday class | Session N, day 2 |
| Monday | Monday class | Session N, day 3 |
| Tuesday | Thursday class | Session N+1, day 1 |
| Wednesday | Thursday class | Session N+1, day 2 |
| Thursday | Thursday class | Session N+1, day 3 |
| Friday | - | Rest, recovery, or advisor-directed work |

The speed progression is staged rather than linear every day:

| Curriculum sessions | Stated objective |
| --- | --- |
| 1-3 | Comfortable sending and receiving at 10-13 WPM |
| 4-6 | 13-15 WPM |
| 7-10 | 15 WPM |
| 11-13 | 18 WPM |
| 14-15 | 20 WPM |
| 16 | Exposure to 25 WPM |

The repeated activity pattern is more useful to the product than the individual
file list:

- Sending: the Daily Morse Code Scales warm-up every day, with drill or
  exercise sections on assigned days.
- Listening and head copy: short word, phrase, prefix, suffix, QSO, POTA,
  short-story, and CWT files, usually with two or three passes.
- Instant recognition: LCWO or MorseCode.World exercises at the current class
  speed. The official Intermediate guidance begins with 25 WPM character speed,
  10 WPM Farnsworth speed, and short groups or words, then increases effective
  speed and group length as accuracy improves.
- Contest copy: 15-minute Morse Runner sessions, initially in single-call mode
  and later in WPX mode.
- On-air work: later assignments add CWT monitoring or QSOs.
- Optional/advisor work: RufzXP and advisor-selected files can change the
  default plan.

This means the plan must be data-driven. There are exceptions in the published
assignments, and an advisor can substitute material; the application should not
infer an assignment from a generic "day 1/day 2/day 3" pattern.

Sources:

- [Intermediate curriculum v2.2](https://cwa.cwops.org/wp-content/uploads/Practice-Instructions-Intermediate-ver.2.2.htm)
- [Intermediate practice files](https://cwops.org/intermediate-practice-files/)
- [Daily Morse Code Scales](https://cwops.org/wp-content/uploads/2024/08/Everyday-Send-Code-Web.htm)
- [LCWO ICR guidelines](https://cwops.org/wp-content/uploads/2025/03/LCWO-ICR-Guidelines.htm)
- [MorseCode.World ICR guidelines](https://cwops.org/wp-content/uploads/2024/08/MorseCode.World-ICR-Guidelines.htm)

## Whole-course coverage and scheduling rules

Reviewed all 16 sessions and the practice-log appendix on September 5. Later
additions are story head copy (11), WPX simulation (12), recorded CWT exchanges
(13), live monitoring of five stations (14), harder WPX settings (15), and five
live QSOs or copying as an alternative (16). Repeat instructions include
minimum counts, one-or-two passes, and unspecified multiple listens. Preserve
per-task speed exceptions: Session 11/day 3 simulator and Session 13/day 3 ICR
remain at 15 WPM. See the [official curriculum](https://cwa.cwops.org/wp-content/uploads/Practice-Instructions-Intermediate-ver.2.2.htm).

The planner needs these behaviors from the beginning, even if the first usable
seed contains only the opening session:

| Activity model | Completion and scheduling behavior |
| --- | --- |
| Sending prompt or section | Section coverage plus actual practice time; preserve text and position |
| Short audio and longer story | Per-resource coverage, resume, recall goal; minimum, bounded, or open repeat target |
| ICR exercise | Independent character and effective speeds, trainer configuration, optional result |
| Simulator run | Exact mode/settings and uninterrupted duration; mode belongs to the assignment |
| Recorded exchange practice | Audio player with optional exchange notes; qualitative review if count unspecified |
| Live event | Eligible event windows, objective count, and explicitly allowed alternative completion |
| Advisor or self-directed review | Clear origin and required/optional status; no invented score or pass requirement |
| Class or breakout activity | Session materials and participation state; excluded from independent-practice minutes |

Keep duration estimates separate from completion rules. A player can offer
`Another pass` after a minimum is met. An open-ended listening task needs a
check-in rather than an invented required repetition count or accuracy score.
Unknown media duration stays unknown until measured; it is not treated as zero.
Long recordings use the existing longer-block/resume behavior instead of being
misrepresented as short files.

Live work must appear in the upcoming week before its eligible operating
window. Let the user complete it early and credit the assigned session without
creating a duplicate on its nominal curriculum day. Track observation and
transmitted contacts separately. If a valid event window is missed, keep that
objective unresolved for advisor direction rather than replacing it with an
MP3 or granting completion. Use the site's maintained CWT schedule and the
course's Eastern time zone for event selection.

The source comparison also exposed two unresolved references: the syllabus
requests CWT209-20 and CWT213-25, while the [official file index](https://cwops.org/intermediate-practice-files/)
links CWT209-25 and CWT213-30. Preserve requested and available variants, flag
the discrepancy before the affected session, and accept a recorded advisor
choice. Do not synthesize a URL or silently change the assigned speed.

Before loading the complete course, review each of the 48 daily assignments
against its source and verify its linked resources. The generic planner must
support an unresolved resource and continue other usable tasks without claiming
the whole assignment is complete.

## A useful plan for today

With the first class on Monday, September 7, 2026, today is Session 1,
day 1. The current official files make a clean four-block plan. Their observed
durations on September 5 were about 7:23 for WD101-10 and 1:14 for PR101-10.

### Four 15-minute blocks

1. Send the official warm-up. Use any remaining time to repeat rough groups
   cleanly rather than racing.
2. Listen to [WD101-10](https://cwa.cwops.org/wp-content/uploads/WD101_10.mp3)
   twice. The two required passes take about 14:46.
3. Listen to [PR101-10](https://cwa.cwops.org/wp-content/uploads/PR101_10.mp3)
   three times, then replay the hardest material and retain it without writing
   until the block ends.
4. Do 15 minutes of Intermediate ICR at 10 WPM in the preferred trainer. A
   preconfigured MorseCode.World link should be the low-friction mobile default;
   LCWO remains available.

### Six 10-minute blocks

1. Sending warm-up and clean repeats.
2. First WD101-10 pass, then recall the words that stuck.
3. Second WD101-10 pass, then repair missed words.
4. Three PR101-10 passes, then focused phrase review.
5. ICR letters or code groups at the assigned speed.
6. ICR word training or the weakest item from the earlier blocks.

The product should generate plans like these from atomic units and real media
durations. It should never split one audio pass or a fixed 15-minute Morse Runner
run across blocks.

A prescribed 15-minute simulator run cannot fit a 10-minute window. Show
`This exercise needs 15 uninterrupted minutes` and offer another fitting unit;
when none remain, ask the user to reserve that longer block. Ten minutes is an
availability preference, not permission to shorten an assigned exercise.

## How much practice happens on this page

| Activity | First release | Later destination |
| --- | --- | --- |
| Assigned listening files | Play in the page; count passes and save position | Replay marked difficult sections and improve phone controls |
| Sending practice | Show the assigned section, link its source, time and log work with the user's key | Add permitted on-page prompts and optional local recording |
| Instant recognition | Launch the prescribed trainer with settings where supported; return to the same block | Browser-generated Morse, reveal-after-listening, character/Farnsworth controls, short focused rounds |
| Morse Runner / RufzXP | Show exact run settings; log the external run and optional score | Retain the specialist tool unless an equivalent is separately justified |
| CWT / on-air QSOs | Show exchange guidance, event times, and log completion | Keep the radio activity external and the plan/history here |
| Class meeting | Show the 3:30 p.m. deadline and private join link if supplied | Same class handoff, plus advisor notes |
| Instructor materials | Paste text, import a text file, or save a link in the relevant class packet | Support other file viewers after receiving representative material |

A native ICR exercise is a tractable later feature, but it must preserve the
assigned speed, spacing, practice material, and method. Keep prescribed LCWO or
MorseCode.World assignments until an advisor accepts a substitute. Do not assume
that embedding those websites provides supported controls or score access.

## In-page audio is core scope

Use one persistent native HTML audio element, with the official MP3 URL as its
source. The browser streams it from CWops while all controls stay in the
training page. The curriculum seed supplies the file, WPM, repetition target,
listening objective, and measured duration, so there is no file hunting.

The focused player should provide:

- One `Start listening` action that starts the first pass and its listening log.
- Play/pause, seek, `Replay 8 seconds`, and `Mark difficult here` controls.
- `Pass 1 of 2` or `Pass 2 of 3`, with an optional pause for recall between passes.
- Automatic repeat within the current exercise, with a visible resume button
  if a browser blocks restarting playback.
- Saved file position, current pass, completed passes, and difficult timestamps.
- A short listening objective; any answer reveal requires an actual supplied
  answer key, and stays hidden during head-copy work.
- A completion check-in and the next task when the required passes finish.

Count elapsed listening time only while audio is advancing; exclude pauses,
buffering, and forward seeks. Track pass coverage separately from extra replay
time: seeking to the end must not complete a pass. Preserve progress through a
reload or interruption without pretending the browser kept playing. A manual
`Practiced elsewhere` entry remains available for work the player cannot see.

Use the official recording at the assigned WPM. A generic playback-speed
multiplier changes character and spacing timing together and is not equivalent
to selecting the appropriate character/Farnsworth settings.

On September 5, the WD101 sample returned `audio/mpeg`, advertised byte ranges,
and honored a cross-origin range request with HTTP 206. No
`Access-Control-Allow-Origin` header was returned. Native playback without a
`crossorigin` attribute is the appropriate starting point; reading samples
through fetch/Web Audio would introduce a separate CORS requirement. Add the
official media host to the site's `media-src` policy if CSP is configured.

Phone playback begins with an explicit tap. Use Media Session metadata and
supported transport actions for system controls. Test screen locking,
headphones, phone-call interruption, auto-repeat, and switching apps on the
actual target phone; OS background suspension can delay callbacks, so seamless
locked-screen chaining is an acceptance test, not a promise from desktop tests.

The initial player needs a network connection to the official media host.
Offline planning and logging do not imply offline audio. Provide a source link
and a recoverable error if the host is unavailable; do not add a media proxy or
mirror just to work around playback failures.

Playback references:

- [Native cross-origin playback and Web Audio limits](https://www.w3.org/TR/webaudio-1.0/#MediaElementAudioSourceOptions-security)
- [HTML media CORS settings](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-settings-attributes)
- [Apple Media Session demonstration](https://developer.apple.com/videos/play/wwdc2021/10030/)

## Product behavior

### 1. "Now" is the home screen

The first screen answers only four questions:

- What curriculum session/day am I on?
- When is the next class?
- What should I do next?
- How much of today's 60 minutes is complete?

There is one primary action: `Start 15 minutes` (or 10 minutes, from the saved
preference). The full curriculum, history, settings, and plan editing are
secondary views.

Track curriculum coverage and practice time as two related but distinct goals.
A day is not "ready for class" until its required units are complete, even if
the timer has reached 60 minutes. If the required units finish early, the queue
fills the remaining time with ICR, a hard-item repeat, or advisor work.

### 2. A block is the unit of action; an attempt is the unit of history

Starting a block opens a focus view with:

- one instruction;
- persisted timing intervals that survive reloads and background tabs;
- the integrated official-audio player, or instructions for an external task;
- small substeps such as `pass 1 of 2`;
- `Pause`, `Finish`, and `Could not finish` actions.

At the end, completion is one tap. A three-choice check-in (`Hard`, `About
right`, `Easy`) is useful but optional. Tool-specific results such as LCWO
accuracy or Morse Runner score stay collapsed and optional. Required bookkeeping
would work against the main goal.

Audio blocks derive time from playback. Sending and external-tool blocks use
an explicitly started timer with pause/resume and a finish-time correction.
After a long suspension, confirm the practiced duration rather than counting
every minute the page was absent. The player remains mounted while navigating
between Today, Focus, and Week so checking the plan does not stop playback.

### 3. The queue makes missed time recoverable

The next-unit selector should use this order:

1. Resume an interrupted block.
2. Select incomplete required work due before the next class.
3. Prefer the earliest atomic unit that fits the chosen block length.
4. Use spare minutes for a targeted repeat from a `Hard` attempt.
5. When all assigned work is complete, offer an advisor task or weak-skill
   review.

An `I only have 10 minutes` action temporarily asks for a smaller unit without
changing the normal preference.

At class time, unfinished work should not silently roll forward forever. Show a
short review with `Done elsewhere`, `Leave missed`, and `Carry this one item`
choices, then advance to the next session. There should be no punitive streak,
red failure dashboard, or demand to make up several hours before proceeding.

On class days, show a preparation deadline at 3:30 p.m. and a class state until
4:30 p.m. Resolve unfinished preparation when the user next visits; do not
interrupt audio at the deadline. The next scheduled practice day starts Tuesday
or Saturday. Extra practice after class is optional, not a second daily quota.

### 4. Advisor changes are first-class

The instructor expects to email material before some meetings, possibly the day
before. The format and purpose have not been confirmed; text for sending in
breakout rooms is a possibility, not an established requirement. Support this
as a class packet attached to a specific meeting, independently of the base
curriculum.

Provide an `Add instructor material` action from Today and the class view:

1. Paste instructions, import a `.txt` file, or save a resource link. Default
   to the next meeting, while allowing a different target session.
2. Keep the original wording and filename alongside the source/received date.
   One packet can contain several resources with their own usage labels.
3. Choose `Prepare before class`, `Use during class`, `Reference`, or
   `Not sure yet`. Saving an unclassified item does not create a required task.
4. For preparation, choose whether it adds work or replaces a named assignment,
   plus any stated repetitions, duration, or due time. Show the queue change
   before applying it; unknown expectations remain visible rather than guessed.

The first implementation only needs text and links. Model an attachment
reference separately from its viewer so PDF, audio, images, or another format
can be added after seeing an example. Private text can use the existing private
record store. If binary uploads are later needed, keep them in authenticated
storage outside the public build, and add the appropriate viewer then.
Manual import is sufficient initially; email forwarding or connected-inbox
import can be considered after the messages' actual structure is known.

For a sending text file, provide a large readable prompt with adjustable text
size, preserved line breaks/prosigns, and a saved line position. Do not silently
rewrite the exercise text. The same resource can be opened for rehearsal or
class use, with those attempts recorded separately. If a packet includes both
sending text and receiving answers, retain the instructor's labels and expose
only the selected resource; do not automatically reveal a partner's exercise.

On Sunday and Wednesday, an optional `Check instructor email` reminder can
appear in the preparation checklist. `Not received` is informational and does
not block regular practice. It must not claim the inbox has been checked.

When preparation arrives late, place it ahead of optional review for the next
class and show the additional time needed. Preserve completed work and the
rest of the required curriculum unless an explicit replacement was recorded.
An in-class-only file belongs in the class packet, not the daily 60-minute
queue. At 3:30 p.m., make `Open class materials` available alongside the join
link; retain explicit rehearsal/class-use controls outside that hour as well.

Each day also has an unobtrusive `Adjust plan` action that can:

- replace a file or trainer;
- change repetitions or target speed;
- add an advisor note or optional task;
- move a unit earlier within the same pre-class window.

Overrides belong to the user's course run, so updating the base curriculum never
erases them. Revised instructor material creates a new revision; attempts keep
their original resource revision, and replaced tasks are marked superseded
rather than erasing practice history.

### 5. Reminders deep-link to the next action

The first reminder mechanism should be a private, revocable iCalendar
subscription. It should create one event at the user's chosen practice time on
each of the six practice days, include a short alarm where the calendar client
honors it, and link to `/radio/cw-training/?start=next`. The feed should contain
no notes, scores, or assignment text.

On Monday and Thursday, suggest a practice window before 3:30 p.m. and warn if
the selected reminder is after the preparation deadline.

Calendar clients cannot complete a Cloudflare Access login, so the feed needs an
unguessable read-only capability URL rather than the normal Access cookie. Store
only a hash of that token and offer `Rotate calendar link`.

Web Push can be added after the core flow proves useful. It would allow the
server to suppress a reminder when the day's goal is already done, but it adds
subscription lifecycle and service-worker complexity. On iPhone and iPad, Web
Push requires the site to be used as a Home Screen web app, so it should remain
an opt-in enhancement rather than the only reminder path.

## Wireframes

The sketches use the confirmed Monday/Thursday, 3:30 p.m. Eastern class time.

### Today

```text
+--------------------------------------------------+
| CW TRAINING                         Sat, Sep 5    |
| Session 1 / Day 1      Mon class 3:30 p.m. ET     |
|                                                  |
| Today                              15 / 60 min   |
| [==========------------------------------]       |
|                                                  |
| NEXT                                             |
| Listening: WD101-10                              |
| Two passes at 10 WPM             about 15 min   |
|                                                  |
|             [ Start 15 minutes ]                 |
|             I only have 10 minutes               |
|                                                  |
| Done: sending warm-up                            |
| Later: phrases -> ICR -> focused review          |
+--------------------------------------------------+
```

### Active block

```text
+--------------------------------------------------+
| Session 1 / Day 1                    pass 1 of 2  |
|                                                  |
|                     09:42                        |
|                                                  |
| Listen to WD101-10. Keep the pencil down.        |
| After the file, say or jot only the words you    |
| retained.                                        |
|                                                  |
| [ Replay 8s ]     [ Play / Pause ]    Pass 1 / 2  |
|                                                  |
|       [ Pause ]                    [ Finish ]     |
+--------------------------------------------------+
```

### Week and recovery

```text
+--------------------------------------------------+
| THIS WEEK                              3h 40m    |
| Sat  S1/D1  [====] 60m                           |
| Sun  S1/D2  [===-] 45m   1 block remaining      |
| Mon  S1/D3  [----]       class 3:30-4:30 p.m. ET |
| Tue  S2/D1  [----]                                |
| Wed  S2/D2  [----]       CWT available           |
| Thu  S2/D3  [----]       class 3:30-4:30 p.m. ET |
| Fri  Rest / recovery                              |
|                                                   |
| Recent: ICR hard twice -> queued for review       |
+--------------------------------------------------+
```

### Instructor material, before its purpose is clear

```text
NEXT CLASS: MON 3:30 P.M. ET

Instructor materials
1 item saved - needs placement

[ Open original ]
[ Choose how to use it ]

Prepare before class
Use during class
Reference / not sure yet

Regular practice remains ready.
```

## Information model

The curriculum definition and personal history should be separate.

### Curriculum-side records

- `curriculum`: source name, version, source URL, verified date.
- `assignment`: curriculum session, curriculum day, ordered task references.
- `task`: kind, short personal label, official resource URL, WPM, required
  repetitions or duration, estimated duration, target observation, and whether
  it is required, optional, or advisor-directed.
- Completion specification: minimum/bounded passes, fixed runtime, qualitative
  check-in, section coverage, or counted objective; alternatives are explicit.
- Task scheduling and tool settings: eligible event windows, allowed early
  completion, uninterrupted duration, exact mode, character/effective speed,
  and optional activity level. Do not derive these solely from a week's speed.
- Resource resolution: requested label/speed, verified URL/variant, verified
  date, and resolved or needs-advisor-choice status.

The D1 seed can expand an assignment into atomic practice units: one audio pass,
one sending section, one fixed trainer interval, or one on-air objective.

### User-side records

- `course_run`: owner, time zone, first class, 16 explicit meeting times,
  preferred block length, preferred ICR trainer, and curriculum version.
- `assignment_override`: additions and replacements from the advisor.
- `class_packet`: course/session, source note, received time, optional expected
  status, and one or more private material revisions.
- `material_revision`: original title/filename, text or resource reference,
  format, revision, intended use (preparation/class/reference/unknown), and
  optional sending/receiving role. Corrections retain prior versions.
- `attempt`: client-generated UUID, task/unit ID, start and finish timestamps,
  active seconds, outcome, optional difficulty, optional structured score, and
  optional note.
- Attempt context: independent practice or class use, exact material revision,
  and completed objective (for example observation versus transmitted contact).
- `playback_checkpoint`: attempt and resource IDs, pass index, covered media
  intervals, current position, difficult timestamps, and checkpoint time. Store
  locally during playback; sync metadata without uploading audio.
- `reminder_subscription`: preferred time and a hash of the calendar capability
  token.
- `push_subscription`: optional per-device Web Push data in a later phase.

Attempt IDs make writes idempotent. The browser can append attempts offline and
retry them safely. Completion, minutes, and weak-skill summaries are derived
from attempts instead of being maintained as competing counters.

## Architecture for this repository

The current site is already a good fit: Astro supplies static UI, the existing
Worker handles narrowly selected dynamic routes, the radio section already has
an offline service worker, and `/radio/cw-practice/` already models CWT times.

```text
Browser / installed field kit
    |
    +-- /radio/cw-training/ -------- generic static shell; no private data
    |
    +-- /api/cw-training/* --------- Cloudflare Access
    |                                  -> Worker JWT validation
    |                                  -> D1 course + attempt records
    |
    +-- official CWops MP3s -------- direct in-page streaming
    |
    +-- LCWO / MCW ----------------- configured exercise links initially
    |
    +-- /radio/cw-practice/ --------- existing CWT schedule and walkthrough

Calendar client
    |
    +-- /api/cw-training-calendar/<token>.ics
                                       -> read-only Worker route
                                       -> outside the Access application
                                       -> no private progress data
```

Suggested code boundaries:

- `src/pages/radio/cw-training.astro`: static shell, inaccessible curriculum
  content absent from the built HTML.
- `src/lib/cw-training/plan.ts`: date-to-session/day mapping and queue packing.
- `src/lib/cw-training/client.ts`: focus timer, IndexedDB cache, and sync queue.
- `src/lib/cw-training/types.ts`: versioned API and local record types.
- `worker/cw-training.ts`: authenticated snapshot and attempt endpoints plus the
  separately routed capability-token calendar feed.
- `migrations/`: D1 schema.
- `tests/cw-training-*.test.mjs`: date mapping, packing, rollover, idempotency,
  and calendar tests.

Add `/api/cw-training/*` and `/api/cw-training-calendar/*` to
`assets.run_worker_first`; ordinary site pages should continue to bypass Worker
code. Reuse the existing CWT schedule model for assignments that require
monitoring or working a CWT.

The offline field kit needs an explicit policy for this page. Cache the generic
application shell and hashed local assets, but never runtime-cache API responses.
The personal snapshot and pending attempts belong in IndexedDB. Keep the shell
outside Access and protect the API; a new device sees sign-in until it has a
snapshot. This lets an enrolled device load its cached plan after auth expires
without caching an Access login page. Audio still requires its upstream host.

## Authentication and privacy

Use a path-specific Cloudflare Access application for `/api/cw-training/*`,
with an allow policy for the owner's verified email. Prefer an existing GitHub
or Google login; use an email PIN as a fallback. The generic page shell contains
no private curriculum, meeting links, or history.

Configure this application and owner policy for 30 days (`720h`), Cloudflare's
one-month maximum rather than its 24-hour default. A valid application cookie
continues access even after the global SSO token expires. Once the application
token expires, the global token can renew it if still valid; otherwise sign-in
is required. Inspect existing global and MFA settings without changing
unrelated policies.

Expect initial login and roughly one renewal per browser during the course.
Cookie deletion, another browser, revocation, or stricter policies can prompt
earlier. This is not an indefinite or sliding session. Browsers manage cookies;
the user never handles API tokens.
Use one canonical hostname, `rwjblue.com`, for the training shortcut.

Add an authenticated `/api/cw-training/login` entry that returns to the shell
after Access completes. If sync loses authorization, preserve the block and
local records, display `Saved on this device - sign in to sync`, and defer that
navigation until the user chooses it. Never redirect an active player to login.

The Worker should still validate the `Cf-Access-Jwt-Assertion` header, issuer,
audience, signature, and expiry before reading or writing D1. Key user records by
the stable JWT subject, not a browser-supplied email. Require same-origin writes
and JSON content types. Keep the private route out of Pagefind, the sitemap, and
public analytics.

Offline access changes the local security boundary: signing out of Access does
not erase an already enrolled browser's IndexedDB. For this low-sensitivity
practice history, prefer offline convenience and rely on the device login, but
provide a prominent `Clear training data from this device` action. If that is
not acceptable on a shared device, setup should allow local caching to be
disabled.

Relevant platform references:

- [Access session lifetimes and renewal](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
- [Access authorization cookie](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)
- [GitHub login for Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/)
- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Validating Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare D1 Worker binding](https://developers.cloudflare.com/d1/worker-api/)
- [Selective Worker-first static asset routing](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Web Push for iOS and iPadOS Home Screen apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Curriculum content and attribution

The official curriculum includes a copyright notice that allows student use but
restricts other digital reproduction. The public repository should therefore
contain the generic planner, not a verbatim copy of all 48 daily assignments.

For the initial personal tool, keep the compact assignment map in the protected
D1 database, use original short labels only where needed to identify an
exercise, link every resource to its official host, and do not proxy, mirror, or
offline-cache the MP3 files. Ask CWops for written permission before offering a
public, preloaded Intermediate template to other students.

## Delivery slices

### Slice 1: useful private companion

- Path-specific Cloudflare Access, Worker JWT validation, and an initial D1
  migration with a private Session 1 curriculum seed.
- A 30-day owner session and a recovery flow that preserves active practice.
- The confirmed Monday/Thursday 3:30-4:30 p.m. Eastern course schedule, with
  editable meeting exceptions.
- Full `Today` and focus-block flow with 10/15-minute packing.
- Direct in-page official audio, repetition counting, pause/seek/replay, and
  durable playback position. Verify basic phone playback before extending UI.
- Local attempt log, reload-safe timer, JSON export, and the Session 1 bootstrap
  plan.
- Configured external-trainer links and guided sending; no copied media.
- Class packets with pasted/text-file/link import, usage labels, and a readable
  sending view. Preserve an unknown type or purpose without blocking practice.
- Whole-course activity/completion models, with representative later-session
  cases verified before expanding the curriculum seed.
- Tests for the September 5/7 boundary and all 16 meeting windows.

### Slice 2: durable sync and reminders

- Expand the private seed to all 16 sessions and add advisor overrides.
- Resolve resource discrepancies and validate all 48 daily assignments; add
  upcoming live-event windows and explicit alternative objectives.
- Idempotent D1 attempt sync and multi-device snapshot merge.
- Revocable calendar subscription with deep links.
- Week and history views.

### Slice 3: more practice stays in the page

- A focused ICR trainer with generated audio, correct character/Farnsworth
  timing, reveal/replay, and optional self-assessment. Preserve prescribed
  external-tool assignments unless the advisor accepts the equivalent.
- Difficult-section review using stored timestamps and polished phone controls.
- Optional Web Push and app-icon badge.
- Per-task optional score fields and trends.
- Suggestions based on repeated `Hard` attempts.

Introduce these features after using the core player and queue for a week.
Automatic sending assessment and a browser contest simulator are separate,
larger projects. Consistent practice is the criterion for adding either.

## Acceptance criteria

- Opening the tool identifies the correct curriculum session/day and next class
  without asking the user to browse the syllabus.
- One tap starts a useful block in under ten seconds.
- A 10-minute preference chooses fitting units and explicitly reserves longer
  prescribed runs; no required activity is silently shortened or split.
- Audio starts in the page, preserves pass/position through interruptions, and
  excludes pause, buffering, and seek jumps from listening time and pass coverage.
- A timer survives reload; manual practice duration is confirmed after a long
  suspension rather than credited automatically.
- Current iPhone Safari and the installed Home Screen app are tested for
  screen-lock playback, next-pass behavior, headphones, and interruptions.
- Session expiry preserves active practice and unsynced attempts; configured
  session lifetimes permit ordinary daily use without daily authentication.
- Monday/Thursday preparation is due at 3:30 p.m. America/New_York; the class
  hour does not consume or add to the personal practice quota.
- Attempts made offline appear immediately and sync exactly once later.
- Missed work is visible but never creates an unbounded backlog or silently
  becomes complete.
- Advisor changes survive curriculum data updates.
- The calendar reminder opens the current next action and can be revoked.
- Later-session cases cover longer stories, unspecified repetition counts,
  differing per-task speeds, WPX configuration, live windows and alternative
  objectives; a missing resource never becomes silently complete.
- Instructor text preserves its original content and revision. Unclassified
  material does not become homework; in-class use does not inflate practice time.
- Late additions preserve completed attempts and replace base work only when
  the replacement is explicit. Revised files do not rewrite earlier history.
- No private progress, notes, or curriculum seed appears in the static build,
  search index, sitemap, logs, or public analytics.
- No CWops audio or full assignment text is copied into the repository or site.
- The existing `mise run check` and `mise run build` pass, and the Today, focus,
  recovery, offline, and Access flows are verified at mobile and desktop widths.

## Decisions to confirm during implementation

The design has safe defaults, but setup should capture these rather than bake in
assumptions:

- the preferred everyday device;
- 10 or 15 minutes as the normal block size;
- MorseCode.World or LCWO as the normal ICR tool;
- whether Friday is always rest or can accept one deliberately carried item;
- any advisor-specific assignment changes.
- the actual formats, intended usage, and revision pattern of instructor
  material once the first email arrives.
