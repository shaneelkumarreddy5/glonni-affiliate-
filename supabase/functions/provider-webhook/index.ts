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
    const { error: payloadError } = await ctx.supabaseAdmin.from("provider_webhook_payloads").insert({ event_id: event.id, payload });
    if (payloadError) {
      await ctx.supabaseAdmin.from("provider_webhook_events").update({ delivery_status: "failed", error_code: "payload_store_failed" }).eq("id", event.id);
      await delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "failed", response_status: 500, error_code: "payload_store_failed" });
      return json({ error: "Webhook could not be stored." }, 500);
    }
    await Promise.all([
      delivery({ provider_id: provider.id, payload_sha256: payloadSha256, payload_bytes: textEncoder.encode(rawPayload).byteLength, signature_valid: true, outcome: "accepted", response_status: 202 }),
      ctx.supabaseAdmin.from("activity_events").insert({ request_id: requestId, surface: "api", event_type: "provider_webhook_queued", endpoint: "/functions/v1/provider-webhook", http_method: "POST", request_status: 202, response_time_ms: 0, error_details: null, metadata: { provider_key: providerKey, provider_event_id: providerEventId, event_type: eventType } }),
    ]);
    return json({ ok: true, status: "queued" }, 202);
  }),
};
