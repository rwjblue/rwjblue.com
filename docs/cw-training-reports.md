# Private Companion reports

Bob Carter's instructor-specific form stays in this personal repository. The
public CW Academy Companion exports practice evidence and has no Bob-specific
report flow. This helper runs offline against that downloaded data backup; it
never reads authentication state, submits a form, or changes either website.

From the repository root:

```sh
mise run cw-training:report
# Or choose a backup and class explicitly:
mise run cw-training:report -- --backup "/path/to/cw-academy-backup.json" --session 8 --date 2026-10-01
```

The default is the newest `cw-academy-backup-*.json` by modification time in
**iCloud Downloads** or local Downloads, and the next scheduled class on or
after today's date in the profile timezone. Download another backup when practice
changes. Use `--from YYYY-MM-DD --to YYYY-MM-DD` to override the preparation
window. Archived assignment dates supply the window when present; otherwise the
profile calendar supplies it. The saved practice date controls inclusion, even
when an entry was uploaded later or moved to another date. Class time is excluded.

All generated files live under ignored `data/private/cw-reports/`, outside Astro's
source and public directories. New directories use mode 0700; files use 0600.
The input backup remains untouched. Keep downloaded backups private too.

1. Read `review-session-N.txt` for the answers, provenance, and review warnings.
2. Edit `config.json` for your callsign and first name. The initial identity is
   taken from the backup and previous report, never a new hardcoded identity.
3. Edit `answers-session-N.json` with only the answers you want to override:

   ```json
   {
     "scalesRating": "Good",
     "shortWordsRating": "Very Good",
     "problems": ""
   }
   ```

   Values are strings. Explicit zero and blank answers are preserved. Missing
   keys use fresh suggestions; remove a key to resume automatic suggestions.
   Deliberate edits from a matching archived draft are retained on first use.
   Session and report date come from command flags. Field names are listed in the
   review file; exact rating choices and numeric bounds are in
   `src/lib/cw-training/report-fields.ts`.
4. Run `prepare` again with the same options to refresh the draft. It validates
   answers and reports required fields that still need attention. Prepared drafts
   do not suppress newly learned words in future reports.
5. Open the prefilled form after the draft is ready:

   ```sh
   mise run cw-training:report -- open --session 8
   ```

   This freezes an immutable handoff snapshot, saves its private `.url` file,
   and opens the real Google Form for review. The URL contains your answers;
   keep it private. Google receives those answers when you open the form.
   Check the form and submit it yourself. If you change answers in Google Forms,
   update the local overrides and prepare/open again before submitting so the
   handoff matches the response.
6. After submission, record your confirmation using the UUID printed by `open`:

   ```sh
   mise run cw-training:report -- submitted --handoff UUID
   ```

   Confirmation saves the exact handoff with its submission time. It is
   repeatable and never submits another response. Refreshing a draft leaves
   handoffs and submitted snapshots intact. Only confirmed submissions and
   archived submitted reports suppress previously reported learned words.

## Evidence rules

- Exported sessions are the active history. Archived attempts and LCWO history
  are not re-added wholesale, so deleted, edited, and imported entries are not
  counted twice. IDs and the backup SHA-256 connect each draft to its source.
- Reuse the existing report rules for legacy attempts, recorded audio filenames
  and actual effective speeds, performance ratings, and explicit `Learned:`
  scratchpad lines. General notes and scratchpads never become form answers.
- Choose one highest verified-points Runner result, with actual elapsed time,
  conditions, and speed changes retained for review. Partial results are never
  scaled to 15 minutes or summed together.
- Native words and callsigns use one latest attempt's actual trial points,
  highest correctly copied effective speed, incorrect-answer count, and configured
  word length. Partial and revealed-answer attempts receive review warnings.
- Native groups use their saved scoring version: v1 compares whole text; v2
  compares each group and whole text and uses the lower edit count. Both retain
  extra input. Errors average only native runs matching the latest selected
  result's group kind, length, custom characters, and actual character/effective
  speeds within this report window. Random length stays blank for manual review;
  mixed groups and plain-text practice do not fill an unrelated instructor field.
- Archived LCWO exports can have missing speed/error/length information; keep
  the old warnings and review those fields instead of inferring unavailable
  adaptive metrics. The legacy instructor policy assumes group length three for
  archived LCWO exports; native groups use their actual known length.

Run `mise run cw-training:check-report` to typecheck the helper and exercise the
adapter, existing report rules, refresh/override behavior, and submission snapshots
with synthetic data. There are no network calls during preparation or tests.
