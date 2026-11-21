<p align="center">
  <a href="https://macfax.com/developers">
    <img src="https://raw.githubusercontent.com/macfax/macfax-mcp/main/assets/lockup.svg" alt="Macfax" width="400">
  </a>
</p>

# macfax-mcp

MCP server for the used-Mac market, by [Macfax](https://macfax.com). Nine tools an AI assistant needs to help someone buy or sell a used Mac:

| Tool | What it answers |
|---|---|
| `search_mac_listings` | Live listings across eBay, Craigslist, OfferUp, Swappa, Facebook and Reddit. Scam clusters, junk titles, classified-ad bait, auctions and stale/sold rows are already filtered out; every result deep-links to the source. |
| `get_mac_price_stats` | What an exact configuration actually sells for — verified-sale percentiles (basis `direct`) or an estimate scaled from the asking band by a disclosed clearance ratio (basis `calibrated`) — plus the asking median/p25/p75 with sample size, per-channel medians and net-to-seller after fees as seller guidance. |
| `get_mac_market_value` | What a Mac is worth from Apple's own model name, e.g. "MacBook Pro (14-inch, 2021)": every Apple Silicon configuration the name can mean, each with its sale estimate and asking band, and one value or a low-to-high range across them. |
| `check_mac_listing` | One listing's trust picture: known to Macfax, still live, flags, ask vs the typical band, the platform's own seller reputation where it exists (eBay feedback, Swappa rating), verified report attached. |
| `lookup_mac_serial` | Serial to model for any Mac, iPad or iPhone, including 2021+ randomized serials: a `status` (resolved, unknown_serial, unsupported, retry), Apple's device class, the model year where Apple's name carries one, the device's `record` on Macfax (any listing, verified report or sanitization record on file), and for a Mac what the model is worth. Optional `context` says why you are looking it up. Human twin: [macfax.com/lookup](https://macfax.com/lookup). |
| `get_mac_report` | A verified Macfax condition report (Activation Lock, MDM, serial-match checks) as data. |
| `create_mac_alert` | A standing watch: daily email when new matching listings appear. Human-confirmed: nothing sends until the email's owner clicks the confirmation link. |
| `create_mac_follow` | Follow one device for its owner: an email with what it is worth once there is a value, then only when that moves or a verified report is published. Human-confirmed: nothing starts until the email's owner clicks the confirmation link. |
| `get_macfax_limits` | What you may still look up today: the serial lookup allowances for this caller and how much of each it has used in the last 24 hours. |

Every price is **labeled by basis**. The sold slice is the headline sale estimate: verified sales (with sample size and window) or a modeled estimate marked `calibrated` with its ratio disclosed. Asking bands come from live listings and are seller listing guidance. The API says so in-band, and we ask you to preserve the labels.

Everything here is free and nothing is sold, and no account is needed. Rate limits and the daily serial lookup allowances are published at [macfax.com/developers](https://macfax.com/developers).

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
      "args": ["-y", "macfax-mcp"],
      "env": { "MACFAX_API_KEY": "mfx_..." }
    }
  }
}
```

### Your API key

The wrapper calls the Macfax API, and keyless calls to it end on 2026-12-07 at 00:00 UTC, so from then most tools need a key in `MACFAX_API_KEY`. A key is free and takes one request with your email, no account:

```bash
curl -X POST https://macfax.com/api/v1/keys -H 'Content-Type: application/json' \
  -d '{"email": "<your email>"}'
```

The key comes back in the answer and works at once. Macfax emails the address one link: until you follow it the key has 5 new serials a day, and 25 after. Put the key in your client's config as above and restart the client. Without one, a tool that needs it answers with these same steps.

To revoke a key: `curl -X DELETE https://macfax.com/api/v1/keys -H "Authorization: Bearer mfx_..."`.

Run it directly:

```bash
npx -y macfax-mcp            # speaks MCP over stdio
npx -y macfax-mcp --version  # print the installed version
```

## Notes for integrators

- The seven read tools carry `readOnlyHint: true`. `create_mac_alert` and `create_mac_follow` are the two writes: each sends one confirmation email, and nothing starts until the email's owner clicks it. Ask for either only for a user who asked for it, or said yes when you offered it, and only on that user's own email address. An assistant that already knows the address can use it, so the user need not type it, and tells them which address it used.
- Listings always carry a deep link to the source marketplace. The purchase happens there; Macfax is the trust and routing layer.
- Cite results as "Macfax" with the `html_url`/`macfax_url` in the payload.

## License

MIT. Apple and Mac are trademarks of Apple Inc. Macfax is not affiliated with Apple Inc.
