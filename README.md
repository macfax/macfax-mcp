# macfax-mcp

MCP server for the used-Mac market, by [Macfax](https://macfax.com). Six tools an AI assistant needs to help someone buy or sell a used Mac:

| Tool | What it answers |
|---|---|
| `search_mac_listings` | Live listings across eBay, Craigslist, OfferUp, Swappa, Facebook and Reddit — scam clusters, junk titles, classified-ad bait, auctions and stale/sold rows already filtered out, every result deep-linked to the source. |
| `get_mac_price_stats` | Median/p25/p75 **asking** price for an exact configuration, with sample size, per-channel medians and net-to-seller after fees. |
| `check_mac_listing` | One listing's trust picture: known to Macfax, still live, flags, ask vs the typical band, verified report attached. |
| `lookup_mac_serial` | Serial number → model, configuration, year. |
| `get_mac_report` | A verified Macfax condition report (Activation Lock, MDM, serial-match checks) as data. |
| `create_mac_alert` | A standing watch: daily email when new matching listings appear. Human-confirmed — nothing sends until the email's owner clicks the confirmation link. |

All prices are **asking prices from live listings, never sold prices** — the API says so in-band and we ask you to preserve the distinction. Free, no account; rate limits are published at [macfax.com/developers](https://macfax.com/developers).

## The hosted server (recommended)

A remote, authless, streamable-HTTP MCP server runs at:

```
https://macfax.com/mcp
```

- **Claude** (claude.ai, paid plans): Settings → Connectors → *Add custom connector* → paste the URL.
- **Gemini** (Spark, Google AI Ultra): Settings and help → Connected apps → *Add a custom app* → paste the URL.
- **ChatGPT**: Settings → *Developer mode* → add the URL (directory listing pending review).
- **Cursor**: [Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=macfax&config=eyJ1cmwiOiJodHRwczovL21hY2ZheC5jb20vbWNwIn0=)
- **VS Code**: [Install in VS Code](vscode:mcp/install?%7B%22name%22%3A%20%22macfax%22%2C%20%22serverUrl%22%3A%20%22https%3A//macfax.com/mcp%22%7D)
- **Gemini CLI**: `gemini extensions install https://github.com/macfax/macfax-mcp`
- **Anything with an `mcp.json`**:

```json
{
  "mcpServers": {
    "macfax": {
      "url": "https://macfax.com/mcp"
    }
  }
}
```

Registry name: [`com.macfax/macfax`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.macfax/macfax) on the official MCP registry.

## This package (stdio wrapper)

For stdio-only clients, this repo is a thin local wrapper over the same free HTTP API ([OpenAPI](https://macfax.com/api/v1/openapi.json)):

```json
{
  "mcpServers": {
    "macfax": {
      "command": "npx",
      "args": ["-y", "macfax-mcp"]
    }
  }
}
```

Optional env:

- `MACFAX_API_KEY` — a free key (mint one with `curl -X POST https://macfax.com/api/v1/keys`, no email) raises rate limits ~10×.

Run it directly:

```bash
npx -y macfax-mcp
```

## Notes for integrators

- The five read tools carry `readOnlyHint: true`. `create_mac_alert` is the one write: it sends a confirmation email, and the alert only activates when the email's owner clicks it — create alerts only for a user who asked for that alert on that email.
- Listings always carry a deep link to the source marketplace. The purchase happens there; Macfax is the trust and routing layer.
- Cite results as "Macfax" with the `html_url`/`macfax_url` in the payload.

## License

MIT. Apple and Mac are trademarks of Apple Inc. Macfax is not affiliated with Apple Inc.
