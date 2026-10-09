import { withSupabase } from "@supabase/server";

type Json = Record<string, unknown>;
const API_BASE = "https://developers.cuelinks.com/pub_api/v3";
const MAX_BODY_BYTES = 16 * 1024;
const respond = (body: Json, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function safeText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
}

function validMerchantUrl(value: unknown): string | null {
  const input = safeText(value, 2048);
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
    if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(host) || host.includes(":")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function cuelinks(path: string, params: URLSearchParams, method = "GET", payload?: Json) {
  const apiKey = Deno.env.get("CUELINKS_API_KEY");
  if (!apiKey) return { configured: false as const };
  const url = new URL(API_BASE + path);
  params.forEach((value, key) => url.searchParams.append(key, value));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: "Token " + apiKey,
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(12_000),
  });
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error("provider_response_too_large");
  let result: unknown;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("provider_invalid_response");
  }
  if (!response.ok) {
    const code = response.status === 401 ? "invalid_credentials"
      : response.status === 403 ? "missing_scope_or_access"
      : response.status === 429 ? "provider_rate_limited"
      : "provider_request_failed";
    return { configured: true as const, ok: false, status: response.status, code, result };
  }
  return { configured: true as const, ok: true, result };
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\\s+/i, "");
    if (!token) return respond({ error: "A signed-in administrator is required." }, 401);

    const { data: auth } = await ctx.supabaseAdmin.auth.getUser(token);
    if (!auth.user) return respond({ error: "A signed-in administrator is required." }, 401);
    const { data: claimData } = await ctx.supabaseAdmin.auth.getClaims(token);
    const claims = claimData?.claims as Record<string, unknown> | undefined;
    if (claims?.aal !== "aal2") return respond({ error: "Complete administrator MFA before using this integration." }, 403);

    const [{ data: profile }, { data: employee }] = await Promise.all([
      ctx.supabaseAdmin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
      ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", auth.user.id).maybeSingle(),
    ]);
    if (!["owner", "admin"].includes(String(profile?.role)) || employee?.status !== "active") {
      return respond({ error: "Only active owners and administrators can use this integration." }, 403);
    }

    const apiKey = Deno.env.get("CUELINKS_API_KEY");
    if (!apiKey) return respond({ error: "Cuelinks is not configured yet.", code: "not_configured" }, 503);

    let input: Json = {};
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return respond({ error: "Request is too large." }, 413);
    }
    try {
      input = raw ? JSON.parse(raw) as Json : {};
    } catch {
      return respond({ error: "Request body must be valid JSON." }, 400);
    }

    const action = safeText(input.action, 32);
    const params = new URLSearchParams();
    let path = "";
    let method = "GET";
    let payload: Json | undefined;

    if (action === "health") {
      path = "/ping";
    } else if (action === "campaigns") {
      path = "/campaigns";
      params.set("country_id", "252");
      params.set("currency", "INR");
      params.set("sort", "epc_7d");
      params.set("order", "desc");
      params.set("page", String(boundedInteger(input.page, 1, 1, 10000)));
      params.set("per_page", String(boundedInteger(input.per_page, 50, 1, 100)));
      const query = safeText(input.q, 100);
      if (query) params.set("q", query);
    } else if (action === "offers") {
      path = "/offers";
      params.set("valid_on", new Date().toISOString().slice(0, 10));
      params.set("sort", "updated_at");
      params.set("order", "desc");
      params.set("page", String(boundedInteger(input.page, 1, 1, 10000)));
      params.set("per_page", String(boundedInteger(input.per_page, 50, 1, 100)));
      const campaignId = safeText(input.campaign_id, 24);
      if (campaignId && /^\\d+$/.test(campaignId)) params.set("campaign_id", campaignId);
      const offerType = safeText(input.offer_type, 16);
      if (offerType === "coupon" || offerType === "deal") params.set("offer_type", offerType);
    } else if (action === "transactions") {
      path = "/transactions";
      params.set("sort", "updated_at");
      params.set("order", "desc");
      params.set("page", String(boundedInteger(input.page, 1, 1, 10000)));
      params.set("per_page", String(boundedInteger(input.per_page, 50, 1, 100)));
      const updatedSince = safeText(input.updated_since, 40);
      if (updatedSince && !Number.isNaN(Date.parse(updatedSince))) params.set("updated_since", updatedSince);
      const status = safeText(input.status, 30);
      if (status && ["pending", "validated", "payable", "invoice_raised", "paid", "rejected"].includes(status)) params.set("status", status);
    } else if (action === "convert_link") {
      const merchantUrl = validMerchantUrl(input.url);
      if (!merchantUrl) return respond({ error: "Enter a valid HTTPS merchant URL." }, 400);
      path = "/links/convert";
      method = "POST";
      payload = { url: merchantUrl };
      const subid = safeText(input.subid, 80);
      if (subid) payload.subid = subid;
      const subid2 = safeText(input.subid2, 80);
      if (subid2) payload.subid2 = subid2;
    } else {
      return respond({ error: "Unsupported action." }, 400);
    }

    try {
      const result = await cuelinks(path, params, method, payload);
      if (!result.configured) return respond({ error: "Cuelinks is not configured yet.", code: "not_configured" }, 503);
      if (!result.ok) {
        return respond({ error: "Cuelinks request failed.", code: result.code }, result.status === 429 ? 429 : 502);
      }
      return respond({ provider: "cuelinks", action, data: result.result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const timeout = message.includes("TimeoutError") || message.includes("timed out");
      return respond({ error: timeout ? "Cuelinks request timed out." : "Cuelinks returned an invalid response.", code: timeout ? "timeout" : "provider_error" }, 502);
    }
  }),
};
