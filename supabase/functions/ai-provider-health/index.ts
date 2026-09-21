import { withSupabase } from "@supabase/server";

const respond = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await ctx.supabaseAdmin.auth.getUser(token);
    if (!auth.user) return respond({ error: "A signed-in administrator is required." }, 401);

    const [{ data: profile }, { data: employee }] = await Promise.all([
      ctx.supabaseAdmin.from("profiles").select("role").eq("id", auth.user.id).single(),
      ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", auth.user.id).single(),
    ]);
    if (!["owner", "admin"].includes(profile?.role) || employee?.status !== "active") {
      return respond({ error: "Only active owners and administrators can check provider health." }, 403);
    }

    const apiKey = Deno.env.get("TYPESAFE_API_KEY");
    if (!apiKey) {
      await ctx.supabaseAdmin.from("ai_provider_connections").update({ connection_status: "not_configured", display_name: "JEV", updated_at: new Date().toISOString() }).eq("provider_key", "jiao");
      return respond({ provider: "jev", status: "not_configured" }, 503);
    }

    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        state: "Glonni provider health check",
        model: "jev-latest",
        questions: { service_ready: { type: "noul", instructions: "The service is responding to this health check." } },
      }),
    });

    const status = response.ok ? "connected" : "invalid";
    await ctx.supabaseAdmin.from("ai_provider_connections").update({ connection_status: status, display_name: "JEV", updated_at: new Date().toISOString() }).eq("provider_key", "jiao");
    return respond({ provider: "jev", status }, response.ok ? 200 : 502);
  }),
};
