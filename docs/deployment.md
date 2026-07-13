# Deployment

This site is built with Astro and deploys primarily as static assets on
Cloudflare Workers. `wrangler.jsonc` is the source of truth for the deployed
Worker.

## Current Setup

```text
Worker name: rwjblue-com
Repository: rwjblue/rwjblue.com
Build command: npm run build
Build output directory: dist
Wrangler config: wrangler.jsonc
```

`wrangler.jsonc` points `main` at `worker/index.ts`. Static files are still
served directly from `assets.directory`; only explicitly selected dynamic paths
run Worker code first.

The current dynamic endpoint is:

```text
/radio/cw-practice/calendar.ics
```

It serves the subscribable CW Practice Schedule iCalendar feed. The feed uses
stable recurring event IDs so calendar clients can refresh it without requiring
subscribers to remove and re-add the calendar.

The schedule model, official sources, recurrence behavior, feed architecture,
and update procedure are documented in
[`docs/cw-practice-schedule.md`](cw-practice-schedule.md).

The local Node version is managed by mise and locked in `.mise/mise.lock`.

## Local Validation

Before deploying, run:

```bash
mise run check
mise run build
mise run deploy -- --dry-run
```

Dry-run mode builds and compiles the Worker without uploading a new version.

## Deploy

Use the project mise task:

```bash
mise run deploy
```

The deploy task runs `npx wrangler deploy`. Wrangler runs `npm run build` from
`wrangler.jsonc` before packaging the static assets.

Wrangler authentication must be configured outside this repository with either
`npx wrangler login` or a `CLOUDFLARE_API_TOKEN` in the shell/CI environment.
Do not commit account IDs, API tokens, `.env`, `.dev.vars`, or other secrets.

## GitHub Deployments

Cloudflare Workers Builds is connected to `rwjblue/rwjblue.com`. A push that
updates the production branch (`main`) triggers a build and deploys the new
version of `rwjblue-com`. The Cloudflare check run on the GitHub commit links to
the corresponding Worker build and version.

The normal Jujutsu production workflow is:

```bash
jj commit -m "Describe the change"
jj tug
jj git push
```

`jj tug` moves the nearest bookmark (`main` for a change based directly on
`main`) to the new commit. The push must actually update `main` to trigger a
production deployment. Pushing only a feature bookmark does not promote that
version to production; it can produce a preview when non-production branch
builds are enabled.

The Worker build settings in the Cloudflare dashboard are:

```text
Production branch: main
Build command: npm run build
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
```

Enable non-production branch builds if pull requests should receive preview
versions. `preview_urls` is enabled in `wrangler.jsonc`, so uploaded Worker
versions can be viewed at generated `workers.dev` preview URLs even though the
production `workers.dev` route is disabled.

Workers Builds does not read `build.command` from `wrangler.jsonc`; keep the
dashboard build command set to `npm run build`.

The GitHub Actions workflow in `.github/workflows/ci.yml` independently runs the
Astro checks and build. It validates the commit but does not deploy it; the
Cloudflare Workers Builds integration owns deployment.

## Custom Domains

The site should serve these Cloudflare-managed hostnames:

```text
rwjblue.com
n1rwj.com
```

There is no canonical redirect. A visitor who enters `n1rwj.com` should continue
to see `n1rwj.com` in the browser address bar, and a visitor who enters
`rwjblue.com` should continue to see `rwjblue.com`.

`n1rwj.radio` is not part of the Workers cutover yet. Workers custom domains
require Cloudflare-managed nameservers, so attach `n1rwj.radio` only after that
zone is moved to Cloudflare DNS.

## DNS

Current DNS ownership:

```text
rwjblue.com: Cloudflare DNS
n1rwj.com: Cloudflare DNS
n1rwj.radio: external DNS until moved
```

Do not add DNS or route configuration for `n1rwj.radio` until its DNS is managed
by Cloudflare.

## Redirects And Headers

Astro copies `public/_redirects` into `dist/`. Cloudflare Workers Static Assets
supports `_redirects` and `_headers` files when they are present in the static
asset directory.

## Request-time Changes

Keep new request-time behavior narrowly routed with `assets.run_worker_first`.
Static assets should continue to bypass Worker code unless a route genuinely
needs request-time logic.
