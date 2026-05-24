@RTK.md

# Repository Guidelines

## Repository Purpose
- Personal static landing page for `rwjblue.com`, `n1rwj.com`, and
  `n1rwj.radio`.
- Keep the site simple, fast, and deployable as a static Astro build on
  Cloudflare Pages.

## Project Structure
- `src/pages/index.astro` contains the public landing page markup and page data.
- `src/styles/global.css` contains global styling for the current single-page
  experience.
- `public/` contains source static assets copied into the build output.
- `docs/deployment.md` documents the Cloudflare Pages setup and domain model.
- `.mise/config.toml` and `.mise/tasks/` define the local toolchain and task
  wrappers.
- `dist/` is generated output; do not edit it by hand.

## Development Commands
- `mise install`: install the configured tool versions.
- `mise run install`: install project dependencies with npm.
- `mise run dev`: start the Astro development server.
- `mise run check`: run Astro validation.
- `mise run build`: build the static site into `dist/`.
- `mise run preview`: preview the production build locally.

## Coding Style
- Follow the existing Astro and CSS style before introducing new patterns.
- Keep copy concise and accurate for a public personal site.
- Prefer semantic HTML and accessible landmarks, labels, and link text.
- Keep CSS custom properties centralized in `:root` when adding shared colors or
  tokens.
- Use ASCII unless a file already requires non-ASCII content.

## Testing And Validation
- For content-only documentation changes, inspect the diff before finishing.
- For Astro, CSS, asset, or configuration changes, run `mise run check` and
  `mise run build` before reporting completion.
- If visual layout changes are made, also verify the page in a browser at mobile
  and desktop widths.

## Deployment Notes
- Deployment is handled by Cloudflare Pages through the GitHub integration.
- Production deploys come from `main`; non-main branches create preview
  deployments.
- Do not add Wrangler deployment commands, Cloudflare Worker adapters, or Pages
  Functions unless the site starts needing request-time behavior.
- Keep real Cloudflare credentials and other secrets out of the repository.

## Version Control
- This repo uses `jj` for source control.
- Keep commits focused and descriptive.
- Match the existing commit style when creating commits.

jj-commit-default: auto
