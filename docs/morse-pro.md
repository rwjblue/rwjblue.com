# Optional Morse sending dependency

The native sending tools use Stephen C. Phillips's
[morse-pro](https://gitlab.com/scphillips/morse-pro) as an npm dependency.
There is no checked-in library implementation or custom EBNF parser bundle.

## Dependency and updates

`package.json` depends on the GitLab HTTPS source archive for commit
`92bf6ec02092d45c159216c61e241ada3f146989` (August 28, 2026). The published npm
3.0.1 release is older than this tested source; the current upstream source
still uses that version number. `SENDING_ENGINE_VERSION` records the full
commit with saved decoder metadata.

Normal `npm install` or `npm ci` downloads the archive and its EBNF dependency.
`package-lock.json` pins the resolved archive and SHA-512 integrity. The nested
EBNF override retains the tested 1.9.0 version. The archive includes upstream
`src/` and installs without building upstream Babel output or installing its
development dependencies. A git dependency would invoke upstream preparation
and is unnecessary here.

`src/lib/cw-training/sending-engine.ts` imports explicit `morse-pro/src/*.js`
paths from `node_modules`; `morse-pro.d.ts` provides our small local type surface.
The source and its EBNF import are unmodified. Astro/Vite bundles them into
locally served optional chunks. Visitors contact this site for those chunks;
they do not fetch npm or GitLab at runtime. The offline field kit also excludes
the sending dependency graph from automatic precaching.

To upgrade, review an upstream commit, update the archive URL and engine
version, and run `npm install` to refresh the lockfile. Review EBNF changes
before changing the override. Update the public source links, notices, and local
types as needed. Run engine tests, training type checks, repository check/build,
and browser capture/replay checks. A matching npm release can replace the
archive dependency when upstream publishes one; no fork or publication of our
own package is needed.

## Notices and source availability

`public/vendor/morse-pro/` contains only attribution and license notices. The
public `README.md` links the exact source commit and downloadable archive,
following the EUPL source-repository provision. The original EUPL license,
upstream README with its library-use compatibility extension, and EBNF MIT
license are preserved. Keep these notices and the corresponding source links
available with redistribution. Tests compare the license copies against the
installed packages.

The upstream EBNF parser uses `eval` to read literal values in its fixed grammar,
so Vite emits an eval warning during the build. Sending text is parsed as input,
not evaluated as JavaScript. This inherited behavior must be reviewed if a
stricter Content Security Policy is introduced. Verify the production bundle
in a browser when updating the dependency.

## Wrapper behavior

The wrapper supplies fixed-speed decoding, reference timing, and replay:

- `decodeSendingTimings(timings, wpm)` returns `{ text, morse }`. Positive
  milliseconds are marks; negative values are gaps. It flushes the last
  completed mark without adding a trailing gap. Unknown patterns retain `#`.
- `sendingTextTimings(text, wpm)` generates International Morse, including
  prosigns, and rejects unsupported target characters.
- `createSendingPlayer()` supplies `play(timings)`, `stop()`, and `dispose()`.
  Playback resolves on completion or cancellation and rejects on audio failure.

Decoding and replay clone their inputs. Replay preserves the received timing
instead of re-encoding decoded text. A transcript is an interpretation, not
proof of an error; target comparison and practice credit remain in our app.
Playback alone adds upstream's 50 ms startup delay and a 10 ms release margin;
neither is written into the raw recording.

Playback creates and resumes its own audio context synchronously from a user
gesture, then imports the browser-only upstream player. Stop/dispose cancel
pending work and close only that replay's context. The main training player
remains independent. Importing the decoder does not access browser audio or
request input permission.
