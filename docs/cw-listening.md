# CW Listening Practice

`/radio/cw-listening/` is a public static Astro tool. It uses the normal site
layout, appears in the Radio tools, search, and sitemap, and needs no account.
The private trainer mounts the same player in Focus and supplies history tracking.

## Content and controls

- **Words:** 30 most common English words, Common QSO words, or custom text.
  `src/data/cw-listening/words.ts` owns the two public catalogs and their labels.
  The QSO reference preserves all 75 supplied entries (70 unique) in order.
  Its former numeric label is supported only for draft migration.
- **QSOs:** four templates with coherent station profiles, a New QSO action,
  and alternating 450/500 Hz stations. `src/lib/cw-listening/qso-generator.ts`
  owns the templates and reusable callsign/name/location/equipment pools.
  The profiles are fictional practice material, not real operator biographies.
- **Stories:** three original short/medium/longer stories in
  `src/data/cw-listening/stories.ts`, with one 450 Hz narrator.

Word speed is 10-60 WPM; QSO/story speed is 10-40 WPM. Native audio controls
provide play/pause, seek, volume, and replay. Optional text follows the current
word, transmission, or sentence. Word highlighting uses the media clock; updates
are not live screen-reader announcements. Text starts hidden and its visibility
is remembered across modes. Words also support shuffle, repeat, spoken answers,
pitch, and extra word spacing. Custom text stays on the device.

QSO generation happens once per selection/new session. Replay, speed changes,
and restoring an unfinished session keep the saved script. New QSO samples
another exchange with different callsigns. Stories are fixed authored text.

## Shared implementation

- `src/components/CwListeningPlayer.astro` supplies the shared host and styles.
- `src/lib/cw-listening/player.ts` mounts the three-mode interface with callbacks
  for cumulative time, draft edits, visibility, mode changes, and finish.
- The neighboring word/QSO panels, timelines, Morse timing, WAV renderer, and
  native media player contain no private training dependencies.
- `src/lib/cw-listening/client.ts` owns the public page's local session policy.
- `src/lib/cw-training/listening-adapter.ts` converts trainer blocks and applies
  cumulative time without duplicate credit. The trainer client owns saving/sync.
- Old training module paths re-export the shared code for compatible imports;
  playback is implemented only once.

The session counter measures audio actually listened, including intentional word
and station gaps. Paused time, buffering, and seeking do not earn time. All
transitions settle the native media clock before disposing audio. Audio position
and accumulated listening time are separate values. Native background playback
remains browser-dependent; physical phone lock-screen behavior needs device QA.

## Public persistence and trainer tracking

Public settings use `cw-listening-preferences-v1` in localStorage. The current
public session uses `cw-listening-session-v1`, including its ID, total, and
generated QSO script. Reload restores paused at the recording's beginning,
retaining listened time. End session shows the total; Start another session
creates a new ID and resets the counter. Changing modes keeps the public session
total. Storage failures do not block playback.

The trainer shares preferences on the same origin, with existing trainer
defaults as a fallback. Active sessions retain their own settings snapshots.
Its active block and IndexedDB history remain separate from public sessions.
Public playback never calls private APIs, even if the browser is signed in.

Inside the trainer, mode changes save the previous block before starting a new
one. Word listening saves under `other-practice` / `other:word-recognition`;
QSOs/stories save under `other-practice` / `other:general`. Stable attempt IDs and
the existing serialized write queue prevent duplicate history. These modes
never award course completion or on-air QSO credit. Original private recording
sessions and historical attempts remain supported.

## Links and audio assets

Preset URLs accept catalog IDs only:

- `/radio/cw-listening/?mode=words&list=common-30`
- `/radio/cw-listening/?mode=words&list=common-qso`
- `/radio/cw-listening/?mode=qsos&scenario=ragchew`
- `/radio/cw-listening/?mode=stories&story=story-radio`

The other QSO IDs are `short-contact`, `pota`, and `repeat`; other story IDs are
`story-trail` and `story-light`. No custom text or private data enters URLs.
Reloading the same preset restores its unfinished session; opening a different
preset starts a fresh session.

Exact matching word configurations use existing public generated MP3s. Other
configurations use temporary browser-generated WAVs, combining published spoken
clips when enabled. A missing MP3 index falls back to generation. QSOs and
stories generate in-browser. No runtime AI/audio rendering service is involved.

Existing `/audio/cw-training/words/` and `/audio/cw-training/recordings/` URLs stay
stable. Their generated assets are public; the original instructor MP3 and
private curriculum remain authenticated. Regeneration uses
`mise run cw-training:generate-word-recordings` for both checked-in word lists.
Pronunciation changes also require regenerating the relevant speech clips first;
see [cw-training.md](cw-training.md#pronunciation-and-local-audio-generation).

This page adds no Worker routes, public accounts, cloud history, or service-worker
audio downloads. First-visit offline operation is not promised.

## Verification

`tests/cw-listening.test.mjs` covers public catalog/asset compatibility, legacy
labels, session/preset validation, independent preferences, trainer category and
time conversion, and the public dependency boundary. Existing word/QSO tests
exercise the shared audio implementation through compatible import paths.
Run `npm test`, `npm run check:training`, `mise run check`, and `mise run build`.
Browser QA should cover signed-out playback and private tracking separately,
native seeking, speed edits, repeated playback, mode changes, reload, both word
audio paths, and mobile/desktop light/dark layouts.
