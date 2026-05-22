# Personal Landing Page Design

## Purpose

Create a simple personal landing page for `rwjblue.com` so the apex domain has a useful public presence again. The same site will also be available at the N1RWJ domains without redirecting visitors away from the hostname they entered.

The first version should be intentionally small: an evergreen identity page, not a revived blog. It should be easy to deploy, safe for an open source repository, and leave a clean path for lightweight notes later.

## Goals

- Serve a polished static landing page at `rwjblue.com`, `n1rwj.com`, and `n1rwj.radio`.
- Keep all domains visibly available in the browser address bar.
- Present a blended identity: Robert Jackson, `rwjblue`, and `N1RWJ`.
- Include minimal public contact information, using links rather than publishing an email address in source.
- Use tooling that can support markdown-backed notes later without a migration.
- Pin local tooling with mise and check in the lockfile.
- Provide file-based mise tasks for local workflows.
- Add GitHub Actions validation from the start.
- Document Cloudflare Pages setup clearly enough to complete deployment later.

## Non-Goals

- No full blog rebuild for v1.
- No notes section at launch.
- No CMS, comments, analytics, database, server runtime, or auth.
- No secrets or private values committed to the repository.
- No GitHub Pages deployment.
- No hostname-specific content or redirect logic in v1.

## Recommended Stack

Use Astro for the static site and Cloudflare Pages for hosting.

Astro keeps v1 close to static HTML and CSS while preserving an obvious path to future markdown notes via content collections and file-based routes. Cloudflare Pages supports static deployments, GitHub integration, custom domains, and serving the same project from multiple domains without requiring GitHub Pages.

Astro should be installed as a project `devDependency`, not as a global mise tool. The project-local package version should be the source of truth for local development, CI, and Cloudflare builds.

## Repo Layout

Initial layout:

```text
/
  .env.example
  .github/
    workflows/
      ci.yml
  .gitignore
  .mise/
    config.toml
    mise.lock
    tasks/
      install
      dev
      check
      build
      preview
  docs/
    deployment.md
    superpowers/
      specs/
        2026-05-22-personal-landing-page-design.md
  public/
    favicon.svg
  src/
    pages/
      index.astro
    styles/
      global.css
  astro.config.mjs
  package.json
  package-lock.json
  README.md
```

Future notes layout:

```text
src/
  content/
    notes/
      example.md
  pages/
    notes/
      index.astro
      [slug].astro
```

## Page Content

The first page should use a quiet split identity layout:

- Primary identity: Robert Jackson, `rwjblue`, and `N1RWJ`.
- Short factual bio grounded only in known public/session context.
- Software/open-source section.
- Amateur radio section.
- Minimal external links.
- No public email address.

The copy should avoid invented biography. If a specific detail is not available from the repo/session or later supplied explicitly, leave it out.

## Domain Strategy

For v1, attach the same Cloudflare Pages project to:

```text
rwjblue.com
www.rwjblue.com
n1rwj.com
www.n1rwj.com
n1rwj.radio
www.n1rwj.radio
```

Do not force a canonical redirect. If a visitor enters `n1rwj.radio`, the browser should continue to show `n1rwj.radio`; if they enter `rwjblue.com`, it should continue to show `rwjblue.com`.

The page content should be broad enough to feel intentional from any of those domains.

### Future Domain Idea

If the radio domains later need a more radio-forward first impression, consider light hostname-aware presentation. For example, `n1rwj.radio` could order the heading as `N1RWJ / Robert Jackson / rwjblue` while `rwjblue.com` could keep `Robert Jackson / rwjblue / N1RWJ`.

This is not part of v1 because static builds do not know the request hostname at build time. Implementing it would require client-side JavaScript or Cloudflare edge logic, which is unnecessary until there is a real content reason.

## Tooling

Use mise for runtime/tool version management:

```toml
[tools]
node = "lts"

[env]
_.file = ".env"
```

Check in `.mise/config.toml` and `.mise/mise.lock`. The lockfile pins the resolved Node LTS version for reproducible local and CI runs.

Use npm for JavaScript package management and commit `package-lock.json`.

## File-Based Mise Tasks

Use project-local file tasks under `.mise/tasks/`, not TOML task definitions.

Expected tasks:

```text
mise run install  -> npm install
mise run dev      -> npm run dev
mise run check    -> npm run check
mise run build    -> npm run build
mise run preview  -> npm run preview
```

Package scripts should remain available for Cloudflare Pages and contributors:

```json
{
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "build": "astro check && astro build",
    "preview": "astro preview"
  }
}
```

## Environment Files

Check in `.env.example` with non-secret placeholders and documentation. Ignore real env files:

```text
.env
.env.local
```

Future deployment-related variables can be documented as:

```dotenv
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_PROJECT_NAME=rwjblue-com
```

GitHub Actions deployment, if added later, should use GitHub repository secrets rather than committed env files.

## CI

Add GitHub Actions validation in `.github/workflows/ci.yml` for pull requests and pushes to `main`.

The CI workflow should:

```text
mise install
mise run install
mise run check
mise run build
```

This validates the pinned Node runtime, dependency install, Astro checks, and production build.

## Deployment

Use Cloudflare Pages connected to the GitHub repo.

Initial Cloudflare Pages settings:

```text
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Production branch: main
```

Document setup in `docs/deployment.md`, including:

- Creating the Cloudflare Pages project.
- Connecting the GitHub repo.
- Build settings.
- Adding each custom domain.
- DNS expectations for domains already on Cloudflare DNS.
- DNS expectations for domains managed elsewhere.
- Matching the Cloudflare build Node version to the mise lock where Cloudflare supports it.

Custom GitHub Actions deployment can be added later after the Cloudflare project and secrets exist. Do not add placeholder secrets or a partially wired deploy workflow in v1.

## Verification

For v1, successful verification means:

- `mise run build` passes locally.
- GitHub Actions CI passes.
- The built page can be previewed locally.
- Cloudflare Pages serves the same content at each configured domain without redirects.

No browser automation is required for v1 unless the visual implementation becomes more complex than a static landing page.
