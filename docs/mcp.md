# MCP Setup

This repository keeps MCP wiring in version control while keeping real secrets
out of git.

## Local Secrets

Add the Google Maps API key to `.env`:

```text
GOOGLE_MAPS_API_KEY=your-real-key
```

Add the Fastmail MCP API token to `.env`:

```text
FASTMAIL_MCP_API_TOKEN=your-real-token
```

`.env` is already ignored by git. The shared MCP configs reference the
`GOOGLE_MAPS_API_KEY` and `FASTMAIL_MCP_API_TOKEN` environment variables rather
than storing real secrets in git.

The Fastmail MCP server is a hosted HTTP server at
`https://api.fastmail.com/mcp`. The shared configs send the local token as a
Bearer token.

## Claude Code

Claude Code reads the checked-in project file `.mcp.json`. This repository
configures:

- `fastmail` as the hosted Fastmail MCP server.
- `google-maps` as the `@cablate/mcp-google-map` stdio server, with the API key
  injected through `${GOOGLE_MAPS_API_KEY}` at runtime.

The Fastmail entry references `${FASTMAIL_MCP_API_TOKEN}` in its Authorization
header so the token stays local:

```json
{
  "type": "http",
  "url": "https://api.fastmail.com/mcp",
  "headers": {
    "Authorization": "Bearer ${FASTMAIL_MCP_API_TOKEN}"
  }
}
```

## Codex

Codex reads the checked-in project file `.codex/config.toml`. This repository
configures Fastmail with:

```toml
[mcp_servers.fastmail]
url = "https://api.fastmail.com/mcp"
bearer_token_env_var = "FASTMAIL_MCP_API_TOKEN"
```

It configures the Google Maps stdio server with:

```toml
[mcp_servers.googleMaps]
command = "npx"
args = ["-y", "@cablate/mcp-google-map", "--stdio"]
env_vars = ["GOOGLE_MAPS_API_KEY"]
```

Codex reads the named environment variable at runtime, so the real Fastmail
token and Google Maps key still stay local.

Codex loads MCP servers when a thread/session starts. After changing
`.codex/config.toml`, start a new Codex thread or reload the MCP server list
before expecting newly configured tools to appear in tool discovery.

## Notes

- Fastmail's server is hosted at `https://api.fastmail.com/mcp`.
- Fastmail authentication uses `FASTMAIL_MCP_API_TOKEN` as an Authorization
  Bearer token.
- The Google Maps server package is `@cablate/mcp-google-map`.
- Both Codex and Claude Code run Google Maps via `npx ... --stdio`.
- Enable the Google Places API (New) and Google Routes API for place search and
  directions support.
- Restrict the API key in Google Cloud to the specific Maps Platform APIs you
  need.
