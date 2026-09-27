# CW Listening Practice

`/radio/cw-listening/` is a public static Astro tool. It uses the normal site
layout, appears in the Radio tools, search, and sitemap, and needs no account.
The private trainer mounts the same player in Focus and supplies history tracking.
Each new Word recognition session in the trainer starts with Common QSO words,
retaining saved speed and audio settings. Resuming an unfinished session keeps
its selected list. The public player's default and remembered lists are unchanged.

## Icons and lock-screen artwork

The site uses an RJ monogram for Robert Jackson (`public/favicon.svg`). The
listening and training pages use a green CW / N1RWJ icon
(`public/assets/branding/cw-icon.svg`), including their Apple touch icons.
Words, QSOs, stories, and course recordings explicitly supply that artwork to
Media Session through `src/lib/cw-listening/media-artwork.ts`.
The field kit precaches both sets of artwork for offline use.

After editing either SVG, run `mise run icons` to regenerate the checked-in PNGs
for browser tabs (32px), Apple home screens (180px), and installed apps and media
artwork (192px and 512px). SVG lettering uses paths rather than system fonts.

## Content and controls

- **Words:** 30 most common English words, Common QSO words, or custom text.
  `src/data/cw-listening/words.ts` owns the two public catalogs and their labels.
  The QSO catalog contains 70 distinct tokens in first-occurrence order. The
  original `77 all current.txt` attachment contains 75 entries; the catalog
  removes the second occurrence of RR, CL, WX, AR, and BEAM. Alternate spellings
  such as TKS and TNX remain separate entries. VVV stays first in every round,
  with the **Shuffle after VVV** option shuffling the remaining 69 entries.
  Saved built-in lists migrate to this catalog; custom lists and historical
  practice counts remain unchanged.
  Its former numeric label is supported only for draft migration.
- **QSOs:** four templates with coherent station profiles, a New QSO action,
  and alternating 450/500 Hz stations. `src/lib/cw-listening/qso-generator.ts`
  owns the templates and reusable callsign/name/location/equipment pools.
  The profiles are fictional practice material, not real operator biographies.
- **Stories:** three original short/medium/longer stories in
  `src/data/cw-listening/stories.ts`, with one 450 Hz narrator.

All modes offer a speed slider with stops at 12, 15, 18, 20, 23, 25, 28, 30,
35, and 40 WPM. **Enter speed** expands a numeric field for 10-60 WPM. An exact
speed outside the presets appears as an additional stop until another speed is
selected. Dragging previews the speed; releasing applies it. Native audio controls
provide play/pause, seek, volume, and replay. A **Back 10 sec** button rewinds
in every mode, stopping at the beginning. Optional text follows the current
word, transmission, or sentence. Each displayed word is a keyboard-accessible
button that jumps to that occurrence's exact start. Jumps preserve the current
play/pause state and do not award skipped time; listening again counts normally.
The current word uses a background highlight driven by the media clock, rather
than hover or the last clicked word. Keyboard focus has a separate outline.
Updates are not live screen-reader announcements. Text starts hidden and its visibility
is remembered across modes. Words also support shuffle, repeat, spoken answers,
pitch, and extra word spacing. Custom text stays on the device.

QSO generation happens once per selection/new session. Replay, speed changes,
and restoring an unfinished session keep the saved script. New QSO samples
another exchange with different callsigns. Stories are fixed authored text.
Changing QSO/story speed rebuilds the audio and seeks to the beginning of the
same word occurrence, including its station and line. During a gap it returns
to the preceding word; a completed recording stays at the end. Playback resumes
only if it was playing before the change. Rebuilding and seeking earn no time.
Word lists retain their existing behavior: the current item finishes at its old
speed and later words use the new speed.

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

Public URLs preserve the selection, speed (`wpm`), and text visibility
(`text=show` or `text=hide`). The **Copy link** button copies the current URL, with
a selectable text fallback if clipboard access is unavailable. Existing catalog
links remain supported:

- `/radio/cw-listening/?mode=words&list=common-30`
- `/radio/cw-listening/?mode=words&list=common-qso`
- `/radio/cw-listening/?mode=qsos&scenario=ragchew`
- `/radio/cw-listening/?mode=stories&story=story-radio`

The other QSO IDs are `short-contact`, `pota`, and `repeat`; other story IDs are
`story-trail` and `story-light`. QSO links also include a compact `qso` recipe,
for example `qso=1.1.0.0.0.0.0.0.0.0.t.j.d.5.1.5.5.6`. Its dot-separated base-36
integers contain the format version, template index, then eight pool indexes
per station: callsign, name, location, radio, power within that radio's choices,
antenna, weather, and report. Current recipes are 35 characters; the full exchange
is rebuilt in the recipient's browser. The generator stores the recipe alongside
the saved script. Older scripts can recover a recipe only if it reproduces their
exact text; otherwise Copy link is disabled until New QSO is chosen.

Recipe v1 pool entries and templates are a compatibility contract. New entries
may be appended; edits or reordering need a new format version and a retained
v1 renderer so published links do not change. Regression snapshots protect the
original scripts. Invalid, unsupported, or conflicting recipes show an error
instead of silently generating another exchange.

No custom word text, private history, session IDs, listened time, or playback
position enters URLs. Custom lists have no Copy link button. The recipient
starts paused at the beginning. Explicit URL settings override device preferences.
Reloading the same recipe restores the local session and its listened time;
changing speed or visibility does not reset that session. A different recipe or
catalog selection starts a fresh session. The trainer never writes these URL
parameters or exposes Copy link.

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
native seeking, rewind and word jumps (playing and paused), speed edits, repeated
playback, mode changes, reload, both word audio paths, and mobile/desktop
light/dark layouts.
