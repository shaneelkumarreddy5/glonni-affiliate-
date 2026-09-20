"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readSheet } from "read-excel-file/node";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
const pairs = (value: FormDataEntryValue | null) =>
  lines(value)
    .map((item) => {
      const split = item.indexOf(":");
      return split < 0
        ? { label: item, value: "" }
        : {
            label: item.slice(0, split).trim(),
            value: item.slice(split + 1).trim(),
          };
    })
    .filter((item) => item.label);
const optionalNumber = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

async function requireProductAdmin() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: assurance },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user) redirect("/admin/login");
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("employees")
      .select("status")
      .eq("profile_id", user.id)
      .single(),
  ]);
  if (
    !profile ||
    !["owner", "admin"].includes(profile.role) ||
    !employee ||
    employee.status !== "active" ||
    assurance?.currentLevel !== "aal2"
  )
    throw new Error(
      "A verified owner or administrator 2FA session is required.",
    );
  return { supabase, user };
}
async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  event: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("audit_events").insert({
    actor_id: userId,
    event_type: event,
    entity_type: "product",
    entity_id: entityId,
    source: "admin",
    metadata,
  });
}
function refresh(productId: string, slug?: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  if (slug) revalidatePath(`/product/${slug}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

export async function updateProductIdentity(form: FormData) {
  const { supabase, user } = await requireProductAdmin(),
    id = String(form.get("productId") ?? ""),
    title = String(form.get("title") ?? "").trim();
  if (!id || !title) throw new Error("Product and title are required.");
  const { data: current } = await supabase
    .from("products")
    .select("slug")
    .eq("id", id)
    .single();
  const values = {
    title,
    brand: String(form.get("brand") ?? "").trim() || null,
    description: String(form.get("description") ?? "").trim() || null,
    category_id: String(form.get("categoryId") ?? "") || null,
    image_url: String(form.get("imageUrl") ?? "").trim() || null,
    is_active: form.get("isActive") === "on",
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("products").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, "product_identity_updated", id, { title });
  refresh(id, current?.slug);
  redirect(
    `/admin/products/${id}?section=overview&success=Product%20identity%20saved`,
  );
}

export async function updateProductContent(form: FormData) {
  const { supabase, user } = await requireProductAdmin(),
    id = String(form.get("productId") ?? "");
  if (!id) throw new Error("Product is required.");
  const { data: current } = await supabase
    .from("products")
    .select("slug")
    .eq("id", id)
    .single();
  const gallery = lines(form.get("galleryImages")).slice(0, 12),
    variants = pairs(form.get("variants")).map((v) => ({
      ...v,
      values: v.value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    })),
    specifications = pairs(form.get("specifications")).slice(0, 50),
    information = Object.fromEntries(
      pairs(form.get("productInformation")).map((v) => [
        slugify(v.label) || v.label,
        v.value,
      ]),
    );
  const { error } = await supabase
    .from("products")
    .update({
      gallery_images: gallery,
      variants,
      specifications,
      product_information: information,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, "product_content_updated", id, {
    gallery_count: gallery.length,
    variant_groups: variants.length,
    specification_count: specifications.length,
  });
  refresh(id, current?.slug);
  redirect(
    `/admin/products/${id}?section=content&success=Product%20content%20saved`,
  );
}

export async function updateProductOffer(form: FormData) {
  const { supabase, user } = await requireProductAdmin(),
    productId = String(form.get("productId") ?? ""),
    offerId = String(form.get("offerId") ?? "");
  if (!productId || !offerId)
    throw new Error("Product and offer are required.");
  const currentPrice = optionalNumber(form.get("currentPrice")),
    listPrice = optionalNumber(form.get("listPrice")),
    rating = optionalNumber(form.get("customerRating")),
    ratingCount = optionalNumber(form.get("ratingCount")),
    days = optionalNumber(form.get("cashbackDays")),
    requestedStockStatus = String(form.get("stockStatus") ?? "unknown"),
    requestedStatus = String(form.get("status") ?? "draft"),
    stockStatus = ["in_stock", "low_stock", "out_of_stock", "unknown"].includes(
      requestedStockStatus,
    )
      ? requestedStockStatus
      : "unknown",
    status = ["draft", "active", "paused", "expired"].includes(requestedStatus)
      ? requestedStatus
      : "draft";
  const values = {
    current_price:
      currentPrice !== null && currentPrice >= 0 ? currentPrice : null,
    list_price: listPrice !== null && listPrice > 0 ? listPrice : null,
    bank_offer: String(form.get("bankOffer") ?? "").trim() || null,
    customer_rating:
      rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    rating_count: ratingCount !== null && ratingCount >= 0 ? ratingCount : null,
    stock_status: stockStatus,
    cashback_confirmation_days: days !== null && days >= 0 ? days : null,
    variant_label: String(form.get("variantLabel") ?? "").trim() || null,
    reward_terms: String(form.get("rewardTerms") ?? "").trim() || null,
    status,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("offers")
    .update(values)
    .eq("id", offerId)
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  if (values.current_price !== null)
    await supabase.from("product_price_history").insert({
      product_id: productId,
      offer_id: offerId,
      price: values.current_price,
      source: "admin",
    });
  const { data: product } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .single();
  await audit(supabase, user.id, "product_offer_updated", productId, {
    offer_id: offerId,
  });
  refresh(productId, product?.slug);
  redirect(
    `/admin/products/${productId}?section=offers&success=Store%20offer%20saved`,
  );
}

const wizardSteps = [
  "basic",
  "images",
  "variations",
  "specifications",
  "information",
  "offers",
  "history",
  "discovery",
  "review",
] as const;
type WizardStep = (typeof wizardSteps)[number];
const wizardUrl = (productId: string, step: WizardStep, message?: string) =>
  `/admin/products?view=manual&draft=${productId}&step=${step}${
    message ? `&success=${encodeURIComponent(message)}` : ""
  }`;
const textList = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
const formRows = (form: FormData, prefix: string) => {
  const labels = form.getAll(`${prefix}Label`).map(String);
  const values = form.getAll(`${prefix}Value`).map(String);
  return labels
    .map((label, index) => ({
      label: label.trim(),
      value: (values[index] ?? "").trim(),
    }))
    .filter((row) => row.label && row.value);
};
async function productSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string,
  excludeId?: string,
) {
  const base = slugify(title) || `product-${Date.now()}`;
  let candidate = base;
  for (let suffix = 1; suffix < 100; suffix++) {
    let query = supabase.from("products").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix + 1}`;
  }
  return `${base}-${Date.now()}`;
}
async function mergeManualMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  patch: Record<string, unknown>,
) {
  const { data } = await supabase
    .from("products")
    .select("manual_metadata")
    .eq("id", productId)
    .single();
  const current =
    data?.manual_metadata && typeof data.manual_metadata === "object"
      ? (data.manual_metadata as Record<string, unknown>)
      : {};
  const { error } = await supabase
    .from("products")
    .update({
      manual_metadata: { ...current, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

const cleanText = (value: unknown, max = 4000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanUrl = (value: unknown) => {
  const text = cleanText(value, 2000);
  try {
    return ["http:", "https:"].includes(new URL(text).protocol) ? text : "";
  } catch {
    return "";
  }
};

export async function applyAiProductProposal(raw: unknown, existingId?: string) {
  const { supabase, user } = await requireProductAdmin();
  if (!raw || typeof raw !== "object") throw new Error("AI product details are missing.");
  const proposal = raw as Record<string, any>;
  if (proposal.verification_status !== "verified") throw new Error("This product was not verified on a connected store or brand website, so it cannot be applied.");
  const title = cleanText(proposal.title, 240);
  if (!title) throw new Error("AI could not confirm the product name.");
  const requestedCategory = cleanText(proposal.category_id, 80);
  const { data: category } = requestedCategory
    ? await supabase.from("categories").select("id").eq("id", requestedCategory).eq("is_active", true).maybeSingle()
    : { data: null };
  const variants = (Array.isArray(proposal.variations) ? proposal.variations : []).map((item: any) => ({ label: cleanText(item?.label, 80), values: (Array.isArray(item?.values) ? item.values : []).map((value: unknown) => cleanText(value, 120)).filter(Boolean).slice(0, 30) })).filter((item: any) => item.label && item.values.length).slice(0, 20);
  const specifications = (Array.isArray(proposal.specifications) ? proposal.specifications : []).map((item: any) => ({ label: cleanText(item?.label, 120), value: cleanText(item?.value, 500), icon_key: cleanText(item?.icon_key, 60) || "specification" })).filter((item: any) => item.label && item.value).slice(0, 40);
  const gallery = (Array.isArray(proposal.gallery_images) ? proposal.gallery_images : []).map(cleanUrl).filter(Boolean).slice(0, 12);
  const sourceRows = (Array.isArray(proposal.sources) ? proposal.sources : []).map((item: any) => ({ title: cleanText(item?.title, 240), url: cleanUrl(item?.url) })).filter((item: any) => item.url).slice(0, 12);
  const offerCandidates = (Array.isArray(proposal.offer_candidates) ? proposal.offer_candidates : []).map((item: any) => ({ store_name: cleanText(item?.store_name, 120), match_status: ["exact_match", "different_variant", "not_found", "unable_to_verify"].includes(item?.match_status) ? item.match_status : "unable_to_verify", product_url: cleanUrl(item?.product_url) || null, exact_variant_match: item?.exact_variant_match === true, variant: cleanText(item?.variant, 240) || null, current_price: Number.isFinite(item?.current_price) ? item.current_price : null, stock_status: cleanText(item?.stock_status, 40) || null, customer_rating: Number.isFinite(item?.customer_rating) ? item.customer_rating : null, rating_count: Number.isFinite(item?.rating_count) ? item.rating_count : null, bank_offer: cleanText(item?.bank_offer, 500) || null, coupon_code: cleanText(item?.coupon_code, 100) || null, source_updated_at: cleanText(item?.source_updated_at, 80) || null })).filter((item: any) => item.store_name).slice(0, 100);
  const productInformation = proposal.product_information && typeof proposal.product_information === "object" ? {
    highlights: cleanText(proposal.product_information.highlights),
    features: cleanText(proposal.product_information.overview),
    usage: cleanText(proposal.product_information.care_instructions),
    package_contents: cleanText(proposal.product_information.in_the_box),
    warranty: cleanText(proposal.product_information.warranty),
  } : {};
  const primaryImage = cleanUrl(proposal.primary_image_url) || gallery[0] || null;
  const values = { title, brand: cleanText(proposal.brand, 160) || null, category_id: category?.id ?? null, description: cleanText(proposal.description) || null, image_url: primaryImage, gallery_images: gallery, variants, specifications, product_information: Object.fromEntries(Object.entries(productInformation).filter(([, value]) => value)), updated_at: new Date().toISOString() };
  let productId = existingId;
  let slug = await productSlug(supabase, title, existingId);
  if (existingId) {
    const { error } = await supabase.from("products").update(values).eq("id", existingId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("products").insert({ ...values, slug, is_active: false }).select("id").single();
    if (error || !data) throw new Error(error?.message || "Unable to create the AI-assisted draft.");
    productId = data.id;
  }
  const duplicateCandidates=(Array.isArray(proposal.duplicate_candidates)?proposal.duplicate_candidates:[]).map((item:any)=>({id:cleanText(item?.id,80),title:cleanText(item?.title,240),brand:cleanText(item?.brand,160)||null,slug:cleanText(item?.slug,240),similarity:Math.max(0,Math.min(100,Number(item?.similarity)||0))})).filter((item:any)=>item.id&&item.title).slice(0,8);
  const conflicts=(Array.isArray(proposal.conflicts)?proposal.conflicts:[]).slice(0,20); const missingFields=(Array.isArray(proposal.missing_fields)?proposal.missing_fields:[]).map((item:unknown)=>cleanText(item,120)).filter(Boolean).slice(0,30);
  await mergeManualMetadata(supabase, productId!, { model_code: cleanText(proposal.model_code, 160), canonical_identity: proposal.canonical_identity&&typeof proposal.canonical_identity==="object"?proposal.canonical_identity:{}, workflow_step: "basic", ai_offer_candidates: offerCandidates, ai_image_candidates: Array.isArray(proposal.image_candidates)?proposal.image_candidates.slice(0,12):[], ai_enrichment: { fetch_mode: proposal.fetch_mode === "offers_only" ? "offers_only" : "master_and_offers", verification_status: "verified", verification_message: cleanText(proposal.verification_message, 1000), confidence: Math.max(0, Math.min(100, Number(proposal.confidence) || 0)), section_confidence: proposal.section_confidence&&typeof proposal.section_confidence==="object"?proposal.section_confidence:{}, category_reason: cleanText(proposal.category_reason,1000), conflicts, missing_fields: missingFields, duplicate_candidates: duplicateCandidates, sources: sourceRows, model: cleanText(proposal.ai_model, 80), fetched_at: new Date().toISOString(), needs_review: true } });
  await audit(supabase, user.id, "ai_product_details_applied", productId!, { source_count: sourceRows.length, offer_candidate_count: offerCandidates.length });
  refresh(productId!, slug);
  return { productId: productId! };
}

export async function createEmptyManualProductDraft(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const requestedStep = String(form.get("step") ?? "basic");
  const allowedSteps = new Set([
    "basic",
    "images",
    "variations",
    "specifications",
    "information",
    "offers",
    "history",
    "discovery",
    "review",
  ]);
  const step = (allowedSteps.has(requestedStep)
    ? requestedStep
    : "basic") as WizardStep;
  const title = "Untitled product";
  const slug = await productSlug(supabase, title);
  const { data, error } = await supabase
    .from("products")
    .insert({
      title,
      slug,
      is_active: false,
      manual_metadata: {
        workflow_step: step,
        auto_created_draft: true,
      },
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(error?.message || "Unable to create product draft.");
  await audit(supabase, user.id, "manual_product_draft_created", data.id, {
    entry_step: step,
  });
  refresh(data.id, slug);
  redirect(wizardUrl(data.id, step, "Draft workspace created."));
}

export async function createManualProductDraft(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const title = String(form.get("title") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "");
  if (!title || !categoryId)
    throw new Error("Product name and category are required.");
  const slug = await productSlug(supabase, title);
  const { data, error } = await supabase
    .from("products")
    .insert({
      title,
      slug,
      brand: String(form.get("brand") ?? "").trim() || null,
      category_id: categoryId,
      description: String(form.get("description") ?? "").trim() || null,
      is_active: false,
      manual_metadata: {
        model_code: String(form.get("modelCode") ?? "").trim(),
        workflow_step: "images",
      },
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(error?.message || "Unable to create draft.");
  await audit(supabase, user.id, "manual_product_draft_created", data.id, {
    title,
  });
  refresh(data.id, slug);
  redirect(wizardUrl(data.id, "basic", "Product draft created."));
}

export async function saveManualBasic(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "");
  if (!productId || !title || !categoryId)
    throw new Error("Product, name and category are required.");
  const slug = await productSlug(supabase, title, productId);
  const { error } = await supabase
    .from("products")
    .update({
      title,
      slug,
      brand: String(form.get("brand") ?? "").trim() || null,
      category_id: categoryId,
      description: String(form.get("description") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    model_code: String(form.get("modelCode") ?? "").trim(),
    workflow_step: "images",
  });
  await audit(supabase, user.id, "manual_product_basic_saved", productId, {});
  refresh(productId, slug);
  redirect(wizardUrl(productId, "basic", "Basic information saved."));
}

export async function saveManualImages(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  if (!productId) throw new Error("Product is required.");
  const imageUrl = String(form.get("imageUrl") ?? "").trim() || null;
  const gallery = lines(form.get("galleryImages")).slice(0, 12);
  const { error } = await supabase
    .from("products")
    .update({
      image_url: imageUrl,
      gallery_images: gallery,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    workflow_step: "variations",
  });
  await audit(supabase, user.id, "manual_product_images_saved", productId, {
    gallery_count: gallery.length,
  });
  refresh(productId);
  redirect(wizardUrl(productId, "images", "Images saved."));
}

export async function saveManualVariations(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const rows = formRows(form, "variation").map((row) => ({
    label: row.label,
    values: row.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }));
  const { error } = await supabase
    .from("products")
    .update({ variants: rows, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    workflow_step: "specifications",
  });
  await audit(supabase, user.id, "manual_product_variations_saved", productId, {
    groups: rows.length,
  });
  refresh(productId);
  redirect(wizardUrl(productId, "variations", "Variations saved."));
}

export async function saveManualSpecifications(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const specifications = formRows(form, "specification").slice(0, 40);
  const { error } = await supabase
    .from("products")
    .update({ specifications, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    workflow_step: "information",
  });
  await audit(
    supabase,
    user.id,
    "manual_product_specifications_saved",
    productId,
    {
      count: specifications.length,
    },
  );
  refresh(productId);
  redirect(wizardUrl(productId, "specifications", "Specifications saved."));
}

export async function saveManualInformation(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const keys = [
    "highlights",
    "features",
    "materials",
    "usage",
    "package_contents",
    "warranty",
    "manufacturer",
    "additional_details",
  ];
  const information = Object.fromEntries(
    keys
      .map((key) => [key, String(form.get(key) ?? "").trim()])
      .filter(([, value]) => value),
  );
  const { error } = await supabase
    .from("products")
    .update({
      product_information: information,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, { workflow_step: "offers" });
  await audit(
    supabase,
    user.id,
    "manual_product_information_saved",
    productId,
    {},
  );
  refresh(productId);
  redirect(wizardUrl(productId, "information", "Product information saved."));
}

export async function addManualOffer(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const merchantId = String(form.get("merchantId") ?? "");
  const providerId = String(form.get("providerId") ?? "") || null;
  const destinationUrl = String(form.get("destinationUrl") ?? "").trim();
  if (!productId || !merchantId || !destinationUrl)
    throw new Error("Product, store and affiliate URL are required.");
  const parsed = new URL(destinationUrl);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Use a valid HTTP or HTTPS affiliate URL.");
  const currentPrice = optionalNumber(form.get("currentPrice"));
  if (currentPrice === null || currentPrice < 0)
    throw new Error("Enter a valid selling price.");
  const requestedRewardType = String(form.get("rewardType") ?? "none");
  const rewardType = [
    "none",
    "fixed_cashback",
    "percentage_cashback",
    "coupon",
    "merchant_promotion",
  ].includes(requestedRewardType)
    ? requestedRewardType
    : "none";
  const { data, error } = await supabase
    .from("offers")
    .insert({
      product_id: productId,
      merchant_id: merchantId,
      provider_id: providerId,
      external_offer_id:
        String(form.get("externalOfferId") ?? "").trim() || null,
      destination_url: destinationUrl,
      current_price: currentPrice,
      list_price: optionalNumber(form.get("listPrice")),
      reward_type: rewardType,
      cashback_amount: optionalNumber(form.get("cashbackAmount")),
      cashback_percent: optionalNumber(form.get("cashbackPercent")),
      commission_rate: optionalNumber(form.get("commissionRate")),
      commission_amount: optionalNumber(form.get("commissionAmount")),
      coupon_code: String(form.get("couponCode") ?? "").trim() || null,
      bank_offer: String(form.get("bankOffer") ?? "").trim() || null,
      customer_rating: optionalNumber(form.get("customerRating")),
      rating_count: optionalNumber(form.get("ratingCount")),
      stock_status: String(form.get("stockStatus") ?? "unknown"),
      cashback_confirmation_days: optionalNumber(form.get("cashbackDays")),
      variant_label: String(form.get("variantLabel") ?? "").trim() || null,
      reward_terms: String(form.get("rewardTerms") ?? "").trim() || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to add offer.");
  await supabase.from("product_price_history").insert({
    product_id: productId,
    offer_id: data.id,
    price: currentPrice,
    source: "manual_entry",
  });
  await mergeManualMetadata(supabase, productId, { workflow_step: "history" });
  await audit(supabase, user.id, "manual_product_offer_added", productId, {
    offer_id: data.id,
  });
  refresh(productId);
  redirect(wizardUrl(productId, "offers", "Store offer added."));
}

export async function addManualPriceHistory(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const offerId = String(form.get("offerId") ?? "");
  const price = optionalNumber(form.get("price"));
  if (!productId || !offerId || price === null || price < 0)
    throw new Error("Offer and valid historical price are required.");
  const recordedAt = String(form.get("recordedAt") ?? "");
  const { error } = await supabase.from("product_price_history").insert({
    product_id: productId,
    offer_id: offerId,
    price,
    recorded_at: recordedAt
      ? new Date(recordedAt).toISOString()
      : new Date().toISOString(),
    source: "manual_correction",
  });
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    workflow_step: "discovery",
  });
  await audit(supabase, user.id, "manual_price_history_added", productId, {
    offer_id: offerId,
  });
  refresh(productId);
  redirect(wizardUrl(productId, "history", "Price history saved."));
}

export async function saveManualDiscovery(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  await mergeManualMetadata(supabase, productId, {
    search_keywords: textList(form.get("searchKeywords")),
    tags: textList(form.get("tags")),
    seo_title: String(form.get("seoTitle") ?? "").trim(),
    seo_description: String(form.get("seoDescription") ?? "").trim(),
    placement: String(form.get("placement") ?? "none"),
    featured: form.get("featured") === "on",
    related_product_ids: form
      .getAll("relatedProductIds")
      .map(String)
      .filter(Boolean),
    workflow_step: "review",
  });
  await audit(
    supabase,
    user.id,
    "manual_product_discovery_saved",
    productId,
    {},
  );
  refresh(productId);
  redirect(wizardUrl(productId, "discovery", "Discovery settings saved."));
}

export async function publishManualProduct(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const { data: product } = await supabase
    .from("products")
    .select(
      "slug,title,brand,category_id,image_url,specifications,offers(id,current_price,destination_url)",
    )
    .eq("id", productId)
    .single();
  if (!product) throw new Error("Product was not found.");
  const missing = [
    !product.title && "product name",
    !product.category_id && "category",
    !product.image_url && "primary image",
    !(product.offers ?? []).some(
      (offer) => offer.current_price && offer.destination_url,
    ) && "complete store offer",
  ].filter(Boolean);
  if (missing.length)
    throw new Error(`Complete ${missing.join(", ")} before publishing.`);
  await supabase
    .from("offers")
    .update({ status: "active" })
    .eq("product_id", productId);
  const { error } = await supabase
    .from("products")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await mergeManualMetadata(supabase, productId, {
    workflow_step: "complete",
    published_at: new Date().toISOString(),
  });
  await audit(supabase, user.id, "manual_product_published", productId, {});
  refresh(productId, product.slug);
  redirect(
    `/admin/products/${productId}?section=preview&success=Product%20published`,
  );
}

export async function reviewProductCandidate(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const productId = String(form.get("productId") ?? "");
  const decision = String(form.get("decision") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!productId || !["approve", "changes_requested", "reject"].includes(decision))
    throw new Error("A product and valid review decision are required.");

  const { data: product } = await supabase
    .from("products")
    .select("slug,title,category_id,image_url,manual_metadata,offers(id,current_price,destination_url)")
    .eq("id", productId)
    .single();
  if (!product) throw new Error("Product was not found.");

  if (decision === "approve") {
    const missing = [
      !product.title && "product name",
      !product.category_id && "category",
      !product.image_url && "primary image",
      !(product.offers ?? []).some((offer) => offer.current_price && offer.destination_url) && "complete store offer",
    ].filter(Boolean) as string[];
    if (missing.length)
      redirect(`/admin/products?view=approval&error=${encodeURIComponent(`Complete ${missing.join(", ")} before approval.`)}`);
    await supabase.from("offers").update({ status: "active" }).eq("product_id", productId);
    const { error } = await supabase.from("products").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", productId);
    if (error) throw new Error(error.message);
  } else if (!note) {
    redirect(`/admin/products?view=approval&error=${encodeURIComponent("Add a review note before requesting changes or rejecting a product.")}`);
  }

  await mergeManualMetadata(supabase, productId, {
    workflow_step: decision === "approve" ? "complete" : "review",
    review_status: decision === "approve" ? "approved" : decision,
    review_note: note || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
    ...(decision === "approve" ? { published_at: new Date().toISOString() } : {}),
  });
  await audit(supabase, user.id, `product_${decision}`, productId, { note });
  refresh(productId, product.slug);
  const message = decision === "approve" ? "Product approved and published" : decision === "reject" ? "Product rejected" : "Changes requested";
  redirect(`/admin/products?view=approval&success=${encodeURIComponent(message)}`);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = "";
    } else value += character;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const bulkHeader = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const bulkText = (value: unknown) => String(value ?? "").trim();

export async function importProductSpreadsheet(form: FormData) {
  const { supabase, user } = await requireProductAdmin();
  const file = form.get("file");
  const selectedProviderId = String(form.get("providerId") ?? "") || null;
  if (!(file instanceof File) || !file.size) throw new Error("Choose a CSV or XLSX file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("The upload must be 8 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "xlsx"].includes(extension)) throw new Error("Only CSV and XLSX files are accepted.");

  const matrix = extension === "xlsx"
    ? (await readSheet(Buffer.from(await file.arrayBuffer()))).map((row) => row.map((cell) => cell ?? ""))
    : parseCsv(await file.text());
  if (matrix.length < 2) throw new Error("The file must contain a header and at least one product row.");
  if (matrix.length > 1001) throw new Error("Upload no more than 1,000 product rows per batch.");
  const headers = matrix[0].map(bulkHeader);
  const required = ["title", "category", "store", "product_url", "price"];
  const missingHeaders = required.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);

  const [{ data: categories }, { data: merchants }, { data: providers }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id,name,slug").eq("is_active", true).is("archived_at", null),
    supabase.from("merchants").select("id,name,slug").eq("is_active", true),
    supabase.from("affiliate_providers").select("id,name,is_active"),
    supabase.from("products").select("id,title,brand"),
  ]);
  const categoryMap = new Map((categories ?? []).flatMap((item) => [[item.name.toLowerCase(), item], [item.slug.toLowerCase(), item]]));
  const merchantMap = new Map((merchants ?? []).flatMap((item) => [[item.name.toLowerCase(), item], [item.slug.toLowerCase(), item]]));
  const providerMap = new Map((providers ?? []).flatMap((item) => [[item.name.toLowerCase(), item], [item.id, item]]));
  const duplicateKeys = new Set((existing ?? []).map((item) => `${item.title.trim().toLowerCase()}|${String(item.brand ?? "").trim().toLowerCase()}`));

  const { data: batch, error: batchError } = await supabase.from("import_batches").insert({
    provider_id: selectedProviderId,
    source_type: "csv_feed",
    status: "draft",
    source_label: file.name.slice(0, 240),
    total_rows: matrix.length - 1,
    submitted_by: user.id,
    notes: `Uploaded ${extension.toUpperCase()} file`,
  }).select("id").single();
  if (batchError || !batch) throw new Error(batchError?.message ?? "Unable to create import batch.");

  let validRows = 0, invalidRows = 0;
  const seen = new Set<string>();
  for (let index = 1; index < matrix.length; index++) {
    const raw = Object.fromEntries(headers.map((header, column) => [header || `column_${column + 1}`, bulkText(matrix[index][column])]));
    const title = bulkText(raw.title), brand = bulkText(raw.brand), categoryValue = bulkText(raw.category).toLowerCase(), storeValue = bulkText(raw.store).toLowerCase();
    const category = categoryMap.get(categoryValue), merchant = merchantMap.get(storeValue);
    const price = Number(raw.price), listPrice = raw.list_price ? Number(raw.list_price) : null;
    const url = bulkText(raw.product_url), imageUrl = bulkText(raw.image_url);
    const provider = providerMap.get(bulkText(raw.provider).toLowerCase()) ?? (selectedProviderId ? providerMap.get(selectedProviderId) : null);
    const errors: string[] = [];
    if (!title) errors.push("Product title is required");
    if (!category) errors.push("Category does not match the active catalogue");
    if (!merchant) errors.push("Store does not match an active store");
    if (!Number.isFinite(price) || price <= 0) errors.push("Price must be greater than zero");
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { errors.push("Product URL must be a valid HTTP or HTTPS URL"); }
    if (imageUrl) try { const parsed = new URL(imageUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { errors.push("Image URL is invalid"); }
    if ((raw.provider || selectedProviderId) && (!provider || !provider.is_active)) errors.push("Affiliate provider is unknown or inactive");
    const key = `${title.toLowerCase()}|${brand.toLowerCase()}`;
    const duplicate = Boolean(title && (duplicateKeys.has(key) || seen.has(key)));
    const normalized = { title, brand: brand || null, description: bulkText(raw.description) || null, category_id: category?.id ?? null, merchant_id: merchant?.id ?? null, provider_id: provider?.id ?? null, product_url: url, current_price: Number.isFinite(price) ? price : null, list_price: listPrice !== null && Number.isFinite(listPrice) ? listPrice : null, image_url: imageUrl || null };
    let productId: string | null = null;
    let status = errors.length ? "invalid" : duplicate ? "duplicate" : "valid";
    if (status === "valid") {
      const { data: product, error: productError } = await supabase.from("products").insert({ title, slug: `${slugify(title) || "imported-product"}-${crypto.randomUUID().slice(0, 8)}`, brand: brand || null, description: normalized.description, category_id: category!.id, image_url: imageUrl || null, is_active: false, manual_metadata: { source: "bulk_upload", import_batch_id: batch.id, import_row: index + 1, workflow_step: "review", review_status: "pending_review" } }).select("id").single();
      if (productError || !product) { errors.push(productError?.message ?? "Product draft could not be created"); status = "invalid"; }
      else {
        productId = product.id;
        const { error: offerError } = await supabase.from("offers").insert({ product_id: product.id, merchant_id: merchant!.id, provider_id: provider?.id ?? null, destination_url: url, current_price: price, list_price: normalized.list_price, status: "draft" });
        if (offerError) { await supabase.from("products").delete().eq("id", product.id); productId = null; errors.push(offerError.message); status = "invalid"; }
      }
    }
    if (status === "valid") { validRows++; seen.add(key); duplicateKeys.add(key); } else invalidRows++;
    await supabase.from("import_batch_rows").insert({ batch_id: batch.id, row_number: index + 1, status, raw_data: raw, normalized_data: normalized, validation_errors: errors, product_id: productId });
  }
  await supabase.from("import_batches").update({ status: validRows ? "approval_required" : "validated", valid_rows: validRows, invalid_rows: invalidRows, updated_at: new Date().toISOString() }).eq("id", batch.id);
  await audit(supabase, user.id, "product_bulk_upload_validated", batch.id, { file_name: file.name, valid_rows: validRows, invalid_rows: invalidRows });
  revalidatePath("/admin/products");
  redirect(`/admin/products?view=bulk&batch=${batch.id}&success=${encodeURIComponent(`${validRows} product drafts sent to approval; ${invalidRows} rows need attention.`)}`);
}
