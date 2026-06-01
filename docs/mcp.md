# MCP Setup

This repository keeps MCP wiring in version control while keeping real secrets
out of git.

## Local Secret

Add the Google Maps API key to `.env`:

```text
GOOGLE_MAPS_API_KEY=your-real-key
```

`.env` is already ignored by git. The shared MCP configs reference the
`GOOGLE_MAPS_API_KEY` environment variable rather than storing the key in git.

## Claude Code

Claude Code reads the checked-in project file `.mcp.json`. This repository
configures the `@cablate/mcp-google-map` stdio server there and injects the API
key through `${GOOGLE_MAPS_API_KEY}` at runtime.

## Codex

Codex reads the checked-in project file `.codex/config.toml`. This repository
configures the same stdio server there with:

```toml
[mcp_servers.googleMaps]
command = "npx"
args = ["-y", "@cablate/mcp-google-map", "--stdio"]
env_vars = ["GOOGLE_MAPS_API_KEY"]
```

Codex passes the named environment variable through at runtime, so the real key
still stays local.

## Notes

- The server package is `@cablate/mcp-google-map`.
- Both Codex and Claude Code run it via `npx ... --stdio`.
- Enable the Google Places API (New) and Google Routes API for place search and
  directions support.
- Restrict the API key in Google Cloud to the specific Maps Platform APIs you
  need.
