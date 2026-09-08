# Optional sending practice: investigation and design review

Research checked September 8, 2026. This is a proposal and a synthetic interactive
mockup, not an implementation or a change to the training system.

The best path is to try Stephen Phillips's existing Morse Code World sending
tools, then build an optional native capture layer only where integration adds
value. His `morse-pro` library can supply decoding, keying, and playback. A
complete, mature, supported component that also supplies device setup, grading,
history, and our curriculum integration was not found.

The proposed experience keeps normal sending practice intact: start the existing
block, read the warm-up, and practice. Choose **Use my key** only when recording
would help. Capturing, retrying, discarding, or losing the adapter does not decide
practice credit or assignment completion.

## What we can reuse

| Tool | Verified capabilities | Reuse and support assessment |
| --- | --- | --- |
| [Morse Code World Sending Practice](https://morsecode.world/labs/sending-practice/) | Prompted sending, decoding, target comparison, original/reference replay, timing feedback, history export | Closest existing experience. The page explicitly calls itself experimental. Excellent trial and design reference; no documented integration/results API found. |
| [Morse Code World keyer](https://morsecode.world/international/trainer/keyer.html) | Vail keyboard input, free sending, live decode, original/reference playback, timing plots | Useful immediately for warm-up. The instructions explain how to avoid applying a software keyer to already-keyed Vail output. |
| [morse-pro](https://gitlab.com/scphillips/morse-pro) | Morse generation, duration-based decoding, adaptive decoding, keyers, playback | Strongest reusable foundation. Current source is active; published npm package is substantially older. Does not include the complete MCW training interface or target-grading engine. |
| [LCWO jscwlib](https://fkurz.net/ham/jscwlib.html) | Embeddable Web Audio Morse generation, player controls, timing diagrams | MIT licensed. Good for playing prompts, but its documented API does not capture or decode sending. Adding it alongside morse-pro would duplicate playback responsibilities. |
| [LCWO transmitting practice](https://lcwo.net/transmit) | Keyboard sending and experimental decoding | Application code rather than a sending SDK. [Source](https://github.com/dj1yfk/lcwo/blob/master/inc/transmit.php) mixes browser logic into PHP; the project is AGPL-3. No MIDI or integration contract found. |
| [Vail Master](https://github.com/Vail-CW/vail-master) | MIDI/keyboard, prompted/free practice, scoring and history | Close functional fit but young: ten commits, no releases, last commit June 10, 2026 when inspected. README claims MIT, but lacks the referenced LICENSE; bundled morse-pro retains separate EUPL notices. Not ready to vendor wholesale. |
| [Vail training tools](https://training.vailmorse.com/) | Sending drills and free practice; free practice offers optional MP3 recording | Existing beta tools worth trying, especially with the actual adapter. [Free Practice](https://training.vailmorse.com/free-practice) documents a ten-minute recording limit and initial adaptive-decoder uncertainty. |
| [recri/keyer.js](https://github.com/recri/keyer.js) | MIDI/keyboard/touch and browser keying | GPL-3-or-later alternative; latest reported push October 2024. No stronger support evidence than current morse-pro. |

Vail Master also illustrates why reuse needs inspection: its input code requests
MIDI eagerly and broadcasts settings to all outputs. Its per-character error
analysis distributes an error estimate across target characters rather than
locating every actual mismatch. Neither behavior should become our default.
[Input code](https://github.com/Vail-CW/vail-master/blob/main/scripts/inputs.mjs),
[scoring code](https://github.com/Vail-CW/vail-master/blob/main/scripts/scoring.mjs).

## Morse Code World: library versus whole application

The current library accepts signed millisecond durations through `addTiming`
and `addTimings`: positive for marks and negative for gaps. Decoder callbacks
provide text, Morse, timing, and event identifiers. Current keyer methods include
`ditDown`, `ditUp`, `dahDown`, and `dahUp`. This lets us reuse the Morse engine
while mapping browser device events into it.
[Pinned decoder](https://gitlab.com/scphillips/morse-pro/-/blob/92bf6ec02092d45c159216c61e241ada3f146989/src/morse-pro-decoder.js),
[pinned keyer](https://gitlab.com/scphillips/morse-pro/-/blob/92bf6ec02092d45c159216c61e241ada3f146989/src/morse-pro-keyer.js).

Current source adds ambiguity margins and revised decodes. Those margins are
distances from classification boundaries, not calibrated probabilities or
operator grades. Retaining raw input before decoder cleanup permits later
replay and re-analysis. A target-alignment component would still need to be
obtained or integrated separately; it must handle omissions, additions,
corrections, spacing, and prosigns without cascading false errors.
[Decoder changes](https://gitlab.com/scphillips/morse-pro/-/commit/a6c99a61).

The inspected current commit is
`92bf6ec02092d45c159216c61e241ada3f146989`, dated August 28, 2026.
The npm release is still `3.0.1`, published August 8, 2022; the development
package retains that version despite newer APIs. Use a reviewed commit pin or
an updated upstream release. The archived GitHub repository is an old location,
not proof of abandonment. Upstream has decoder/keyer test sources; this
investigation did not run them.
[Current commit](https://gitlab.com/scphillips/morse-pro/-/commit/92bf6ec02092d45c159216c61e241ada3f146989),
[npm metadata](https://registry.npmjs.org/morse-pro),
[repository move](https://github.com/scp93ch/morse-pro).

The author's README specifies EUPL-1.2 with an extension permitting use as a
library under other application licenses. Preserve license notices, provenance,
and corresponding modified library source. The site's broader copyright notice
does not grant permission to copy its complete UI, grading modules, or lesson
content. No documented result bridge was found; an external iframe would not
by itself let our page read recordings or results. Framing compatibility was
not established. A request to Stephen for a supported release and reusable
grading component is a sensible next step; no message has been sent.
[Library license explanation](https://gitlab.com/scphillips/morse-pro/-/blob/dev/README.md),
[site licenses](https://morsecode.world/licences.html).

## MIDI or keyboard?

The user uses **Brave on desktop and Safari on iOS**. Target Brave desktop
with MIDI and the Vail onboard keyer first. Adapter revision, firmware,
paddle/key, and preferred keyer mode still need a hardware trial.

| Connection | What reaches the browser | Design implication |
| --- | --- | --- |
| MIDI, onboard keyer | Timed mark on/off events on note 0 | Capture the formed output directly; do not key it a second time. |
| MIDI, passthrough | Raw paddle events on notes 1 and 2 | Requires an existing host keyer, such as morse-pro. An additional mode for a later trial. |
| Keyboard, onboard keyer | Left Control down/up for timed output in inspected firmware | Decode the formed marks directly. Detect actual behavior in setup. |
| Keyboard, passthrough | Left/right Control paddle input | Requires host keying and deliberate handling of keyboard shortcuts/focus. |

These are documented/current-firmware behaviors, not a claim that every Vail
revision is identical. MIDI mode is selected with CC0. Speed, keyer, and tone
settings persist in the adapter; no readback command is documented. Connect
only the chosen device and preserve its settings unless the user changes them.
[MIDI integration specification](https://github.com/Vail-CW/vail-adapter/blob/master/docs/MIDI_INTEGRATION_SPEC.md),
[firmware output](https://github.com/Vail-CW/vail-adapter/blob/master/adapter.cpp#L272).

Web MIDI requires secure context and permission. Brave documents MIDI site
permissions, but that does not establish tested Vail compatibility. Start with
default Shields and ordinary MIDI access (`sysex: false`); the Vail protocol
does not require SysEx. No primary evidence was found requiring protections to
be disabled preemptively. Handle unsupported API, denied permission, and missing
device separately. [Brave site permissions](https://support.brave.app/hc/en-us/articles/360018205431-How-do-I-change-site-permissions).

Current MDN compatibility data does not support Safari/iOS WebKit. On iPhone or
iPad, keep ordinary sending, logging, and saved summaries available. A Vail in
keyboard mode still needs actual USB/power, Control-key, and focus testing;
generic external-keyboard support is not a capture compatibility guarantee.
The mockup includes a Safari iOS fallback screen.
[Web MIDI documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API),
[compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json).

Digital capture needs no microphone: save transitions and regenerate the tone
for replay. Browser MIDI timestamps represent system receipt, not physical
contact time. They are useful training evidence, not precision hardware
measurements. Unplugging, missed release events, duplicate sources, and focus
loss need explicit handling. Keep hardware sidetone by default to avoid delayed
or doubled monitoring.
[Web MIDI event timing](https://www.w3.org/TR/webmidi/#midiinput-interface).

## Proposed experience

The interactive review includes both detailed screens and a Wireframes view.
It uses the current cream/green design, dark-mode equivalents, and generic
sample text. The review controls simulate hardware; they never request MIDI,
listen to the keyboard as a key, or save to the account. Reference/captured
replay uses fixed example tone sequences solely for the mockup.

1. **Warm-up:** normal large text and timer. A secondary **Use my key** action
   opts into recording. Free warm-up can produce replay and spacing observations
   without an expected-text accuracy score.
2. **Connect:** choose MIDI or keyboard, explicitly connect and test, then
   separately start capture. Preserve the adapter's existing keying settings.
3. **Send:** keep text prominent. Hide decoding until the take ends by default;
   provide optional live decode. The take duration is separate from the
   practice timer.
4. **Review:** show expected versus decoded text only for a selected target.
   Offer actual/reference replay and one useful observation. Say **possible
   mismatch**, allow the user to disregard it, and retain the original capture.
   Never reward hardware-generated dit/dah precision as manual skill.
5. **Disconnect:** stop capture and sidetone safely, retain the partial take,
   and allow immediate practice without capture. Connection loss alone does
   not pause the existing practice timer.
6. **Finish:** retain editable minutes, optional reflection, and manual
   confirmation of sending requirements. Include a feedback summary only when
   a capture exists and the user wants it.

For example, 8:30 practiced with 0:26 captured means 8:30 credited, not 8:56 or
0:26. A wrong or uncertain decode never blocks progress. Retry is an optional
learning action, not a mandatory perfect-send loop.

## Fit with the current code

- [client.ts](../../src/lib/cw-training/client.ts) starts the ordinary sending
  timer immediately, renders scales, and accepts corrected minutes at Finish.
  [practice-time.ts](../../src/lib/cw-training/practice-time.ts) owns credited
  time. Capture must not replace or add to `activeSeconds`.
- [plan.ts](../../src/lib/cw-training/plan.ts) uses manually confirmed attempts
  for sending completion. No sending grade belongs in that eligibility path.
  Extra-review and class-use distinctions remain intact.
- [import.mjs](../../scripts/cw-training/import.mjs) combines introduction,
  warm-up, and other scales into plain text. Before comparing a target, use
  explicitly selected text or reviewed segments. Do not score headings or
  instructions. Full private curriculum text stays out of public mockups.
- [storage.ts](../../src/lib/cw-training/storage.ts) can accommodate a proposed
  optional active capture alongside the existing device-local block. Old
  blocks must continue to work without it.
- [types.ts](../../src/lib/cw-training/types.ts) and
  [worker/cw-training.ts](../../worker/cw-training.ts) do not currently accept
  replay traces. A bounded summary can follow the existing audio/Runner note
  pattern. Cross-device trace storage requires an explicit contract, retention,
  and export decision; it is not already available through the sync API.

The mockup proposes device-local replay first, with an optional summary saved
in ordinary history. Storage limits and deletion behavior must be settled
before implementation. A future account-synced recording should never be
silently squeezed into the existing bounded note field.

Existing navigation/backgrounding rules still apply: leaving Focus or switching
apps pauses the current practice timer. For an external trainer, use **Done
elsewhere** or correct actual minutes at Finish. Saying external practice counts
does not imply today's timer already runs indefinitely in another tab.
[Current behavior](../../docs/cw-training.md).

## Suggested next scope for review

First, try the MCW keyer and experimental Sending Practice using the actual
Vail in keyboard mode, plus Vail Free Practice in MIDI mode. Compare decoding,
replay usefulness, and comfort. This costs no production integration and helps
decide whether native capture is worth maintaining.

Then request an upstream-supported morse-pro release and ask whether MCW's
alignment/grading components can be licensed or exposed. If that does not pan
out, a bounded native spike should reuse the decoder and keyer, capture raw
events, replay a short take, and surface an uncertain transcript. Target
comparison should remain an explicit separate work item until a reusable
alignment approach is evaluated. Avoid starting with a full automatic coach.

Before shipping, verify these outcomes:

- Capture off, permission denied, decoder load failure, device missing, and
  unplugging all preserve ordinary timer and manual completion behavior.
- Only the selected MIDI device/source is used; keyboard and MIDI cannot
  double-record. No settings are sent to unrelated devices.
- Pausing, Back, refresh, hidden tabs, and missed key-up stop capture safely;
  reload restores it paused. Loss of input is never scored as a long dash.
- Digital capture replays what was received; decoder cleanup does not rewrite
  the raw trace. Ambiguous boundaries and intentional corrections are retained.
- Warm-up and targeted sending differ appropriately; prosigns and deliberate
  Farnsworth/word spacing do not create misleading grades.
- Repeating or discarding a take neither changes practice minutes nor
  duplicates saved attempts. Old blocks, offline saves, and sync still work.
- The engine loads only after opt-in, input handlers are scoped and removed,
  and failure leaves the text/timer usable. Existing audio and Morse Runner
  behavior and the normal page's loading cost remain unchanged.

This review does not create a tracking issue or commit to implementation.
If the direction is accepted, the agreed bounded work belongs in a GitHub issue
under the repository's normal workflow.

## Validation of this review

No production source, dependency, API, curriculum, or deployment configuration
was changed.

- `mise run check` and `mise run build` passed; existing build visibility,
  discovery, backlinks, and offline verification completed.
- Mockup JavaScript syntax validated. Cold start without capture, discarded
  capture, retained warm-up identity, and fresh-block reset were checked.
- Browser walkthrough covered connection/test/start/review, optional capture,
  reference replay controls, wireframe navigation, and the iOS fallback view.
- Screens were visually inspected in Chromium at 360, 736, and 1024 pixel
  widths, including light/dark themes and stacked mobile wireframes.
- This is interface validation, not an actual Brave/Vail or Safari-device test.
  Hardware capture, timing accuracy, upstream tests, account sync, and actual
  audio fidelity remain outside the mockup's verified scope.
