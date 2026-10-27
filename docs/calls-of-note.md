# Calls of Note

The radio resources section publishes static, publicly accessible callsign-note
files for [Ham2K PoLo](https://polo.ham2k.com/docs/polo-features/callsign-notes/).
The site builds from checked-in snapshots and does not fetch membership data
during a build or a visitor's request.

## Format and installation

PoLo expects a plain-text file with one callsign followed by its note per line.
Empty lines and lines beginning with `#` are ignored. Our CWops entries use the
roster's first or nick name and membership number:

```text
K3LR Tim | CWops #943
W1KM Greg | CWops #1411
```

The stable file URL is
`https://rwjblue.com/radio/resources/calls-of-note/cwops.txt`.
In PoLo, open **Settings > Data Settings > Callsign Notes**, add a new file named
**CWops**, paste this URL into **Location**, and enable the file. Refresh it from
PoLo's **Offline Data** screen to download the current snapshot onto the device.
Subsequent site updates require a refresh in PoLo to load the newer file.

## CWops source and interpretation

The source is the public CSV linked by the
[official CWops member roster](https://cwops.org/membership/member-roster-2/):

<https://docs.google.com/spreadsheets/d/1Ew8b1WAorFRCixGRsr031atxmS0SsycvmOczS_fDqzc/export?format=csv>

`scripts/calls-of-note/update-cwops.mjs` locates the roster header by column
names, reads **Callsign**, **Number**, **First or Nick Name**, and **Paid Thru**,
and emits one entry per unique callsign. Callsigns are trimmed and uppercased;
names retain their accents and are normalized to single spaces. A member with
multiple listed callsigns gets an entry for each. Identical duplicate rows are
collapsed; conflicting information for one callsign stops the refresh.

Membership totals count distinct membership numbers and include club entries.
Callsign totals also include alternate calls listed by CWops. The roster directs
silent keys to a separate memorial page and currently has no silent-key rows.
If **Paid Thru** explicitly contains `SK`, `S.K.`, or `Silent Key`, the member and
all their listed alternate calls are excluded. `SK` in **W/VE** is Saskatchewan
and is not a silent-key indicator. Unknown membership statuses stop the refresh
for review; the script does not infer status from location or a callsign.

## Refreshing the snapshot

Run:

```sh
mise run calls-of-note:update-cwops
node --test tests/calls-of-note.test.mjs
mise run check
mise run build
```

The refresh writes:

- `public/radio/resources/calls-of-note/cwops.txt`: PoLo's plain-text input,
  including source and retrieval-time comments.
- `src/data/calls-of-note/cwops.json`: page metadata with `sourceUrl`,
  `sourcePageUrl`, `retrievedAt` (ISO UTC timestamp), `memberCount`,
  `callsignCount`, `excludedSilentKeys` (distinct excluded membership numbers),
  and `samples` (`call`, `name`, `number`, `note`; number is a string).

Inspect both output diffs before committing or publishing. The updater rejects
malformed CSV, missing or ambiguous headers, unexpected row widths, invalid
records, downloads with fewer than 1,000 members, and a loss of more than 10% of
members or callsigns relative to the checked-in metadata. A failed validation
leaves the saved snapshot intact. If a guard fails, inspect the upstream roster
and adjust the parser or guard deliberately only after understanding the change.

Deploy through the repository's normal deployment workflow. Updating the local
snapshot alone does not change the public file.

## BKG source and refresh

The BKG file uses the member roster published at
[bkg.club](https://www.bkg.club/). Its stable URL is
`https://rwjblue.com/radio/resources/calls-of-note/bkg.txt`. Notes include the
member number and any OG designation explicitly displayed by the club:

```text
N1RWJ BKG #256 | RI OG
```

`scripts/calls-of-note/update-bkg.mjs` reads member cards in the page's roster
section, skips placeholder cards, and preserves the text of ordinary OG badges
and the title (or visible text) of state OG badges. Labels such as `RI OG` and
`Germany OG` are retained. The absence of a badge adds no status text; the script
does not infer OG status from a member's number or location.

Run the BKG refresh, or refresh both hosted files together before validation:

```sh
mise run calls-of-note:update-cwops
mise run calls-of-note:update-bkg
node --test tests/calls-of-note*.test.mjs
mise run check
mise run build
```

The BKG task writes `public/radio/resources/calls-of-note/bkg.txt` and
`src/data/calls-of-note/bkg.json`. Its metadata includes `sourceUrl`,
`sourcePageUrl`, `retrievedAt`, `memberCount`, `callsignCount`, and `samples`
(`call`, `number`, `note`; number is a string preserving source padding).

The parser rejects missing or malformed roster fields, conflicting callsigns
or membership numbers, and a mismatch against the page's advertised member
count when present. Refreshes also require at least 100 members and reject a
drop of more than 20% relative to the saved metadata. Review and publish the
checked-in files using the same workflow as CWops.

## Continuous Wave Order

[Continuous Wave Order](https://www.ditdit.club/) publishes its own
[PoLo-compatible member file](https://ditdit.club/data/members.txt). The resource
page links directly to that club-maintained file; no Discord export, local copy,
or repository refresh is needed. Install and refresh it in PoLo using the same
procedure as the CWops file.

## Upstream community tools

Mise pins Jay's [callsign-notes-merger](https://github.com/jsvana/callsign-notes-merger)
at `v0.2.0` and [discord-callsign-bot](https://github.com/jsvana/discord-callsign-bot)
at `v0.6.0`. Both install from tagged Git sources through mise's Cargo backend
because these releases only provide Linux binaries. Rust is declared in the
project toolchain. On macOS, building requires working Apple developer tools
and acceptance of their license. The bot's upstream release does not include
a Cargo.lock, so its transitive dependencies are not pinned by that release.

```sh
mise install
mise exec -- callsign-notes-merger --help
mise exec -- discord-callsign-bot --help
mise run calls-of-note:merge-preview
```

The preview fetches the three published club files and writes
`.tmp/calls-of-note/merged-preview.txt`, outside the site's public assets. Its
configuration is `scripts/calls-of-note/merge-preview.toml`; additional sources
need a URL in `[sources]` and a position in `priority_order`. This previews the
upstream tool's current full-union behavior, including repeated names and full
source notes. It is not a publishable overlap-only feed. In this release,
failed source downloads are skipped and even a failed one-shot sync can exit
successfully, so inspect logs and output before using the result.

Local verification of `v0.2.0` also found that its callsign validator rejects
numeric prefixes and slash callsigns. With the September 16, 2026 snapshots,
it drops 100 CWops entries (for example, `2E0OBO` and `3B9FR`) and produces
3,730 callsigns instead of the 3,830-call union. Correct this in the upstream
merger before publishing its output.

Discord roster collection belongs in the upstream bot. Each community has its
own guild configuration and output file, which can then become another URL for
the merger. A server member with Manage Server permission must install the bot,
and its application needs the Server Members intent. Put bot configuration and
credentials outside the repository, then run it explicitly:

```sh
mise exec -- discord-callsign-bot --config /absolute/private/path/config.toml
```

This starts the bot and can write to the GitHub destination specified in that
configuration; it is not a preview command. Follow the upstream configuration
reference for the Discord token and `GITHUB_TOKEN`. Installing the tools does
not start either daemon. Everyday Ham does not yet have a configured source.

Implement merger or Discord extraction enhancements in Jay's repositories,
then update the mise source pin to the reviewed release or commit. Keep this
repository responsible for its source configuration, roster conversion, and
site integration.
