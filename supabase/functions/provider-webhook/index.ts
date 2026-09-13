import { withSupabase } from "@supabase/server";

const maxPayloadBytes = 512 * 1024;
const maxAgeSeconds = 5 * 60;
const providerKeyPattern = /^[a-z0-9_-]{2,80}$/;
const textEncoder = new TextEncoder();

const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const safeHeader = (value: string | null, max: number) => (value ?? "").trim().slice(0, max);
const secretName = (key: string) => `PROVIDER_WEBHOOK_SECRET_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return Array.from(new Uint8Array(signature), (part) => part.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  const a = textEncoder.encode(left);
  const b = textEncoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

type ProviderPayload = Record<string, unknown>;
const object = (value: unknown): ProviderPayload => value && typeof value === "object" && !Array.isArray(value) ? value as ProviderPayload : {};
const first = (payload: ProviderPayload, keys: string[]) => {
  const containers = [payload, object(payload.data), object(payload.order), object(payload.conversion), object(object(payload.data).order)];
  for (const container of containers) for (const key of keys) {
    const value = container[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
};
const amount = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
};
const conversionStatus = (value: string | null) => {
  const status = (value ?? "pending").toLowerCase();
  if (["approved", "confirmed", "completed", "paid", "valid"].includes(status)) return "confirmed";
  if (["rejected", "declined", "invalid"].includes(status)) return "rejected";
  if (["cancelled", "canceled", "refunded", "void"].includes(status)) return "cancelled";
  return "pending";
};

export default {
  fetch: withSupabase({ auth: "none" }, async (request, ctx) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const providerKey = safeHeader(url.searchParams.get("provider"), 80).toLowerCase();
    const requestId = crypto.randomUUID();
    const providerEventId = safeHeader(request.headers.get("x-glonni-event-id"), 200) || null;
    const eventType = safeHeader(request.headers.get("x-glonni-event-type"), 120) || "provider_event";
    const timestamp = safeHeader(request.headers.get("x-glonni-timestamp"), 20);
    const forwarded = safeHeader(request.headers.get("x-forwarded-for"), 120);
    const sourceIp = forwarded.split(",")[0]?.trim() || null;
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    const delivery = async (values: Record<string, unknown>) => {
      await ctx.supabaseAdmin.from("provider_webhook_deliveries").insert({
        request_id: requestId, provider_key: providerKey || "unknown", provider_event_id: providerEventId,
        event_type: eventType, source_ip: sourceIp, ...values,
      });
    };

    if (!providerKeyPattern.test(providerKey)) {
      await delivery({ outcome: "rejected", response_status: 400, error_code: "invalid_provider_key" });
      return json({ error: "A valid provider key is required." }, 400);
    }
    if (!providerEventId) {
      await delivery({ outcome: "rejected", response_status: 400, error_code: "missing_event_id" });
      return json({ error: "x-glonni-event-id is required." }, 400);
    }
    if (!Number.isFinite(contentLength) || contentLength > maxPayloadBytes) {
      await delivery({ outcome: "rejected", response_status: 413, error_code: "payload_too_large" });
      return json({ error: "Payload exceeds the 512 KB limit." }, 413);
    }

    const rawPayload = await request.text();
    if (textEncoder.encode(rawPayload).byteLength > maxPayloadBytes) {
      await delivery({ outcome: "rejected", response_status: 413, error_code: "payload_too_large" });
      return json({ error: "Payload exceeds the 512 KB limit." }, 413);
    }
    const payloadSha256 = await sha256(rawPayload);
    const { data: provider } = await ctx.supabaseAdmin
      .from("affiliate_providers").select("id,is_active").eq("adapter_key", providerKey).maybeSingle();
    if (!provider?.id || !provider.is_active) {
      await delivery({ provider_id: provider?.id ?? null, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, outcome: "rejected", response_status: 409, error_code: "provider_not_enabled" });
      return json({ error: "This provider is not enabled for webhooks." }, 409);
    }

    const seconds = Number(timestamp);
    if (!Number.isInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > maxAgeSeconds) {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, outcome: "rejected", response_status: 401, error_code: "expired_timestamp" });
      return json({ error: "Webhook timestamp is missing, invalid, or expired." }, 401);
    }

    const secret = Deno.env.get(secretName(providerKey));
    if (!secret) {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, outcome: "rejected", response_status: 503, error_code: "webhook_not_configured" });
      return json({ error: "Webhook is not configured for this provider." }, 503);
    }
    const signature = safeHeader(request.headers.get("x-glonni-signature"), 200).replace(/^sha256=/i, "").toLowerCase();
    const expected = await hmacSha256(secret, `${seconds}.${rawPayload}`);
    if (!signature || !timingSafeEqual(signature, expected)) {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, outcome: "rejected", response_status: 401, error_code: "invalid_signature" });
      return json({ error: "Webhook signature is invalid." }, 401);
    }

    let payload: unknown;
    try { payload = JSON.parse(rawPayload); } catch {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, outcome: "rejected", response_status: 400, error_code: "invalid_json" });
      return json({ error: "Webhook payload must be valid JSON." }, 400);
    }

    const { data: event, error: eventError } = await ctx.supabaseAdmin.from("provider_webhook_events").insert({
      provider_id: provider.id, provider_key: providerKey, provider_event_id: providerEventId, event_type: eventType,
      request_id: requestId, signature_valid: true, delivery_status: "queued", payload_sha256: payloadSha256,
      payload_bytes: textEncoder.encode(rawPayload).byteLength, source_ip: sourceIp,
    }).select("id").single();
    if (eventError?.code === "23505") {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "duplicate", response_status: 200, error_code: "duplicate_event" });
      return json({ ok: true, status: "duplicate" });
    }
    if (eventError || !event) {
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "failed", response_status: 500, error_code: "event_store_failed" });
      return json({ error: "Webhook could not be queued." }, 500);
    }
    const { error: payloadError } = await ctx.supabaseAdmin.rpc("store_private_provider_payload", { p_event_id: event.id, p_payload: payload });
    if (payloadError) {
      await ctx.supabaseAdmin.from("provider_webhook_events").update({ delivery_status: "failed", error_code: "payload_store_failed" }).eq("id", event.id);
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "failed", response_status: 500, error_code: "payload_store_failed" });
      return json({ error: "Webhook could not be stored." }, 500);
    }

    const body = object(payload);
    const clickReference = first(body, ["click_id", "clickid", "click_ref", "click_reference", "subid", "sub_id", "aff_sub", "sid", "transaction_id"]);
    const orderReference = first(body, ["order_id", "order_reference", "transaction_id", "conversion_id", "sale_id"]) ?? providerEventId;
    const orderValue = amount(first(body, ["order_value", "sale_amount", "amount", "revenue", "basket_value"]));
    const commission = amount(first(body, ["commission", "commission_amount", "payout", "earning"]));
    const currency = (first(body, ["currency", "currency_code"]) ?? "INR").toUpperCase().slice(0, 3);
    const occurred = first(body, ["occurred_at", "conversion_time", "transaction_date", "created_at", "timestamp"]);
    const parsedOccurred = occurred && !Number.isNaN(Date.parse(occurred)) ? new Date(occurred).toISOString() : null;
    const rawStatus = first(body, ["status", "conversion_status", "order_status"]);
    const { data: clickRows } = clickReference ? await ctx.supabaseAdmin.from("redirect_events")
      .select("id,profile_id,offer_id,merchant_id,provider_id")
      .eq("provider_id", provider.id).eq("attribution_value", clickReference).limit(2) : { data: [] };
    const matches = clickRows ?? [];
    const click = matches.length === 1 ? matches[0] : null;
    const matchStatus = click ? "matched" : matches.length > 1 ? "ambiguous" : "unmatched";
    const issueCode = click ? null : clickReference ? (matches.length > 1 ? "multiple_click_matches" : "click_reference_not_found") : "missing_click_reference";
    const normalized = { provider_status: rawStatus, provider_event_type: eventType };
    const { data: existing } = await ctx.supabaseAdmin.from("referral_conversions").select("id").eq("provider_id", provider.id).eq("provider_order_reference", orderReference).maybeSingle();
    const conversionValues = {
      webhook_event_id: event.id, redirect_event_id: click?.id ?? null, profile_id: click?.profile_id ?? null,
      offer_id: click?.offer_id ?? null, merchant_id: click?.merchant_id ?? null, provider_id: provider.id,
      provider_order_reference: orderReference, provider_click_reference: clickReference,
      status: conversionStatus(rawStatus), order_value: orderValue, commission_amount: commission,
      cashback_amount: null, cashback_eligible: false, currency: /^[A-Z]{3}$/.test(currency) ? currency : "INR",
      occurred_at: parsedOccurred, match_status: matchStatus, match_method: click ? "provider_click_reference" : null,
      issue_code: issueCode, provider_payload: normalized,
    };
    const conversionResult = existing?.id
      ? await ctx.supabaseAdmin.from("referral_conversions").update({
          status: conversionValues.status, order_value: orderValue, commission_amount: commission,
          currency: conversionValues.currency, occurred_at: parsedOccurred, provider_payload: normalized, updated_at: new Date().toISOString(),
          ...(click ? { redirect_event_id: click.id, profile_id: click.profile_id, offer_id: click.offer_id, merchant_id: click.merchant_id, provider_click_reference: clickReference, match_status: "matched", match_method: "provider_click_reference", issue_code: null } : {}),
        }).eq("id", existing.id).select("id").single()
      : await ctx.supabaseAdmin.from("referral_conversions").insert(conversionValues).select("id").single();
    const { data: conversion, error: conversionError } = conversionResult;
    if (conversionError) {
      const duplicate = conversionError.code === "23505";
      await ctx.supabaseAdmin.from("provider_webhook_events").update({ delivery_status: duplicate ? "processed" : "failed", error_code: duplicate ? "duplicate_conversion" : "conversion_store_failed", processed_at: new Date().toISOString() }).eq("id", event.id);
      if (!duplicate) return json({ error: "Conversion could not be normalized." }, 500);
    } else {
      await ctx.supabaseAdmin.from("provider_webhook_events").update({ conversion_id: conversion.id, delivery_status: "processed", error_code: existing?.id ? "conversion_status_updated" : null, processed_at: new Date().toISOString() }).eq("id", event.id);
    }
    await Promise.all([
      delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "accepted", response_status: 202 }),
      ctx.supabaseAdmin.from("activity_events").insert({ request_id: requestId, surface: "api", event_type: "provider_webhook_queued", endpoint: "/functions/v1/provider-webhook", http_method: "POST", request_status: 202, response_time_ms: 0, error_details: null, metadata: { provider_key: providerKey, provider_event_id: providerEventId, event_type: eventType } }),
    ]);
    return json({ ok: true, status: existing?.id ? "updated" : conversionError?.code === "23505" ? "duplicate" : matchStatus }, 202);
  }),
};
