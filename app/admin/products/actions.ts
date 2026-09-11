"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  await supabase
    .from("audit_events")
    .insert({
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
    status = ["draft", "active", "paused", "expired"].includes(
      requestedStatus,
    )
      ? requestedStatus
      : "draft";
  const values = {
    current_price: currentPrice !== null && currentPrice >= 0 ? currentPrice : null,
    list_price: listPrice !== null && listPrice > 0 ? listPrice : null,
    bank_offer: String(form.get("bankOffer") ?? "").trim() || null,
    customer_rating:
      rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    rating_count:
      ratingCount !== null && ratingCount >= 0 ? ratingCount : null,
    stock_status: stockStatus,
    cashback_confirmation_days:
      days !== null && days >= 0 ? days : null,
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
    await supabase
      .from("product_price_history")
      .insert({
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
