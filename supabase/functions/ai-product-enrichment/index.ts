import { withSupabase } from "@supabase/server";

type Json = Record<string, unknown>;
const respond = (body: Json, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const extractText = (response: any) => typeof response?.output_text === "string" ? response.output_text.trim() : (response?.output ?? []).flatMap((item: any) => item?.content ?? []).map((part: any) => typeof part?.text === "string" ? part.text : part?.text?.value ?? "").filter(Boolean).join("\n").trim();
const sourceList = (response: any) => {
  const found = new Map<string, { title: string; url: string }>();
  for (const item of response?.output ?? []) for (const source of item?.action?.sources ?? []) {
    const url = String(source?.url ?? "").trim();
    if (url.startsWith("http")) found.set(url, { title: String(source?.title ?? new URL(url).hostname), url });
  }
  return [...found.values()].slice(0, 12);
};
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const schema = {
  type: "object", additionalProperties: false,
  required: ["title", "brand", "model_code", "description", "confidence", "category_id", "primary_image_url", "gallery_images", "variations", "specifications", "product_information", "offer_candidates"],
  properties: {
    title: { type: "string" }, brand: nullableString, model_code: nullableString, description: nullableString,
    confidence: { type: "number", minimum: 0, maximum: 100 }, category_id: nullableString, primary_image_url: nullableString,
    gallery_images: { type: "array", items: { type: "string" } },
    variations: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "values"], properties: { label: { type: "string" }, values: { type: "array", items: { type: "string" } } } } },
    specifications: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } } },
    product_information: { type: "object", additionalProperties: false, required: ["overview", "highlights", "in_the_box", "warranty", "care_instructions"], properties: { overview: nullableString, highlights: nullableString, in_the_box: nullableString, warranty: nullableString, care_instructions: nullableString } },
    offer_candidates: { type: "array", items: { type: "object", additionalProperties: false, required: ["store_name", "product_url", "current_price", "list_price", "currency", "stock_status", "customer_rating", "rating_count", "bank_offer", "coupon_code", "cashback_confirmation_days", "terms"], properties: { store_name: { type: "string" }, product_url: nullableString, current_price: nullableNumber, list_price: nullableNumber, currency: nullableString, stock_status: nullableString, customer_rating: nullableNumber, rating_count: nullableNumber, bank_offer: nullableString, coupon_code: nullableString, cashback_confirmation_days: nullableNumber, terms: nullableString } } },
  },
};

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await ctx.supabaseAdmin.auth.getUser(token);
    if (!auth.user) return respond({ error: "A signed-in admin session is required." }, 401);
    const [{ data: profile }, { data: employee }] = await Promise.all([
      ctx.supabaseAdmin.from("profiles").select("role").eq("id", auth.user.id).single(),
      ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", auth.user.id).single(),
    ]);
    if (!["owner", "admin"].includes(profile?.role) || employee?.status !== "active") return respond({ error: "Only an active owner or administrator can fetch product details." }, 403);
    const body = await req.json().catch(() => ({})) as { query?: string };
    const query = body.query?.trim();
    if (!query || query.length < 3) return respond({ error: "Enter a clear product name first." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return respond({ error: "OpenAI is not configured for product enrichment." }, 503);
    const [{ data: categories }, { data: merchants }, { data: providers }] = await Promise.all([
      ctx.supabaseAdmin.from("categories").select("id,name,parent_id").eq("is_active", true).is("archived_at", null),
      ctx.supabaseAdmin.from("merchants").select("id,name").eq("is_active", true),
      ctx.supabaseAdmin.from("affiliate_providers").select("id,name").eq("is_active", true),
    ]);
    const connectedStores = (merchants ?? []).map((item: any) => item.name);
    const instructions = "You enrich product drafts for Glonni, an Indian affiliate-shopping platform. Search the web for the exact requested product. Return only facts supported by current reliable sources. Use null or [] whenever a fact cannot be verified; never guess. Select category_id only from the supplied category list. Canonical product details may be combined from reliable sources, preferring the manufacturer for identity, specifications and images. Offer candidates may use ONLY supplied connected store names and must refer to the exact variant. Public product URLs are research candidates, never affiliate tracking URLs. Do not invent cashback, commission, coupon, confirmation time, price, rating, stock or bank-offer data. Keep specifications to the 10 most useful shopper-facing facts.";
    const context = JSON.stringify({ query, categories: categories ?? [], connected_stores: connectedStores, connected_affiliate_providers: providers ?? [] });
    const models = ["gpt-5.4-nano", "gpt-5-nano", "gpt-5.6-luna"]; let result: any; let selectedModel = ""; const failures: string[] = [];
    for (const model of models) {
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, instructions, input: context, tools: [{ type: "web_search" }], include: ["web_search_call.action.sources"], max_output_tokens: 5000, text: { format: { type: "json_schema", name: "product_enrichment", strict: true, schema } } }) });
      result = await response.json();
      if (response.ok) { selectedModel = model; break; }
      const code = String(result?.error?.code ?? result?.error?.type ?? response.status);
      failures.push(`${model}: ${code}`);
    }
    if (!selectedModel) return respond({ error: `OpenAI could not complete this product search. ${failures.join(", ")}. Please retry in a moment.` }, 502);
    let proposal: any; try { proposal = JSON.parse(extractText(result)); } catch { return respond({ error: "AI returned product information in an unreadable format. Please try again." }, 502); }
    const allowedCategoryIds = new Set((categories ?? []).map((item: any) => item.id));
    const allowedStores = new Map(connectedStores.map((name: string) => [name.toLowerCase(), name]));
    proposal.category_id = allowedCategoryIds.has(proposal.category_id) ? proposal.category_id : null;
    proposal.offer_candidates = (Array.isArray(proposal.offer_candidates) ? proposal.offer_candidates : []).filter((offer: any) => allowedStores.has(String(offer.store_name).toLowerCase())).map((offer: any) => ({ ...offer, store_name: allowedStores.get(String(offer.store_name).toLowerCase()) })).slice(0, 10);
    proposal.gallery_images = (Array.isArray(proposal.gallery_images) ? proposal.gallery_images : []).filter((url: unknown) => typeof url === "string" && url.startsWith("http")).slice(0, 8);
    proposal.specifications = (Array.isArray(proposal.specifications) ? proposal.specifications : []).slice(0, 10);
    proposal.sources = sourceList(result); proposal.ai_model = selectedModel;
    await ctx.supabaseAdmin.from("audit_events").insert({ actor_id: auth.user.id, event_type: "ai_product_enrichment_requested", entity_type: "product", source: "admin", metadata: { query, model: selectedModel, source_count: proposal.sources.length, offer_candidate_count: proposal.offer_candidates.length } });
    return respond({ proposal });
  }),
};
