# Deployment

This site is built with Astro and deploys as static assets on Cloudflare
Workers. `wrangler.jsonc` is the source of truth for the deployed Worker.

## Current Setup

```text
Worker name: rwjblue-com
Repository: rwjblue/rwjblue.com
Build command: npm run build
Build output directory: dist
Wrangler config: wrangler.jsonc
```

`wrangler.jsonc` intentionally has no `main` entry. The Worker serves only the
Astro static asset output through `assets.directory`.

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

Cloudflare Workers Builds can be connected to `rwjblue/rwjblue.com` for push and
pull-request deployments. Configure the Worker build settings in the Cloudflare
dashboard:

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

## Future Changes

If the site later needs hostname-specific rendering, API routes, form handling,
auth, or other request-time behavior, add a Worker script and route only those
paths through Worker code. Keep static assets served directly unless request-time
logic is required.
