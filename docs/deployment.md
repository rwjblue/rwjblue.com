# Deployment

This site is deployed as a static Astro build on Cloudflare Pages. GitHub Pages
and Cloudflare Workers are intentionally not used for v1.

## Current Setup

The Cloudflare Pages project is connected to the GitHub repository:

```text
Pages project: rwjblue-com
Repository: rwjblue/rwjblue.com
Production branch: main
Framework preset: Astro
Build command: npm run build
Build output directory: dist
```

The local Node version is managed by mise and locked in `.mise/mise.lock`.
Cloudflare Pages should use the same version via the `NODE_VERSION` Pages
environment variable.

## How Deployments Work

GitHub Actions validates the site on pull requests and pushes to `main`.
Cloudflare Pages handles deployment through its GitHub integration.

```text
Push to main -> production deployment
Push to another branch -> preview deployment
```

No deploy command is required in the repository. Do not add `npx wrangler deploy`
or a Cloudflare Worker adapter unless the site starts needing request-time
server behavior.

To redeploy without a code change, use **Retry deployment** from the Cloudflare
Pages project's **Deployments** view.

## Custom Domains

The same Pages project serves all hostnames:

```text
rwjblue.com
www.rwjblue.com
n1rwj.com
www.n1rwj.com
n1rwj.radio
www.n1rwj.radio
```

There is no canonical redirect in v1. A visitor who enters `n1rwj.radio` should
continue to see `n1rwj.radio` in the browser address bar, and a visitor who
enters `rwjblue.com` should continue to see `rwjblue.com`.

## DNS

Cloudflare Pages custom domains work best when the apex domain's DNS zone uses
Cloudflare nameservers. That is required for root hostnames such as
`rwjblue.com`, `n1rwj.com`, and `n1rwj.radio` to be attached directly to the
Pages project.

Current DNS ownership:

```text
rwjblue.com: Cloudflare DNS
n1rwj.com: Cloudflare DNS
n1rwj.radio: external DNS until moved
```

Subdomains such as `www.example.com` can be attached while using an external DNS
provider by creating the `CNAME` record Cloudflare Pages provides.

## Future Deployment Changes

The checked-in `.env.example` reserves names for a possible future manual or CI
deployment flow:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_PROJECT_NAME
```

Those values are not needed for the current Git-connected Pages deployment.
Real secret values must stay out of the repository.

If the site later needs hostname-specific rendering, API routes, form handling,
auth, or other request-time behavior, reevaluate Cloudflare Workers or Pages
Functions at that point.
