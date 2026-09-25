# CW training companion

`/radio/cw-training/` is the private CW Academy practice companion. The page
shell is static; curriculum, instructor materials, preferences, and practice
history come from an authenticated Worker API. It is excluded from search and
sitemaps, and does not load the site's analytics beacon.

## Daily use

The heading links to the public, fillable N1RWJ QSO cheat sheet at
`/downloads/radio/n1rwj-cwa-qso-cheat-sheet.pdf` from every training view.
The same PDF is linked from the CW QSO walkthrough's references. It provides
an opening, a flexible menu of two or three facts per turn, and a closing for
class and on-air practice.

- Today recommends today's work first and shows listening, sending, ICR, and
  simulator assignments together. Choose any exercise without setting an
  activity or time allowance first; sending still begins with its warm-up.
- Focus provides a timer, official audio player, source instructions, and
  large sending text. Non-simulator blocks say At your own pace. Listening
  exercises add a Suggested approach above the
  player, with the original instructions preserved below; instructor directions
  take precedence. Save for later preserves an unfinished block locally.
  Abort block stops and discards the current block, including its minutes,
  passes, notes, and sending captures. It creates no practice history or sync
  entry, and previously saved practice stays intact.
- Week exposes all 16 meetings and 48 assignments, including later on-air work.
- Materials accepts pasted instructions, text files, or links. Preparation,
  class-only, reference, and unknown-purpose material remain distinct. Revisions
  preserve previous text and never rewrite completed practice.
- Preferences provides the recording speed default, class join link,
  calendar reminder time and duration, data export, and device clearing.
- Report prepares the numbered class report from saved practice, with editable
  answers, a prefilled Google Form, and a history of submitted copies.

Today, Focus, Week, Materials, and Report participate in browser history. Back (including
the browser's swipe-back gesture) returns to the previous view; Forward reopens
it. Leaving Focus pauses listening and timers, saves the unfinished block on
this device, and stops a running simulator as partial. Returning does not
autoplay or start a new run. Refreshing preserves the selected view, with active
practice restored paused. Only the view name appears in the URL fragment; no
practice notes or private curriculum data enter the URL or browser history.
Background sync and rerenders do not create history entries. Finishing or
aborting a block does not let Back resurrect it. An aborted block also stays
discarded after refreshing, and Back from the initial view still leaves the
tracker normally.

In-app navigation scrolls to the top of the selected view below the shared
header. Every view and practice type uses the same content-top position,
including starting or resuming a block. Finish initially focuses Save practice
for audio and embedded Morse Runner blocks. Connected LCWO blocks focus the dialog
heading while results sync, then Save practice unless the user has moved focus
to another field. Manual drills and unconnected ICR blocks still focus minutes.

The imported course begins Saturday, September 5, 2026. Classes are Mondays and
Thursdays, 3:30-4:30 p.m. in `America/New_York`, from September 7 through October
29. Saturday/Sunday/Monday prepare for Monday; Tuesday/Wednesday/Thursday
prepare for Thursday. Friday has no independent-practice quota. Class time does
not count toward the 60-minute practice goal.
Today includes saved practice plus the current block on the same course date,
excluding class time.

Suggestions normally start with 15 minutes, but this is not a time limit or an
eligibility filter. Start a playable recording even when a full pass takes
longer, then save the time available or preserve the unfinished block for later.
Audio suggestions show the recording length and planned passes. Previously
stored activity and block-length preferences no longer control Today or new
practice blocks. Calendar reminder duration still offers 10 or 15 minutes and
uses the existing `preferences.blockMinutes` field to set calendar event length.
The existing storage and API fields remain compatible with older clients.

Practiced today sits below the assignments and starts collapsed, with the
number of saved sessions and their minutes in its header. Keep practicing has
direct Morse Runner and LCWO cards; additional exercises stay in the collapsed
Extra review panel. History, earlier work, and original instructions use
bordered disclosure panels with distinct headers and padded contents. The
panels retain native keyboard and screen-reader disclosure behavior.

Started exercises show a Started badge with saved pass counts
and practice time; the active block is marked Current block. Earlier unfinished
preparation for the same session appears separately from today's work. The
next session advances by date, without completing or skipping older objectives;
all assignments remain accessible in Week.

Unfinished work from previous classes includes all past-due classes, not just
the latest one. Add to today selects an exercise without starting a timer or
recording an attempt. It appears in the visible Added to today section. Its
original assignment, instructions, saved passes, and practice history stay unchanged.
Today's scheduled exercises remain the first automatic suggestions. Practice
now starts an old exercise immediately instead of adding it to today's list.

Added items sync across devices and apply only to the selected course date in
`America/New_York`. Remove from today removes only the selection; completion
also removes an item from the actionable list. At the next course date, an
unfinished item returns to its normal earlier-work location unless its reminder
was previously dismissed. Dismiss reminder hides a reminder, not the assignment
or its history; explicitly adding a dismissed item opts back into it for today.
There is no requirement to clear or dismiss the backlog.

Practice minutes and assignment coverage are separate. Partial listening counts
toward practice time, while recorded audio passes require whole playback; seeking
past an unheard section does not complete a pass. Finish block and Done elsewhere
let you mark an audio exercise complete with passes remaining when further
repetitions would not be useful. The actual minutes and pass count stay intact;
leave completion unchecked to continue later. Morse Runner assignments accumulate
confirmed practice time across saved runs, including interrupted runs. Exercises requiring
other equipment stay visibly pending until practiced.
If no unfinished assignment is available, optional review offers another block,
including after 60 minutes and on rest days. It uses the current/recent course
material at its selected recording speed and rotates through suitable exercises.
It does not automatically preview future audio assignments or mark them complete. Extra
review is labeled in Focus and history; its minutes count toward the day but
its attempts and passes do not count toward required assignment coverage.
Audio review respects full passes and never substitutes an unresolved recording.
A playable recording with an unmeasured length can still be started; its actual
listening time is recorded. Dedicated Morse Runner and LCWO reviews stay visible
while assignments are pending, during class, on rest days, and after the course.
Morse Runner starts with a 15-minute run and allows settings changes before Run.
It uses the most recent runner exercise, or the introductory Single Call exercise
before the first scheduled runner assignment. LCWO uses the most recent ICR
exercise, falling back to the first introductory ICR exercise before its scheduled
date. Focus preserves the source exercise's original instructions and settings.
Both reviews add practice minutes without completing the source assignment.
During class, the class view takes precedence over automatic independent-practice
recommendations. Live CWT tasks show eligible
operating windows and are recommended only while a window is active.

The daily minute goal is a baseline, not a cap or a replacement for sending
and other assigned activities. Starting another activity while a block exists
opens its finish dialog with Save and switch, Abort and switch, and Stay in
current block. Saving preserves practiced time, results, and notes; aborting
discards the current block without recording practice. Either switch choice
opens the selected activity in Focus. A running Morse Runner first stops and
collects its final results. Canceling the dialog or navigating away cancels the
switch. Returning to the same activity resumes its existing block. Word
recognition is a lightweight exception: starting another activity automatically
saves actual listening time and opens the selected activity without a dialog.

ICR blocks have no running stopwatch. Open the ICR entry, practice in LCWO,
then choose Finish block. When connected, Finish fetches fresh LCWO results and
suggests one minute per unique Letters, Figures, or Custom run completed after
opening the block and through clicking Finish, excluding runs already covered
by saved ICR practice. Save practice records that estimate as one block; the
same imported runs no longer add extra minutes to daily totals. The completion
checkbox remains your decision. Words, Callsigns, or other trainers need manually
entered minutes. Deliberate minute edits survive a fetch; failed fetches keep
the block and offer Sync LCWO again without preventing a manual save.

Sync LCWO is available in ICR Focus and the Finish dialog. Concurrent sync
requests in the same page share one request. Other block types do not trigger
an LCWO fetch when finished.

Log practice elsewhere starts with an Other practice group: Word recognition,
ICR (instant character recognition), POTA (Parks on the Air), CWT, On-air (other),
and Other CW practice. The general button defaults to Other CW practice; an assignment's Done
elsewhere button still preselects that assignment. Enter minutes and optional
notes, for example after listening to a Morse Code Ninja podcast. Other practice counts toward daily
practice time and appears by category in history, but never completes curriculum
requirements or earns audio passes. The form hides those assignment-only fields
for Other practice. Logging elsewhere does not replace an unfinished in-page block.

POTA and On-air (other) entries accept an optional QSO count. Zero means no
contacts; blank means the count was not recorded. Counts sync with the entry,
appear in practice history, and are listed by date under the report's Practice
sources and QSO counts for its selected dates. The instructor form has no
general QSO-count field, so these counts do not fill its CWT comments or invent
worked callsigns. Older entries and QSO counts written in comments stay as
recorded; the application does not infer counts from prose or reclassify them.

CWT entries also offer an optional QSO count, report comments, callsigns and first
names worked, and callsigns, names, and exchanges heard while monitoring. Enter
zero QSOs for listening-only practice, or leave the count blank if unknown.
Keep worked callsigns and names in the same order. Results remain visible in
practice history and sync with the entry. Within the selected report dates, CWT
entries supply editable monitoring and on-air QSO answers; dated QSO counts and
report comments go into the event-comments answer because the instructor form
has no separate CWT count field. Multiple sessions contribute in time order,
and repeated syncs do not duplicate an entry. Ordinary notes and scratchpad
prose are not copied into those answers. Existing deliberate report edits,
including blanks, remain intact when suggestions refresh. Suggestions longer
than the report's 4,000-character answer limit are shortened with a review
warning; full results remain in practice history.

Report suggestions also refresh automatically when saved practice changes,
including a corrected entry, even when there is no new LCWO import. Answers
you deliberately edited remain intact.

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

### Browser word recognition

Today > **Word recognition** opens optional word practice in Focus. Choose the
30 common words supplied on September 24, Bob's existing private 77-word reference
(when imported), or paste a custom list. All lists are selected inside the player;
Today has a single **Practice words** entry. The reference preserves its 75 entries
and duplicates; it is not a transcript of his MP3.

Controls offer 10-60 WPM, 300-1000 Hz pitch, 0-5 seconds of extra pause after the
standard seven-dit word gap, list order or a fresh shuffle each round, repetition,
and a **Show words / Hide words** button beside playback. Defaults are 40 WPM,
450 Hz, one extra second, shuffle and repeat enabled. On the next new block, old
30-WPM/600-Hz defaults migrate once; other customized values are preserved.
Subsequent choices carry into new blocks.

Speed can change during playback: the current word and its pause finish intact,
and the remaining words use the new speed with the same pitch and order. The
transition is scheduled on the audio clock, without waiting for a timer callback.
If the last word is already playing, the speed applies to the next round. Show/hide
and repeat work immediately; shuffle applies to the next round. Changing the list,
pitch, or spacing pauses playback and starts a fresh round on Play. One button
toggles **Play words / Pause words**, retaining the current position. The other
two buttons are **Show words / Hide words** and **Done**. Lists accept
1-200 whitespace-separated entries, punctuation and explicit prosigns; unsupported
text and rounds longer than ten minutes are rejected. Duplicates remain.

The existing pinned Morse Pro engine supplies word timings. A lazily loaded panel
renders a complete round as mono PCM with 5 ms tone envelopes and schedules a
Web Audio buffer. Its sound flows through a MediaStream destination to one native
audio element, which owns playback controls. The stream is generated locally;
it uses no microphone, network stream, or additional audio file. Dits and dahs do
not depend on JavaScript timers. Speed changes
render the remaining words and schedule a replacement buffer at a word boundary.
Starting the next round still requires a callback; throttling can delay that
transition. No MP3 is generated or downloaded, and no new service is involved.

Where supported, playback requests the Audio Session playback type and exposes
Media Session play/pause, list metadata, duration, and current position for Now
Playing controls. Switching apps does not deliberately pause word audio. An
interrupted audio context pauses the session and requires Play to resume.
Listening time comes from the audio clock, capped at the round's duration, so
suspension, pauses, and delayed loop callbacks cannot earn extra time. The owner
confirmed iOS background playback and the Now Playing card while playing on
September 24. Pause retains the native audio element and its loaded stream while
stopping all Morse sources and listening-time credit. Done or switching activities
removes the element, stops its tracks, and closes the context. This avoids removing
WebKit's Now Playing candidate whenever the last Morse source stops. Native pause
and interruption events also pause the trainer. Lock-screen pause/resume still
needs real-device verification with this output path; this is not a native iOS
Live Activity.

**Done** saves immediately and returns to Today. Starting another activity also
saves immediately, without a finish dialog. Both paths record actual listening
under `other-practice` / `other:word-recognition`, with the list title and settings
selected during listening, without course completion or LCWO credit. Visits with
less than one second of audio do not create empty history entries. The final audio
interval is accounted for before the player is disposed. History is queued with
the draft cleared in a serialized device-local write, then syncs when connected. Settings and custom text stay on this
device; only the history summary syncs. The summary retains the first fifteen
setting combinations and notes additional changes, without stopping playback.
An unfinished block checkpoints time and text, reloads paused, and starts a fresh
round on Play. Navigating away from Focus pauses the player and keeps the draft;
returning to word practice resumes it, while choosing another activity saves it.

### Optional daily word listening

The Word recognition card has one ten-minute suggestion for all word lists,
including any listening already recorded with Bob's original MP3. It remains available every day, including Fridays and
after the course. Today's counter sums actual listening across saved and current
sessions in the course timezone, without duplicating pending entries or including
recall. Ten minutes is a suggestion, not an automatic stop. All listening still
contributes to the main daily total, with no assignment completion.

The separate original-recording entry has been removed. Bob's list is available
in the Word recognition selector. Existing recording sessions can still be
resumed from Focus and saved, and their history remains valid.
The original `77.5.40.mp3` is 115.8955 seconds long; timing analysis indicates
approximately 40-WPM characters with extra word spacing. The supplied text has
75 entries (70 unique), preserved as received.

Original-recording sessions still save under `daily-listening` / `bob-77-words`.
They automatically repeat by default, including after ten minutes or a partially
heard loop; course recordings pause by default. The independent device preferences
`dailyListeningAutoReplay` and `audioAutoReplay` remain supported for restored
blocks. An unfinished recording block retains its pause/resume position. Reports
preserve recording history as optional practice.

The original 11,025 Hz MPEG-2.5 file stopped just before its reported end in
browser verification, preventing the normal `ended` event and replay. The importer
uses FFmpeg to make a 44,100 Hz mono, 32-kbps playback copy (115.931429 seconds,
464,056 bytes for this attachment). This changes the encoding without changing
the words, tone, speed, or spacing. The source attachment is left untouched.
FFmpeg and ffprobe must be installed to run the import task.

The playback MP3 is stored as bounded base64 in the existing private D1 database,
with metadata and text. `/api/cw-training/audio/bob-77-words` verifies the same
owner identity as the training API before serving GET/HEAD or byte-range requests.
Responses are `private, no-store`. Audio and instructor text never enter public
static assets, the repository, or the service worker cache. Offline audio and
uninterrupted locked-phone playback are not promised.

Apply `migrations/cw-training/0004_daily_listening.sql` before deploying the new
Worker. Import the two original attachments locally, then prepare private SQL:

```bash
mise run cw-training:import-daily-listening -- \
  /path/to/77.5.40.mp3 '/path/to/77 all current.txt'
npx wrangler d1 migrations apply rwjblue-cw-training --remote
npx wrangler d1 execute rwjblue-cw-training --remote \
  --file .tmp/cw-training-daily-listening.sql
```

Use `--local` for development. The importer accepts a source MP3 up to 500,000
bytes and text up to 10,000 characters; the playback copy must also fit within
500,000 bytes. Private SQL stays in ignored `.tmp/`.
Bounded staging chunks publish the recording atomically only after all chunks
arrive; rerunning an import replaces the asset without changing practice history.
An interrupted import can leave staging rows, but cannot replace the previous
recording with a partial file. This is a curated import, not a general upload UI.

Audio exercises offer verified official speed variants in Today, Week, and
Focus, before or after a block starts. Starting or pausing a block does not
disable any recording-speed selector. Selectors for the active exercise show
its actual recording and change that block wherever they appear; other
exercises' selectors prepare their next block without changing current work.
Assigned speed is the default; Next faster selects the nearest available speed
above the assignment. Per-exercise choices offer the assigned or faster speeds.
These preferences stay on this device and never rewrite the curriculum or old
history. Changing the recording speed default affects future blocks only.
The checked-in public metadata catalog contains only official file links,
exercise identities, speeds, and measured durations, not
course text.
Its exact source URLs distinguish short and long QSO files with similar names.
The catalog covers long QSOs, both long-story series, CWT, short words,
phrases, QSOs, POTA, prefixes, suffixes, and new short stories. CWT recordings
also support 30 WPM when officially published. A selector appears only when
at least two verified recordings are available at or above the assigned speed.
Recordings without verified speed variants retain their original recording.

Planning uses the selected recording's measured duration at native 1x playback
to suggest passes, without filtering out longer recordings. Whole faster passes
satisfy the same exercise; elapsed listening time remains actual time, not the duration
of the slower assigned file. Extra-review passes remain separate from required
coverage. Changing the current block's speed in any view pauses playback and
starts the new recording at the beginning of the current pass. Cumulative practice time,
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

Instant-recognition trainers, a physical key/radio, and online class meetings
remain external resources. Sending Focus renders the imported scales with
section headings and uppercase practice text, omitting the prelude and revision
date from the reader. Character groups and repeated phrases stay visually
separate; punctuation runs keep their prosign labels directly underneath.
The reader expands with the page instead of using a nested scroll box. Text size
remains adjustable. This presentation also works with previously downloaded
course snapshots and does not require a course reimport. Instructor material
retains its original text and casing.

Sending Focus also offers **Record my sending
(optional)** for warm-up and sending practice, using the pinned Morse Pro
decoder and timing player. The engine loads only after opening capture or a
saved replay. Ordinary practice never requests device permission or requires a
recording, decoded result, or connected adapter. Capture duration does not add
practice minutes or control completion; Finish and Done elsewhere retain their
editable minutes and completion check-in.
The offline field kit excludes the optional sending dependency graph from its
automatic download. Those assets use the existing bounded runtime cache after
explicit use, so capture may need a connection on first use or after cache
eviction. A missing capture chunk leaves the normal practice tools available.

Capture supports already-keyed Vail output: MIDI channel 1, note 0, or keyboard
Control signals while the capture area has focus. The adapter provides the keyer
and live sidetone. Raw dit/dah paddle passthrough is detected in MIDI mode and
stopped with an explanation; a browser keyer is not included. MIDI permission is
requested explicitly, followed by selection and a press/release test. Only the
selected matching input/output pair is opened, temporarily enabling MIDI output
and restoring keyboard output on disconnect. Speed, tone, and persistent keyer
settings are not changed. The decode/reference WPM must match the keyer's speed.
Brave desktop is the intended MIDI path. Safari on iOS has no Web MIDI support;
keyboard mode is offered with an explicit compatibility check. Physical Vail
behavior on these browsers still needs the hardware checks below.

Free sending is the default for warm-up. Compare with selected text accepts a
highlighted group from the original sending text or pasted text; instructions
are never inferred as a target. Record, stop, and review the decoder's reading
alongside the intended text. Text comparison normalizes case and spacing and
flags a possible mismatch; it is not an accuracy grade. Replay uses the received
mark/gap timing, while Play reference uses the selected WPM. Optional live text
is off by default. Keyer-generated element timing is not evidence of hand timing.

Takes stop safely on lost keyboard focus, disconnection, page hiding, navigation,
practice pause, or reload; incomplete marks are discarded. A take is bounded to
ten minutes and 12,000 timing intervals. Stopping capture alone does not pause
ordinary practice. Capture never reconnects or starts automatically. Keep a take
to record another, discard it, or continue without capture at any point.

Finish lets the user include a bounded text summary in the existing synced
history note and separately keep replay on this device. The latest ten saved
recordings are retained device-wide, in addition to up to ten takes in the
active block. Raw timing traces and unfinished drafts stay in IndexedDB; they
are never sent through the training API. Retained recordings are available from
Today and Week history, can be removed individually, and are included in device
export and clear. A replay does not start a practice timer. No database or API
migration is required. See [Morse Pro provenance and updates](morse-pro.md).

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
chosen run is separate from completing its assignment: required credit uses
cumulative saved practice seconds for that assignment. A 10-minute run plus a
5-minute run, or fifteen 1-minute runs, satisfies a 15-minute assignment. Stopped
and interrupted runs count their confirmed engine time too. Old partial records
count without a migration or re-entry. Run settings remain editable and recorded;
completion does not require a fixed mode or speed. Attempts are deduplicated by
ID, and class use and extra-review attempts remain separate from required
coverage. Suggested runs use the remaining assignment time, rounded up to a
whole minute and capped at the usual 15-minute starting suggestion.

Leaving Focus, switching apps, and page reload interrupt a run. Upstream cannot
resume a contest. After stopping, completing, or interrupting a run, Save & start
new run saves its time and result summary, then clears the simulator's timer,
score, and transcript in a fresh frame. Mode, conditions, and the last practiced
WPM carry forward; the next required run's duration is capped by the remaining
assignment time (rounded up to at least one minute). Click Run explicitly to
begin again. Completed or interrupted blocks say View results, not Resume.
Finish block remains available to add a note or performance rating and stop here.
Failed setup with no practiced time or results can restart without an empty
history entry. Each run has its own identity, result summary, and date; only
practice time is accumulated, not scores or transcripts. Repeating a completed assignment becomes
extra review. The old attempt and fresh block share one device checkpoint and
use the existing offline sync queue; no database change is required. A missing
engine/result retains the last confirmed time without inventing a score. Saved
terminal runs retain their status after reload until the user explicitly restarts.
Today's collapsed Practiced today panel contains expandable results, notes,
scratchpad, and performance ratings. Earlier difficulty ratings retain their
original meaning and are labeled as earlier ratings. Saved-to-account and waiting-to-sync entries
are labeled separately; an active device-local draft stays in the current-block card until
saved. Week's Practice history uses the same readable entries with dates. Report
selects the highest Verified Pts from one recorded run of at most 15 minutes;
longer duration breaks a tie. A five-minute run with 15 Verified Pts beats a
ten-minute run with 10. Results are never summed, scaled, or replaced by contest
score. Shorter and stopped runs remain eligible, and extra review counts.
The standalone link and Done elsewhere remain available for unsupported settings
or browser failures, with manually confirmed minutes/results for that separate run.
Older device-local blocks created before embedding keep their manual workflow.
See [the vendor/update workflow](web-morse-runner.md) for provenance, synthetic
practice-call data, offline verification, and deliberate upstream upgrades.
These are original summaries with external source links, not hosted PDF copies.

## Session reports

The Report view maps all 42 fields in Bob's Google Form. Select a numbered class
and inspect the practice dates, which default to its three preparation dates
through today. The target is two hours before the selected meeting. Opening
Today does not initialize a hidden report. An unedited draft date advances when
returning on another day; explicitly edited dates and windows stay selected.

New practice uses Very good, Good, Fair, or Poor instead of the former difficulty
scale. Report uses the latest explicit scales/listening-category rating in the
window. Earlier Hard/About right/Easy entries are preserved without conversion.
The finish dialog and Log practice elsewhere can record one LCWO run's drill,
actual speed, length, score, and error count or percentage. The external trainer
can also supply its saved results through the LCWO import described below.
Log practice elsewhere also records
the actual end date/time and optional manual Morse Runner results.

Structured Runner and audio results now sync with attempts. Actual run start/end
timestamps are retained when observed. Existing generated notes can still supply
report suggestions without rewriting older attempts. Audio suggestions use the
actual recorded file/speed combinations. Runner suggestions preserve the selected
run's WPM and show mixed speeds/settings for review.

Write `Learned: rig, antenna` on a scratchpad line to nominate newly learned words.
Only explicitly marked lines are extracted. Words are deduplicated without regard
to case, and words in a submitted report are excluded from subsequent suggestions.
The draft list remains editable. Monitoring, worked stations/names, and questions
are entered within the report; the unrelated CW QSO tool is not a data source.

Edits autosave on the device and survive switching report sessions. Save draft
adds an immutable version to the private account history. Refresh from practice
updates suggested answers while preserving edited answers, including after sync
to another device. Optional empty answers remain distinct from zero results.

Open filled Google Form validates the answers, saves a copy, and opens a prefilled
responder page. It does not submit the form. After Google Forms confirms receipt,
use Record submission to retain the exact opened copy, even if the editable draft
has since changed. The confirmation is the user's attestation, not an automated
receipt check. A download includes the report answers, dates, and source attempt
IDs. Reports and learned words are never put into the training page URL, public
HTML, search, analytics, or calendar feed.

Report history requires `migrations/cw-training/0002_reports.sql` to be applied
before deploying the updated Worker. Use the existing D1 migration command in
Curriculum import below; `mise run deploy` does not apply migrations automatically. This
change does not add a scheduler or an automatic Google Forms submission service.
Verified automatic submission is tracked in
[issue #16](https://github.com/rwjblue/rwjblue.com/issues/16).

### LCWO result imports

Once connected, entering Report imports saved LCWO results when the last
successful import is at least five minutes old. Sync LCWO in Report or ICR
Focus/Finish requests an import immediately, and opening Finish for an ICR
block does the same automatically. These requests use `fresh: true` to bypass
the server's one-minute cache so a just-completed run can be imported. Older
clients without that flag still share cached results for one minute. There is
no background polling. Offline or failed imports keep saved results and drafts.
Only unedited report answers refresh; manually entered values stay intact.

LCWO uses a normal username/password login and authenticated
[`export_results` JSON endpoints](https://github.com/dj1yfk/lcwo/blob/master/api/index.php#L77-L123).
The Worker signs in for each import and reads words, callsigns, groups, and Koch
exports. It keeps the session cookie only for that request. Neither credentials
nor cookies reach the browser, D1, logs, reports, or public assets. Store the
login once as Worker secrets using the interactive prompts:

```bash
npx wrangler secret put TRAINING_LCWO_USERNAME
npx wrangler secret put TRAINING_LCWO_PASSWORD
```

For local testing, these optional values belong in ignored `.dev.vars`. No LCWO
secret is required for the rest of the training application to work. Change the
secret if the LCWO password changes; do not paste passwords into report fields.
Apply `migrations/cw-training/0003_lcwo.sql` before deploying this change using
the existing D1 migration command. The migration adds private result and sync
tables to the existing database, without changing practice attempts.

Imported runs retain the LCWO user/result IDs, exact source timestamp, and
measurements. LCWO's maintainer
[confirmed the database server now uses UTC](https://lcwo.net/forum/3503/LCWOnet-moved-to-a-new-server).
Report filtering converts those instants to the course timezone. Imports retain
runs from the first course preparation date onward. Repeating an import does not
duplicate records, and upstream deletion does not erase already saved evidence.
Each unique imported Letters, Figures, or Custom code-group run counts as one
estimated exercise minute, based on the owner's one-minute exercise setting.
Today includes these minutes in its daily total and labels the added estimate
in saved practice; Report shows the estimate for all speeds in its selected
window. Words, Callsigns, and ordinary Koch lessons do not add estimated time.
The API does not measure duration, typing, checking, or breaks. Imports do not
create practice entries, completed passes, or assignment completion credit.

To avoid double-counting, a run whose completion timestamp falls within a saved
ICR practice block with positive duration adds no extra time. This includes
extra ICR and review blocks, even across midnight. ICR blocks may contain several
drills; entering one result does not restrict their time coverage. For legacy
results attached to other task types, only the named drill is covered. Manually logged block times must
reflect when the practice actually happened. Reimporting or editing a block
recalculates the totals from unique IDs instead of accumulating minutes.
Report estimates use course-local dates and retain the imported result IDs
alongside their ordinary practice source IDs.

Imported Letters, Figures, and Custom groups assume the assigned group length
of 3. Their error percentage is the arithmetic mean of `100 - accuracy` across
imported runs in the selected report window at the latest run's character and
effective speeds, rounded to one decimal place. Different drills and speeds
are never averaged together. Runs without accuracy are excluded from the mean;
if none have accuracy, errors remain blank. If the latest run lacks either
speed, only that run can supply errors. The source card shows the average, run
count, speeds, and assumed length, and saved reports retain all contributing
LCWO IDs. This deliberately uses exported accuracy as the practical reporting
measurement rather than requiring manual transcription of displayed errors.
Importing individual runs does not create separate timed practice blocks.

Callsign and word scores still use the latest run; their training speeds,
maximum word length, and error counts need manual entry. Maximum successful-copy
WPM remains evidence rather than a substitute for starting/fixed speed.
A newer manually recorded result takes precedence over imports for its drill,
including imports completed within that block. Explicit report edits, including
group lengths and blanks, survive refreshes. Review preserved edits when newer
results arrive. The length assumption applies only to imported code groups,
not to Word Training maximum length or ordinary Koch lessons.

Koch lessons retain their own identity and are not treated as custom-character
groups. Plaintext, QTC, and mixed code-group results do not map to this report.
Imports reject malformed or conflicting records and bound each export to 8 MiB,
the combined source data to 50,000 rows, and retained course history to 10,000
results. A new course import must fit in a 1.5 MB database input. Limit failures
leave the previous successful import available.

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
Self-directed entries use the reserved `other-practice` assignment ID and one of
the stable `other:*` task IDs in `other-practice.ts`. The API requires a known
category, practice context, `review: true`, `completed: false`, and no earned
passes. These entries use the same private storage, offline queue, and time
totals as other attempts, without being attached to a curriculum assignment.
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

The September 24, 2026 audio audit checked all 120 audio assignments across
the 48 practice days. All 117 available assigned recordings match the speed
catalog. The remaining entries are the two CWT discrepancies above and
`WD405-25`, whose published URL returns HTTP 404 (all six WD405 speeds failed
verification). `CWT201-20` and `CWT202-20` each have only one published speed.
Exercises already assigned the fastest recording also have no speed selector.
These source limitations are not filled with guessed URLs or different exercises.

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
Add to today/remove, reload, and the Eastern date boundary;
Morse Runner and LCWO review discoverability; collapsed history and disclosure
keyboard behavior; editable starting settings and mid-run speed;
and separate review, partial-run, and assignment-completion credit.

The owner first-use verification and real-phone playback checks are tracked
in [issue #14](https://github.com/rwjblue/rwjblue.com/issues/14).

For optional sending, use a synthetic local course for browser checks; do not
copy private curriculum into public fixtures. Verify ordinary sending with
capture unopened, denied MIDI permission, keyboard press/release testing,
known Morse capture and replay, interrupted held marks, save/reload, summary
opt-out, and retained recordings after saving. Confirm that corrected minutes
and completion work with no captured events and that sync payloads never contain
raw timings. Check the panel and finish dialog at phone and desktop widths.

Before relying on a physical adapter, check Vail in Brave desktop: select the
correct MIDI port, receive channel-1 note-0 press/release pairs, listen for local
sidetone without a duplicate browser tone, unplug during a mark, and reconnect
explicitly. Verify other MIDI devices and persistent keyer settings remain
unchanged. Check keyboard mode separately on the actual iPhone/iPad with Safari
and its USB connection; browser viewport emulation cannot verify USB HID input.
Unsupported or denied input must still allow normal practice and manual logging.
