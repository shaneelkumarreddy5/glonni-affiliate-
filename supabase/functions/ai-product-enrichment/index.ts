import { withSupabase } from "@supabase/server";

type Json = Record<string, unknown>;
const respond = (body: Json, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const extractText = (response: any) => typeof response?.output_text === "string" ? response.output_text.trim() : (response?.output ?? []).flatMap((item: any) => item?.content ?? []).map((part: any) => typeof part?.text === "string" ? part.text : part?.text?.value ?? "").filter(Boolean).join("\n").trim();
const hostname = (value: string) => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const isAllowedUrl = (value: string, domains: string[]) => { const host = hostname(value); return Boolean(host) && domains.some(domain => host === domain || host.endsWith(`.${domain}`)); };
const sourceList = (response: any, domains: string[]) => {
  const found = new Map<string, { title: string; url: string }>();
  for (const item of response?.output ?? []) for (const source of item?.action?.sources ?? []) {
    const url = String(source?.url ?? "").trim();
    if (url.startsWith("http") && isAllowedUrl(url, domains)) found.set(url, { title: String(source?.title ?? new URL(url).hostname), url });
  }
  return [...found.values()].slice(0, 12);
};
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableBoolean = { type: ["boolean", "null"] };
const schema = {
  type: "object", additionalProperties: false,
  required: ["verification_status", "verification_message", "title", "brand", "model_code", "description", "confidence", "canonical_identity", "category_id", "category_reason", "primary_image_url", "gallery_images", "image_candidates", "variations", "specifications", "product_information", "offer_candidates", "section_confidence", "conflicts", "missing_fields"],
  properties: {
    verification_status: { type: "string", enum: ["verified", "not_verified"] }, verification_message: { type: "string" },
    title: { type: "string" }, brand: nullableString, model_code: nullableString, description: nullableString,
    confidence: { type: "number", minimum: 0, maximum: 100 }, category_id: nullableString, primary_image_url: nullableString,
    canonical_identity: { type: "object", additionalProperties: false, required: ["manufacturer", "product_family", "model", "model_number", "gtin", "variant", "colour", "size", "storage"], properties: { manufacturer: nullableString, product_family: nullableString, model: nullableString, model_number: nullableString, gtin: nullableString, variant: nullableString, colour: nullableString, size: nullableString, storage: nullableString } },
    category_reason: nullableString,
    gallery_images: { type: "array", items: { type: "string" } },
    image_candidates: { type: "array", items: { type: "object", additionalProperties: false, required: ["url", "source_url", "source_type", "usage_note"], properties: { url: { type: "string" }, source_url: nullableString, source_type: { type: "string" }, usage_note: nullableString } } },
    variations: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "values"], properties: { label: { type: "string" }, values: { type: "array", items: { type: "string" } } } } },
    specifications: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value", "icon_key"], properties: { label: { type: "string" }, value: { type: "string" }, icon_key: { type: "string" } } } },
    product_information: { type: "object", additionalProperties: false, required: ["overview", "highlights", "in_the_box", "warranty", "care_instructions"], properties: { overview: nullableString, highlights: nullableString, in_the_box: nullableString, warranty: nullableString, care_instructions: nullableString } },
    offer_candidates: { type: "array", items: { type: "object", additionalProperties: false, required: ["store_name", "match_status", "product_url", "exact_variant_match", "variant", "current_price", "stock_status", "customer_rating", "rating_count", "bank_offer", "coupon_code", "source_updated_at"], properties: { store_name: { type: "string" }, match_status: { type: "string", enum: ["exact_match", "different_variant", "not_found", "unable_to_verify"] }, product_url: nullableString, exact_variant_match: nullableBoolean, variant: nullableString, current_price: nullableNumber, stock_status: nullableString, customer_rating: nullableNumber, rating_count: nullableNumber, bank_offer: nullableString, coupon_code: nullableString, source_updated_at: nullableString } } },
    section_confidence: { type: "object", additionalProperties: false, required: ["identity", "category", "images", "variations", "specifications", "information", "offers"], properties: { identity: { type: "number" }, category: { type: "number" }, images: { type: "number" }, variations: { type: "number" }, specifications: { type: "number" }, information: { type: "number" }, offers: { type: "number" } } },
    conflicts: { type: "array", items: { type: "object", additionalProperties: false, required: ["field", "values", "recommended_value", "reason"], properties: { field: { type: "string" }, values: { type: "array", items: { type: "string" } }, recommended_value: nullableString, reason: { type: "string" } } } },
    missing_fields: { type: "array", items: { type: "string" } },
  },
};
const offerOnlySchema = {
  type: "object", additionalProperties: false,
  required: ["verification_status", "verification_message", "offer_candidates", "confidence", "conflicts", "missing_fields"],
  properties: {
    verification_status: { type: "string", enum: ["verified", "not_verified"] }, verification_message: { type: "string" },
    offer_candidates: schema.properties.offer_candidates,
    confidence: { type: "number", minimum: 0, maximum: 100 },
    conflicts: schema.properties.conflicts,
    missing_fields: schema.properties.missing_fields,
  },
};

const categoryPaths = (rows: any[]) => { const byId = new Map(rows.map(row => [row.id, row])); const path = (row: any, seen = new Set<string>()): string => { if (!row?.parent_id || seen.has(row.id)) return row?.name ?? ""; seen.add(row.id); return `${path(byId.get(row.parent_id), seen)} > ${row.name}`; }; const parentIds = new Set(rows.map(row => row.parent_id).filter(Boolean)); return rows.map(row => ({ id: row.id, name: row.name, parent_id: row.parent_id, path: path(row), depth: path(row).split(" > ").length - 1, is_leaf: !parentIds.has(row.id) })); };
const tokens = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(word => word.length > 1));
const similarity = (left: string, right: string) => { const a=tokens(left), b=tokens(right); if(!a.size||!b.size)return 0; let same=0; for(const word of a)if(b.has(word))same++; return same/new Set([...a,...b]).size; };

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
    const body = await req.json().catch(() => ({})) as { query?: string; productId?: string };
    const query = body.query?.trim();
    if (!query || query.length < 3) return respond({ error: "Enter a clear product name first." }, 400);
    const [{ data: globalSettings }, { data: catalogueAgent }] = await Promise.all([
      ctx.supabaseAdmin.from("platform_settings").select("global_rules,work_controls").eq("id", 1).maybeSingle(),
      ctx.supabaseAdmin.from("ai_agents").select("is_enabled").eq("key", "catalogue_merchandising").maybeSingle(),
    ]);
    if (catalogueAgent && !catalogueAgent.is_enabled) return respond({ error: "Catalogue & Merchandising is stopped on its AI Agents page." }, 423);
    if (globalSettings?.work_controls?.pause_all === true || globalSettings?.work_controls?.ai_workflows === false) return respond({ error: "AI workflows are paused in global Settings." }, 423);
    if (globalSettings?.work_controls?.product_intake === false) return respond({ error: "Automated product intake is stopped in global Settings." }, 423);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return respond({ error: "OpenAI is not configured for product enrichment." }, 503);
    const startedAt = Date.now();
    await ctx.supabaseAdmin.from("ai_agents").update({ runtime_status: "running", latest_error: null, updated_at: new Date().toISOString() }).eq("key", "catalogue_merchandising");
    const [{ data: categories }, { data: merchants }, { data: providers }, { data: existingProducts }, currentProductResult] = await Promise.all([
      ctx.supabaseAdmin.from("categories").select("id,name,parent_id").eq("is_active", true).is("archived_at", null),
      ctx.supabaseAdmin.from("merchants").select("id,name,storefront_url").eq("is_active", true),
      ctx.supabaseAdmin.from("affiliate_providers").select("id,name").eq("is_active", true),
      ctx.supabaseAdmin.from("products").select("id,title,brand,slug,manual_metadata").limit(500),
      body.productId ? ctx.supabaseAdmin.from("products").select("id,title,brand,description,image_url,gallery_images,variants,specifications,product_information,category_id,manual_metadata").eq("id", body.productId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const domainStores = (merchants ?? []).map((item: any) => ({ ...item, domain: hostname(String(item.storefront_url ?? "")) })).filter((item: any) => item.domain);
    const allowedDomains = [...new Set(domainStores.map((item: any) => item.domain))].slice(0, 100);
    if (!allowedDomains.length) return respond({ error: "No active connected store or brand website is configured. Add a valid website URL before using AI fetch." }, 409);
    const currentProduct = (currentProductResult as any)?.data;
    const savedMasterComplete = Boolean(currentProduct?.title && currentProduct?.image_url && ((currentProduct?.specifications?.length ?? 0) > 0 || (currentProduct?.variants?.length ?? 0) > 0));
    const fetchMode = savedMasterComplete ? "offers_only" : "master_and_offers";
    const connectedStores = (merchants ?? []).map((item: any) => item.name);
    const commonRules = "Use ONLY the supplied connected store and brand websites. Never use news, review, rumour, comparison or unrelated websites. The user supplies only a product name; do not ask for colour, storage or other options. Search and return every verified variant available. Mark verified only when the exact product/model is visibly listed on at least one allowed connected website. If it is not verified, say so clearly, return no invented product, price or image data, and set verification_status to not_verified. Return one offer row for every connected store, using not_found or unable_to_verify when appropriate. Store checks need ONLY exact variant match, variant label, current price, bank offer, coupon, rating/count, stock, merchant product URL and checked time. Never fetch or decide Glonni cashback, commission, confirmation time or payout terms.";
    const sharedRules = String(globalSettings?.global_rules ?? "").trim();
    const ownerRuleText = sharedRules ? ` Mandatory global owner rules to follow: ${sharedRules}` : "";
    const instructions = fetchMode === "offers_only"
      ? `You update connected-store availability for an existing Glonni product. ${commonRules} Do not research or return product identity, images, descriptions, categories, specifications or variations; the saved master record is authoritative and must be reused.${ownerRuleText}`
      : `You create a verified product master for Glonni, an Indian affiliate-shopping platform. ${commonRules} Research identity, official product images, all variants, specifications and shopper information once. Prefer a connected manufacturer/brand website for master facts. Choose the deepest accurate supplied category_id and never invent categories. Image URLs must point to the real product and come from an allowed connected domain. Report disagreements instead of guessing. Keep specifications to the 10 most useful category-appropriate shopper facts.${ownerRuleText}`;
    const context = JSON.stringify({ query, fetch_mode: fetchMode, saved_master_product: savedMasterComplete ? currentProduct : null, category_tree: fetchMode === "master_and_offers" ? categoryPaths(categories ?? []) : [], connected_stores: domainStores.map(({ id, name, storefront_url, domain }: any) => ({ id, name, storefront_url, domain })), connected_affiliate_providers: providers ?? [], global_operating_rules: sharedRules });
    const models = ["gpt-5.4-nano", "gpt-5-nano", "gpt-5.6-luna"]; let result: any; let selectedModel = ""; const failures: string[] = [];
    for (const model of models) {
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, instructions, input: context, tools: [{ type: "web_search", filters: { allowed_domains: allowedDomains }, external_web_access: true }], tool_choice: "required", include: ["web_search_call.action.sources"], max_output_tokens: fetchMode === "offers_only" ? 2200 : 5000, text: { format: { type: "json_schema", name: fetchMode === "offers_only" ? "connected_store_offer_check" : "product_enrichment", strict: true, schema: fetchMode === "offers_only" ? offerOnlySchema : schema } } }) });
      result = await response.json();
      if (response.ok) { selectedModel = model; break; }
      const code = String(result?.error?.code ?? result?.error?.type ?? response.status);
      failures.push(`${model}: ${code}`);
    }
    if (!selectedModel) { const failure = failures.join(", "); const { data: agent } = await ctx.supabaseAdmin.from("ai_agents").select("failure_count").eq("key", "catalogue_merchandising").single(); await ctx.supabaseAdmin.from("ai_agents").update({ runtime_status: "failed", last_run_at: new Date().toISOString(), last_duration_ms: Date.now() - startedAt, failure_count: Number(agent?.failure_count ?? 0) + 1, latest_error: failure, updated_at: new Date().toISOString() }).eq("key", "catalogue_merchandising"); return respond({ error: `OpenAI could not complete this product search. ${failure}. Please retry in a moment.` }, 502); }
    let proposal: any; try { proposal = JSON.parse(extractText(result)); } catch { return respond({ error: "AI returned product information in an unreadable format. Please try again." }, 502); }
    if (fetchMode === "offers_only") proposal = { ...currentProduct, model_code: currentProduct?.manual_metadata?.model_code ?? null, canonical_identity: currentProduct?.manual_metadata?.canonical_identity ?? {}, category_reason: "Existing approved catalogue assignment retained.", primary_image_url: currentProduct?.image_url ?? null, gallery_images: currentProduct?.gallery_images ?? [], image_candidates: [], variations: currentProduct?.variants ?? [], specifications: currentProduct?.specifications ?? [], product_information: currentProduct?.product_information ?? {}, section_confidence: { identity: 100, category: 100, images: 100, variations: 100, specifications: 100, information: 100, offers: proposal.confidence ?? 0 }, ...proposal };
    proposal.fetch_mode = fetchMode;
    const allowedCategoryIds = new Set((categories ?? []).map((item: any) => item.id));
    const allowedStores = new Map(connectedStores.map((name: string) => [name.toLowerCase(), name]));
    proposal.category_id = allowedCategoryIds.has(proposal.category_id) ? proposal.category_id : null;
    proposal.offer_candidates = (Array.isArray(proposal.offer_candidates) ? proposal.offer_candidates : []).filter((offer: any) => allowedStores.has(String(offer.store_name).toLowerCase())).map((offer: any) => ({ ...offer, store_name: allowedStores.get(String(offer.store_name).toLowerCase()), product_url: typeof offer.product_url === "string" && isAllowedUrl(offer.product_url, allowedDomains) ? offer.product_url : null })).slice(0, 100);
    const images=[proposal.primary_image_url,...(Array.isArray(proposal.gallery_images)?proposal.gallery_images:[]),...(Array.isArray(proposal.image_candidates)?proposal.image_candidates.map((item:any)=>item?.url):[])].filter((url:unknown)=>typeof url==="string"&&url.startsWith("http")&&(fetchMode==="offers_only"||isAllowedUrl(url,allowedDomains))); const uniqueImages=[...new Set(images)]; proposal.primary_image_url=uniqueImages[0]??null; proposal.gallery_images=uniqueImages.slice(1,9);
    proposal.image_candidates=(Array.isArray(proposal.image_candidates)?proposal.image_candidates:[]).filter((item:any)=>typeof item?.url==="string"&&uniqueImages.includes(item.url)).slice(0,12);
    proposal.specifications = (Array.isArray(proposal.specifications) ? proposal.specifications : []).slice(0, 10);
    proposal.conflicts=(Array.isArray(proposal.conflicts)?proposal.conflicts:[]).slice(0,20); proposal.missing_fields=[...new Set(Array.isArray(proposal.missing_fields)?proposal.missing_fields.map(String):[])].slice(0,30);
    const chosenCategory=categoryPaths(categories??[]).find((category:any)=>category.id===proposal.category_id); if(chosenCategory&&!chosenCategory.is_leaf){proposal.missing_fields=[...new Set([...proposal.missing_fields,"deepest category confirmation"])];proposal.section_confidence.category=Math.min(Number(proposal.section_confidence?.category)||0,70);}
    proposal.duplicate_candidates=(existingProducts??[]).map((product:any)=>({id:product.id,title:product.title,brand:product.brand,slug:product.slug,similarity:Math.round(similarity(`${proposal.brand??""} ${proposal.title}`,`${product.brand??""} ${product.title}`)*100)})).filter((product:any)=>product.similarity>=68).sort((a:any,b:any)=>b.similarity-a.similarity).slice(0,8);
    proposal.sources = sourceList(result, allowedDomains); proposal.ai_model = selectedModel;
    if (!proposal.sources.length) { proposal.verification_status = "not_verified"; proposal.verification_message = "The exact product could not be verified on any connected store or brand website."; proposal.offer_candidates = []; }
    await ctx.supabaseAdmin.from("audit_events").insert({ actor_id: auth.user.id, event_type: "ai_product_enrichment_requested", entity_type: "product", source: "admin", metadata: { query, model: selectedModel, source_count: proposal.sources.length, offer_candidate_count: proposal.offer_candidates.length } });
    const { data: agent } = await ctx.supabaseAdmin.from("ai_agents").select("success_count").eq("key", "catalogue_merchandising").single();
    await ctx.supabaseAdmin.from("ai_agents").update({ runtime_status: "idle", last_run_at: new Date().toISOString(), last_duration_ms: Date.now() - startedAt, success_count: Number(agent?.success_count ?? 0) + 1, latest_error: null, updated_at: new Date().toISOString() }).eq("key", "catalogue_merchandising");
    return respond({ proposal });
  }),
};
