# Deployment

This site is designed to deploy as a static Astro build on Cloudflare Pages.
GitHub Pages is intentionally not used.

## Cloudflare Pages Project

Create one Cloudflare Pages project connected to the GitHub repository:

```text
Repository: rwjblue/rwjblue.com
Production branch: main
Framework preset: Astro
Build command: npm run build
Build output directory: dist
```

The local Node version is managed by mise and locked in `.mise/mise.lock`. If
Cloudflare Pages does not select the same Node version automatically, set the
Pages environment variable `NODE_VERSION` to the version recorded in the mise
lockfile.

## Custom Domains

Attach all domains to the same Cloudflare Pages project:

```text
rwjblue.com
www.rwjblue.com
n1rwj.com
www.n1rwj.com
n1rwj.radio
www.n1rwj.radio
```

Do not configure a canonical redirect for v1. A visitor who enters
`n1rwj.radio` should continue to see `n1rwj.radio` in the browser address bar,
and a visitor who enters `rwjblue.com` should continue to see `rwjblue.com`.

## DNS

If a domain already uses Cloudflare DNS, add it as a Pages custom domain and let
Cloudflare create or update the DNS records.

If a domain is managed by another DNS provider, add the custom domain in
Cloudflare Pages and then create the `CNAME` record Cloudflare provides at that
DNS provider. Cloudflare Pages will show the exact target during setup.

## CI And Deployments

GitHub Actions validates the site on pull requests and pushes to `main`.
Cloudflare Pages handles production deployments from the connected GitHub repo.

A custom GitHub Actions deployment workflow can be added later if deployment
should move out of Cloudflare's GitHub integration. Use GitHub repository
secrets for real values:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_PROJECT_NAME
```

The checked-in `.env.example` documents these names for local tasks, but real
secret values must stay out of the repository.

## Future Domain-Aware Presentation

The v1 site serves the same content for every hostname. If the radio domains
later need a more radio-forward first impression, the site can add light
hostname-aware presentation with client-side JavaScript or Cloudflare edge
logic. That should wait until the content need is clear.
