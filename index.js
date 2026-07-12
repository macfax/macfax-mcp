#!/usr/bin/env node
// macfax-mcp: a local stdio MCP server for the used-Mac market, wrapping the
// free Macfax HTTP API (https://macfax.com/developers). Prefer the hosted
// remote server (https://macfax.com/mcp, streamable HTTP, no auth) when your
// client supports remote MCP; this wrapper exists for stdio-only clients and
// for reading exactly what the tools do.
//
// All prices Macfax serves are asking prices from live listings, never sold
// prices. Set MACFAX_API_KEY for ~10x rate limits (mint one free, no email:
// `curl -X POST https://macfax.com/api/v1/keys`).

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const { version: VERSION } = createRequire(import.meta.url)("./package.json");

const API = process.env.MACFAX_API_URL ?? "https://macfax.com/api/v1";
const KEY = process.env.MACFAX_API_KEY ?? null;
const TIMEOUT_MS = 20_000;

const flags = process.argv.slice(2);
if (flags.includes("--version") || flags.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}
if (flags.includes("--help") || flags.includes("-h")) {
  console.log(
    [
      `macfax-mcp ${VERSION}`,
      "Local stdio MCP server for the used-Mac market (https://macfax.com/developers).",
      "",
      "Usage: npx -y macfax-mcp            speaks MCP over stdio; point your client at it",
      "       npx -y macfax-mcp --version  print the version",
      "",
      "Env:   MACFAX_API_KEY   free key, raises rate limits about 10x",
      "                        mint one: curl -X POST https://macfax.com/api/v1/keys",
      "       MACFAX_API_URL   override the API base (default https://macfax.com/api/v1)",
      "",
      "Prefer the hosted server when your client supports remote MCP: https://macfax.com/mcp",
    ].join("\n"),
  );
  process.exit(0);
}

async function call(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "user-agent": `macfax-mcp/${VERSION} (+https://github.com/macfax/macfax-mcp)`,
        ...(body ? { "content-type": "application/json" } : {}),
        ...(KEY ? { authorization: `Bearer ${KEY}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e?.name === "TimeoutError") {
      throw new Error(`Macfax API did not respond within ${TIMEOUT_MS / 1000} seconds. Try again shortly.`);
    }
    throw e;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    let message = json?.error?.message ?? `Macfax API returned HTTP ${res.status}`;
    const retry = res.headers.get("retry-after");
    if (retry) message += ` Retry after ${retry} seconds.`;
    if (res.status === 429 && !KEY) {
      message +=
        " Tip: a free API key raises rate limits about 10x. Mint one (no email needed): curl -X POST https://macfax.com/api/v1/keys, then set MACFAX_API_KEY.";
    }
    throw new Error(message);
  }
  return json?.data ?? json;
}

function asText(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function asToolError(err) {
  return {
    content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    isError: true,
  };
}

const server = new McpServer({
  name: "com.macfax/macfax",
  title: "Macfax",
  version: VERSION,
});

const CONFIG_DESC =
  "Macfax config key: family[-screen]-chip-year, optionally -RAMgb-STORAGEgb. Examples: macbook-pro-14-m3pro-2023, mac-studio-m2ultra-2023-192gb-1024gb.";

server.registerTool(
  "lookup_mac_serial",
  {
    title: "Look up a Mac serial number",
    description:
      "Check a Mac serial number: whether a verified Macfax report exists for it, plus the model and year decoded from Apple's data for pre-2021 serials. 2021+ Macs have 10-character randomized serials that encode nothing, so for those the honest answer is the format check and the report cross-reference. Lookup is advisory and cannot verify condition, Activation Lock, or possession; a Macfax report can.",
    inputSchema: {
      serial: z
        .string()
        .describe("The Mac's serial number: 10 characters on 2021+ Macs, 11-12 on older ones."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },
  async ({ serial }) => {
    try {
      return asText(await call(`/lookup?serial=${encodeURIComponent(serial)}`));
    } catch (e) {
      return asToolError(e);
    }
  },
);

server.registerTool(
  "get_mac_price_stats",
  {
    title: "Get used-Mac asking-price statistics",
    description:
      "What a used Mac configuration is listed for right now: median/p25/p75 price with sample size, per-channel medians with net-to-seller after fees, launch MSRP retention, and Apple trade-in floor. All figures are asking prices from live listings, never sold prices.",
    inputSchema: { config: z.string().describe(CONFIG_DESC) },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ config }) => {
    try {
      return asText(await call(`/price-stats?config=${encodeURIComponent(config)}`));
    } catch (e) {
      return asToolError(e);
    }
  },
);

server.registerTool(
  "search_mac_listings",
  {
    title: "Search live used-Mac listings",
    description:
      "Live used-Mac listings aggregated across eBay, Craigslist, OfferUp, Swappa, Facebook and Reddit, with scam clusters, junk titles, classified-ad bait, auctions and stale/sold rows filtered out. Every result deep-links to the source listing where the purchase happens.",
    inputSchema: {
      config: z.string().optional().describe(CONFIG_DESC),
      family: z
        .enum(["macbook-pro", "macbook-air", "mac-studio", "mac-mini", "mac-pro", "imac", "imac-pro"])
        .optional(),
      chip_tier: z.string().optional().describe("e.g. m3, m3pro, m4max, m3ultra"),
      year: z.number().int().optional(),
      ram_gb: z.number().int().optional(),
      storage_gb: z.number().int().optional(),
      max_price_usd: z.number().int().optional(),
      min_tier: z
        .enum(["listed", "free", "premium"])
        .optional()
        .describe("free/premium = only listings with a verified Macfax report attached."),
      sort: z.enum(["fresh", "price_asc", "price_desc"]).optional(),
      limit: z.number().int().max(50).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v != null) params.set(k, String(v));
      }
      return asText(await call(`/listings?${params.toString()}`));
    } catch (e) {
      return asToolError(e);
    }
  },
);

server.registerTool(
  "check_mac_listing",
  {
    title: "Check a used-Mac listing before trusting it",
    description:
      "The trust picture for one specific listing, by URL or Macfax listing id: whether Macfax knows it, whether it passes every quality gate, scam/junk/classified/auction flags, when a scan last verified it live, its ask against the configuration's typical asking band, and whether a verified Macfax report is attached. Facts, not verdicts.",
    inputSchema: {
      url: z.string().optional().describe("The listing's URL on the source marketplace."),
      id: z.string().optional().describe("A Macfax listing id (from search results)."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ url, id }) => {
    try {
      const params = new URLSearchParams();
      if (url) params.set("url", url);
      if (id) params.set("id", id);
      return asText(await call(`/check-listing?${params.toString()}`));
    } catch (e) {
      return asToolError(e);
    }
  },
);

server.registerTool(
  "get_mac_report",
  {
    title: "Fetch a verified Macfax report",
    description:
      "A verified Macfax condition report as structured data: hardware-verified identity, Activation Lock / MDM / serial-match checks, coverage status, and the signing chain. Use when a listing or seller shares a macfax.com/r/ link.",
    inputSchema: {
      report_id: z.string().describe("The 8-character report id from a macfax.com/r/<id> URL."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ report_id }) => {
    try {
      return asText(await call(`/reports/${encodeURIComponent(report_id)}`));
    } catch (e) {
      return asToolError(e);
    }
  },
);

server.registerTool(
  "create_mac_alert",
  {
    title: "Create a standing used-Mac listing alert",
    description:
      "Watch the market for a configuration: Macfax emails the given address when new matching listings appear. CONSENT CONTRACT: create an alert only for a user who explicitly asked for this alert on this email address. The first alert for a new email stays inactive until the email's owner clicks the confirmation link Macfax sends; nothing is emailed before that, and every alert email carries manage and unsubscribe links.",
    inputSchema: {
      email: z
        .string()
        .describe("The user's own email address. Confirmation is required before anything sends."),
      config: z.string().describe(CONFIG_DESC),
      ram_gb: z.number().int().optional(),
      storage_gb: z.number().int().optional(),
      max_price_usd: z.number().int().optional().describe("Only alert under this asking price."),
      min_tier: z.enum(["listed", "free", "premium"]).optional(),
      under_typical: z
        .boolean()
        .optional()
        .describe("Only listings under the configuration's typical asking range."),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (args) => {
    try {
      return asText(await call("/alerts", { method: "POST", body: args }));
    } catch (e) {
      return asToolError(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
