# CW training companion

`/radio/cw-training/` is the private CW Academy practice companion. The page
shell is static; curriculum, instructor materials, preferences, and practice
history come from an authenticated Worker API. It is excluded from search and
sitemaps, and does not load the site's analytics beacon.

## Daily use

- Today recommends today's work first, matching the time available and
  activity: Anything, Listen, Send, or Computer. Listen is
  native audio/head copy; Send uses a physical key; Computer covers ICR and
  simulator work. This device remembers the activity choice. It is a suggestion,
  not a mandatory exercise sequence; sending still begins with its warm-up.
- Focus provides a timer, official audio player, source instructions, and
  large sending text. Listening exercises add a Suggested approach above the
  player, with the original instructions preserved below; instructor directions
  take precedence. Save for later preserves an unfinished block locally.
- Week exposes all 16 meetings and 48 assignments, including later on-air work.
- Materials accepts pasted instructions, text files, or links. Preparation,
  class-only, reference, and unknown-purpose material remain distinct. Revisions
  preserve previous text and never rewrite completed practice.
- Preferences provides the usual 10- or 15-minute block length, class join link,
  calendar reminder time, data export, and device clearing.

Today, Focus, Week, and Materials participate in browser history. Back (including
the browser's swipe-back gesture) returns to the previous view; Forward reopens
it. Leaving Focus pauses listening and timers, saves the unfinished block on
this device, and stops a running simulator as partial. Returning does not
autoplay or start a new run. Refreshing preserves the selected view, with active
practice restored paused. Only the view name appears in the URL fragment; no
practice notes or private curriculum data enter the URL or browser history.
Background sync and rerenders do not create history entries. Finishing a block
does not let Back resurrect it, and Back from the initial view still leaves the
tracker normally.

The imported course begins Saturday, September 5, 2026. Classes are Mondays and
Thursdays, 3:30-4:30 p.m. in `America/New_York`, from September 7 through October
29. Saturday/Sunday/Monday prepare for Monday; Tuesday/Wednesday/Thursday
prepare for Thursday. Friday has no independent-practice quota. Class time does
not count toward the 60-minute practice goal.
Today includes saved practice plus the current block on the same course date,
excluding class time.

Time available temporarily offers 3, 5, 10, or 15 minutes without changing the
usual block-length preference. Shorter choices appear only when suitable work
fits the selected activity. Suggestions show the actual planned duration and,
for audio, the number of passes in this block. Each pass must fit; all assigned
repetitions need not fit in one block.

Started exercises show a Started badge with saved pass counts
and practice time; the active block is marked Current block. Earlier unfinished
preparation for the same session appears separately from today's work. The
next session advances by date, without completing or skipping older objectives;
all assignments remain accessible in Week.

Unfinished work from previous classes includes all past-due classes, not just
the latest one. Add to today selects an exercise without starting a timer or
recording an attempt. It appears in the visible Added to today section even if
it needs a different activity or more time than currently selected. Its original
assignment, instructions, saved passes, and practice history stay unchanged.
Today's scheduled exercises remain the first automatic suggestions. Practice
now starts an old exercise immediately instead of adding it to today's list.

Added items sync across devices and apply only to the selected course date in
`America/New_York`. Remove from today removes only the selection; completion
also removes an item from the actionable list. At the next course date, an
unfinished item returns to its normal earlier-work location unless its reminder
was previously dismissed. Dismiss reminder hides a reminder, not the assignment
or its history; explicitly adding a dismissed item opts back into it for today.
There is no requirement to clear or dismiss the backlog.

Practice minutes and assignment coverage are separate. Whole audio passes are
packed into blocks; seeking past an unheard section does not complete a pass.
Coverage and the final completion check-in are both required. A prescribed
15-minute simulator run cannot be replaced by two short interrupted runs.
Exercises requiring other equipment stay visibly pending; changing the activity
choice never changes coverage.
If no unfinished assignment fits, optional review offers another suitable block,
including after 60 minutes and on rest days. It uses the current/recent course
material at its selected recording speed and rotates through suitable exercises.
It does not automatically preview future audio assignments or mark them complete. Extra
review is labeled in Focus and history; its minutes count toward the day but
its attempts and passes do not count toward required assignment coverage.
Audio review respects full passes and never substitutes an unresolved or
unmeasured recording. A dedicated Morse Runner review stays visible in every
activity mode, including while assignments are pending, during class, on rest
days, and after the course. It starts with the selected 3-, 5-, 10-, or 15-minute
block and allows settings changes before Run. It uses the most recent runner
exercise, or the introductory Single Call exercise before the first scheduled
runner assignment. These short reviews never complete a required simulator run.
Automatic suggestions still respect the selected activity: Runner is suggested
only for Anything or Computer. During class, the class view takes precedence
over automatic independent-practice recommendations. Live CWT tasks show eligible
operating windows and are recommended only while a window is active.

The daily minute goal is a baseline, not a cap or a replacement for sending
and other assigned activities. To switch activities with a saved block, choose
Record block and switch, confirm the partial practice, then select the next
block. Saving partial practice preserves the unfinished objective.

Listening uses head copy by default, not mandatory transcription. The optional
Recall & notes scratchpad holds up to 10,000 characters. While audio is paused,
choose Start recall timer to count deliberate recall or note-taking, and Pause
recall timer to stop counting it. Recall time contributes to total practice
(`activeSeconds`) but never earns an audio pass. Ordinary pauses and background
time do not automatically become recall time.

Official MP3s play directly in a native audio element, without a `crossorigin`
attribute. The source supports playback and range requests but does not grant
cross-origin fetch access. There is no audio proxy, mirror, waveform fetch, or
automatic transcription. Initial playback needs a user gesture. Media Session
controls are progressive enhancements; uninterrupted playback with a locked
phone still requires real-device verification. Offline audio is not promised.

Short recordings offer verified official speed variants before a block starts
and through the Recording speed selector in Focus, even after playback starts.
Assigned speed is the default; Next faster selects the nearest available speed
above the assignment. Per-exercise choices offer the assigned or faster speeds.
These preferences stay on this device and never rewrite the curriculum or old
history. Selectors outside Focus remain prelaunch controls; changing the default
affects future blocks only. The checked-in public metadata catalog contains only
official file links, exercise identities, speeds, and measured durations, not
course text.
Its exact source URLs distinguish short and long QSO files with similar names.
Unknown or unresolved resources keep their original behavior.

Planning uses the selected recording's measured duration at native 1x playback,
including eligibility for 3- and 5-minute blocks. Whole faster passes satisfy
the same exercise; elapsed listening time remains actual time, not the duration
of the slower assigned file. Extra-review passes remain separate from required
coverage. Changing Recording speed in Focus pauses playback and starts the new
recording at the beginning of the current pass. Cumulative practice time,
completed whole passes, scratchpad, and required-versus-review identity remain
intact. Partial coverage never combines across recordings, and difficult-position
markers remain attached to the recording where they were made. The original
curriculum instructions do not change.

Every saved in-page audio attempt automatically prefixes its existing database
note with the actual recording, practiced WPM, assigned WPM, and source URL.
For mixed-speed blocks, it also groups practice time (including recall),
completed whole passes, and recording-specific difficult-position markers by
each exact official source URL.
The finish dialog displays this metadata separately from the editable reflection.
An active block's recording history stays on this device until Finish and
Save practice sync the attempt.
This uses the existing immutable attempt API and requires no database migration.
Refresh official variant metadata with `mise run cw-training:update-audio-variants`.

Instant-recognition trainers, a physical key/radio, and online
class meetings remain external resources. The page guides and logs those
exercises; it does not replace them or score live sending.

Morse Runner tasks link to the official
[CWops Community Edition guide](https://cwops.org/wp-content/uploads/2025/01/Morse-Runner-CE.pdf)
in Today, Week, and Focus. Focus adds a compact setup reminder and expandable
operating reference. The instructor-recommended
[Web Morse Runner](https://fritzsche.github.io/WebMorseRunner/) runs in a locally
hosted, version-pinned iframe. Single Call and WPX Contest map from the original
curriculum without rewriting assigned speed, duration, or activity. These are
starting defaults, not locked settings: mode, duration, activity, and band
conditions can change before Run, and CW Speed can change before or during a
run. The tracker records what was actually used, independently of the original
instructions.
The user enters their station call and comfortable pitch, then explicitly clicks
Run to activate audio. No course content or authentication tokens go into the
message protocol. The frame isolates keyboard handling and styles, not security.
The [web runner documentation](https://github.com/fritzsche/WebMorseRunner#usage)
is linked alongside Mac button guidance and a post-run transcript reminder.
CWops PDFs and desktop downloads remain available as clearly labeled desktop
references, not instructions to install a Windows app or find a separate
CQ WPX contest selector in the web interface.
The embedded engine's elapsed seconds are the only timer for these blocks; setup
and stopped time do not count. Finish block stops and awaits final results before
opening the save dialog. The existing database note automatically records mode,
starting speed, engine-timestamped speed changes, chosen duration,
activity/conditions, QSOs, Verified Pts, verified score, NR/NIL errors, and upstream
revision. Long speed-change histories use a bounded summary plus the distinct
speeds used so automatic notes remain within their size limit. Completing a
chosen run is separate from completing its assignment: required credit needs a
full uninterrupted run in the original assigned mode lasting at least the
assigned duration. WPM may vary; a shorter run or different mode records useful
practice but leaves the assignment incomplete. Multiple partial runs never
combine into an assigned full run. Extra-review attempts remain separate from
required coverage regardless of their duration or settings.

Leaving Focus, switching apps, and page reload interrupt a run. Upstream cannot
resume a contest, so save its partial time before starting another. A missing
engine/result retains the last confirmed time without inventing a score. Saved
terminal runs retain their status after reload; no replacement contest starts.
The standalone link and Done elsewhere remain available for unsupported settings
or browser failures, with manually confirmed minutes/results for that separate run.
Older device-local blocks created before embedding keep their manual workflow.
See [the vendor/update workflow](web-morse-runner.md) for provenance, synthetic
practice-call data, offline verification, and deliberate upstream upgrades.
These are original summaries with external source links, not hosted PDF copies.

## Private data and synchronization

`src/lib/cw-training/types.ts` defines the course, assignment, attempt, material,
and preference contracts. `plan.ts` derives the queue from those records.
IndexedDB retains the downloaded snapshot, pending changes, and active block.
Scratchpad and recall-timer drafts autosave on this device only. Finish, then
Save practice, includes the notes and recall time in the saved history and
syncs them through the existing private API; an unfinished draft is not synced.
The service worker caches only the generic shell and public code/assets, never
API responses or instructor content. Use a trusted device and clear its training
data before sharing it. Local data is not encrypted separately from browser
storage; a lost device can expose its saved snapshot.

D1 owns synced records. The optional `review` boolean on an attempt distinguishes
extra practice; omitted values preserve the original required-practice behavior.
It uses the existing sync endpoint and JSON storage without a schema migration.
Attempts and material revisions are immutable and
idempotent by ID. Preferences use their update timestamp to resolve stale
device writes. The optional `preferences.carriedTasks` array stores bounded,
unique `{ taskId, date }` selections using known course tasks and real calendar
dates. It uses the existing preference JSON/API, with no database migration or
new practice attempts. Older clients that omit this field preserve existing
selections; an explicit empty array clears them under the same timestamp rule.
API responses use `private, no-store`; mutations require a
same-origin JSON request with bounded input. The Worker verifies the Access
JWT's signature, issuer, audience, expiry, and configured owner email. Client
identity headers cannot enroll another user.

The calendar URL is a bearer capability. Its token is stored only as a SHA-256
hash in D1 and can be rotated or revoked in preferences. It exposes generic
practice reminders and a link to the page, never class links, instructor text,
or history. Treat the subscription URL as private. Automatic Worker invocation
logging is disabled because it would record the token-bearing request path.
Calendar apps control refresh timing and whether subscribed alarms are shown.

## Cloudflare setup

`wrangler.jsonc` binds the `rwjblue-cw-training` database as `TRAINING_DB`.
The database, course, and owner-only Access application are provisioned.
The application is named `CW Academy training`, with ID
`e9145a0f-f889-4671-a17f-14c1ad1f4d8c`, in the existing
`fragrant-cake-b1d4.cloudflareaccess.com` team. Empty Access variables still
intentionally return 503 and never expose the seeded curriculum.

The self-hosted Cloudflare Access application protects
`rwjblue.com/api/cw-training/*` and `n1rwj.com/api/cw-training/*`. Keep the shell
and `/api/cw-training-calendar/*` outside Access. The latter performs its own
capability validation. The `CW training owner` allow policy permits only
`me@rwjblue.com`, using the team's existing email one-time PIN sign-in.
Open the training page and choose Sign in, then enter the emailed code directly
on Cloudflare's sign-in page. Cloudflare dashboard sign-in is separate and is
not required for daily practice.

Both application and allow-policy session duration are `720h` (30 days), shown
as `1 month` in the dashboard. The authorization cookie is HTTP-only.
This avoids a daily code prompt; clearing cookies, revocation, or changing
browsers can still require earlier sign-in. Each browser needs its own initial
sign-in. Do not change unrelated global session settings. These non-secret
Worker variables in `wrangler.jsonc` identify the team, application, and owner:

```text
TRAINING_ACCESS_TEAM=https://<team>.cloudflareaccess.com
TRAINING_ACCESS_AUD=<Access application audience tag>
TRAINING_OWNER_EMAIL=me@rwjblue.com
```

The current Wrangler OAuth deployment token does not grant Access organization
configuration. Setup requires the dashboard or a locally supplied API token
with account permissions `Access: Apps and Policies Write` and
`Access: Organizations, Identity Providers, and Groups Write`. Never commit
that token. Configure both hostnames in one application/audience, or use only
the canonical hostname until both are protected. The Worker still rejects
unsigned requests on preview/alternate hosts.

See Cloudflare's [session management documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
and [Access application API](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/).

## Curriculum import and updates

The importer uses the [official Intermediate curriculum](https://cwa.cwops.org/wp-content/uploads/Practice-Instructions-Intermediate-ver.2.2.htm),
[practice-file index](https://cwops.org/intermediate-practice-files/), and
[sending scales](https://cwops.org/wp-content/uploads/2024/08/Everyday-Send-Code-Web.htm).
It preserves original wording and selected sending sections privately. Full
curriculum text and recordings must not be checked into the public repository.
Only generic parser/planner code and synthetic tests are tracked.

```bash
node scripts/cw-training/import.mjs \
  --output .tmp/cw-training-course.json \
  --sql .tmp/cw-training-course.sql \
  --probe-audio
npx wrangler d1 migrations apply rwjblue-cw-training --remote
npx wrangler d1 execute rwjblue-cw-training --remote \
  --file .tmp/cw-training-course.sql
```

Review changes to the private JSON before reimporting. Stable assignment/task
IDs preserve existing attempts. SQL uses bounded staging chunks and publishes
the final valid course atomically; a failed partial import leaves the previous
course intact. The production import has 48 assignments, 214 tasks, and 117
resolved recordings with measured durations.

Two source discrepancies intentionally remain unresolved: `CWT209-20` versus
the index's 25-WPM file, and `CWT213-25` versus its 30-WPM file. Ask the advisor
which recording to use before updating these resource records. The importer
never invents a substitute URL. Session/day speed exceptions are preserved.

Instructor files are added through Materials, not by changing the curriculum.
There is no inbox access or automatic email ingestion. Unknown file formats,
rescheduled class dates, and a built-in instant-recognition trainer are future
extensions; do not silently reinterpret instructor directions.

## Local development and verification

Create an ignored `.dev.vars` containing only:

```dotenv
TRAINING_DEV_USER="cw-training-local-qa"
TRAINING_ACCESS_TEAM=""
TRAINING_ACCESS_AUD=""
```

The development identity works only on loopback with both production Access
settings empty. Never add `TRAINING_DEV_USER` to production configuration.

```bash
npx wrangler d1 migrations apply rwjblue-cw-training --local
npx wrangler d1 execute rwjblue-cw-training --local \
  --file .tmp/cw-training-course.sql
npx wrangler dev --local --ip 127.0.0.1 --port 8787 \
  --local-upstream 127.0.0.1:8787
```

The local upstream override is required: otherwise Wrangler substitutes the
production hostname and the loopback-only identity correctly refuses access.
Plain `mise run dev` serves the static shell without the Worker API.

Run `npm test`, `npm run check:training`, `mise run check`, `mise run build`, and
`mise run deploy -- --dry-run`. Regenerate Worker types after binding changes
with `npx wrangler types --strict-vars=false`. Also check the live page at phone
and desktop widths, Back/Forward between views, reload into Focus, leaving an
active block without losing progress, pause/reload/resume, audio seeking and
complete passes,
mid-block recording changes without combining partial passes, per-recording
time/markers in saved notes, offline logging/reconnect, instructor text revisions,
calendar revocation,
and unauthenticated API rejection before declaring a rollout ready. Verify
Add to today/remove across filters, reload, and the Eastern date boundary;
Runner review discoverability; editable starting settings and mid-run speed;
and separate review, partial-run, and assignment-completion credit.

The owner first-use verification and real-phone playback checks are tracked
in [issue #14](https://github.com/rwjblue/rwjblue.com/issues/14).
