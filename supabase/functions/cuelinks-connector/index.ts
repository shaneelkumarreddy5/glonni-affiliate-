import { withSupabase } from "@supabase/server";

const apiBase = "https://developers.cuelinks.com/pub_api/v3";
const INDIA_COUNTRY_ID = 252;
const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item)) : [];

function indiaCampaign(campaign: JsonObject) {
  const countries = array(campaign.countries);
  return countries.some((country) => Number(country.id) === INDIA_COUNTRY_ID) ||
    Number(campaign.country_id) === INDIA_COUNTRY_ID;
}

function pageNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 10000 ? number : fallback;
}

function pageSize(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 100 ? number : fallback;
}

async function cuelinksRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    let payload: unknown = {};
    try { payload = await response.json(); } catch { payload = {}; }
    return { response, payload: object(payload) };
  } finally {
    clearTimeout(timeout);
  }
}

function upstreamFailure(status: number) {
  if (status === 401) return { status: "invalid_key", message: "Cuelinks rejected the API key. Check the key in Supabase Secrets." };
  if (status === 403) return { status: "missing_permission", message: "The key does not have permission for this operation. Check its selected scopes." };
  if (status === 404) return { status: "not_found", message: "Cuelinks could not find that campaign or endpoint." };
  if (status === 429) return { status: "rate_limited", message: "Cuelinks rate limited this request. Try again shortly." };
  return { status: "provider_error", message: "Cuelinks could not complete the request. Try again or check the provider status." };
}

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (request, ctx) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\\s+/i, "").trim();
    const { data: auth } = await ctx.supabaseAdmin.auth.getUser(token);
    if (!auth.user) return json({ error: "A signed-in administrator is required." }, 401);

    const [{ data: profile }, { data: employee }] = await Promise.all([
      ctx.supabaseAdmin.from("profiles").select("role").eq("id", auth.user.id).single(),
      ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", auth.user.id).single(),
    ]);
    if (!["owner", "admin"].includes(String(profile?.role)) || employee?.status !== "active") {
      return json({ error: "Only active owners and administrators can use the Cuelinks connection." }, 403);
    }

    let body: JsonObject;
    try { body = object(await request.json()); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
    const action = typeof body.action === "string" ? body.action : "";
    if (!["health", "campaigns", "offers", "convert"].includes(action)) {
      return json({ error: "Choose a supported Cuelinks action." }, 400);
    }

    const apiKey = Deno.env.get("CUELINKS_API_KEY");
    if (!apiKey) return json({ ok: false, status: "not_configured", message: "Add CUELINKS_API_KEY in Supabase Edge Function Secrets, then try again." });

    try {
      if (action === "health") {
        const { response, payload } = await cuelinksRequest("/ping", apiKey);
        if (!response.ok) return json({ ok: false, ...upstreamFailure(response.status) });
        return json({ ok: true, status: "connected", publisher: payload.data ?? null });
      }

      if (action === "campaigns") {
        const page = pageNumber(body.page, 1);
        const perPage = pageSize(body.per_page, 50);
        const query = typeof body.q === "string" ? body.q.trim().slice(0, 80) : "";
        const params = new URLSearchParams({ page: String(page), per_page: String(perPage), sort: "epc_7d", order: "desc" });
        if (query) params.set("q", query);
        else params.set("country_id", String(INDIA_COUNTRY_ID));

        const { response, payload } = await cuelinksRequest(`/campaigns?${params.toString()}`, apiKey);
        if (!response.ok) return json({ ok: false, ...upstreamFailure(response.status) });
        const rows = array(payload.data);
        const indiaRows = query ? rows.filter(indiaCampaign) : rows;
        return json({ ok: true, status: "connected", country: "IN", data: indiaRows, meta: payload.meta ?? null });
      }

      if (action === "offers") {
        const campaignId = Number(body.campaign_id);
        if (!Number.isSafeInteger(campaignId) || campaignId < 1) {
          return json({ error: "Select an India campaign before loading its offers." }, 400);
        }
        const campaignResult = await cuelinksRequest(`/campaigns/${campaignId}`, apiKey);
        if (!campaignResult.response.ok) return json({ ok: false, ...upstreamFailure(campaignResult.response.status) });
        const campaign = object(campaignResult.payload.data);
        if (!indiaCampaign(campaign)) {
          return json({ ok: false, status: "not_india_campaign", message: "Offers are only loaded for a campaign confirmed as India." });
        }

        const page = pageNumber(body.page, 1);
        const perPage = pageSize(body.per_page, 50);
        const validOn = typeof body.valid_on === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(body.valid_on) ? body.valid_on : indiaDate();
        const params = new URLSearchParams({
          campaign_id: String(campaignId),
          valid_on: validOn,
          page: String(page),
          per_page: String(perPage),
          order: "desc",
        });
        const { response, payload } = await cuelinksRequest(`/offers?${params.toString()}`, apiKey);
        if (!response.ok) return json({ ok: false, ...upstreamFailure(response.status) });
        return json({ ok: true, status: "connected", campaign: { id: campaign.id, name: campaign.name }, data: array(payload.data), meta: payload.meta ?? null });
      }

      const inputUrl = typeof body.url === "string" ? body.url.trim() : "";
      let destination: URL;
      try { destination = new URL(inputUrl); } catch { return json({ error: "Enter a valid merchant URL." }, 400); }
      if (destination.protocol !== "https:" || destination.username || destination.password) {
        return json({ error: "Only public HTTPS merchant URLs can be converted." }, 400);
      }
      const { response, payload } = await cuelinksRequest("/links/convert", apiKey, {
        method: "POST",
        body: JSON.stringify({ url: destination.toString(), subid: "glonni_admin_test", shorten: false }),
      });
      if (!response.ok) return json({ ok: false, ...upstreamFailure(response.status) });
      return json({ ok: true, status: "converted", data: payload.data ?? null, note: "This link is a preview and has not been saved or published." });
    } catch {
      return json({ ok: false, status: "unavailable", message: "Could not reach Cuelinks. Try again shortly." });
    }
  }),
};
