"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const placements = ["hero", "top_deals", "trending", "price_drops", "cashback_picks", "collection"];
const refresh = () => { revalidatePath("/admin/campaigns"); revalidatePath("/admin/offers"); revalidatePath("/"); };
async function operator(approval = false) {
  const s = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([s.auth.getUser(), s.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect("/admin/login");
  const [{ data: profile }, { data: employee }] = await Promise.all([s.from("profiles").select("role").eq("id", user.id).single(), s.from("employees").select("status").eq("profile_id", user.id).single()]);
  if (!profile || !(approval ? ["owner", "admin"] : ["owner", "admin", "editor"]).includes(profile.role) || employee?.status !== "active" || assurance?.currentLevel !== "aal2") throw new Error("An active staff 2FA session with campaign permission is required.");
  return { s, user };
}
async function audit(s: Awaited<ReturnType<typeof createClient>>, actor: string, event: string, id: string, metadata: Record<string, unknown> = {}) { await s.from("audit_events").insert({ actor_id: actor, event_type: event, entity_type: "homepage_campaign", entity_id: id, source: "admin", metadata }); }

export async function createCampaign(form: FormData) {
  const { s, user } = await operator();
  const title = String(form.get("title") ?? "").trim(), placement = String(form.get("placement") ?? ""), device = String(form.get("device") ?? "all"), offer_id = String(form.get("offer") ?? "") || null;
  if (!title || !placements.includes(placement)) throw new Error("Enter a title and placement.");
  const { data, error } = await s.from("homepage_campaigns").insert({ title, placement, device, offer_id, image_url: String(form.get("imageUrl") ?? "") || null, cta_label: String(form.get("cta") ?? "") || null, display_order: Number(form.get("displayOrder")) || 99, status: "draft", created_by: user.id }).select("id").single();
  if (error) throw new Error(error.message); await audit(s, user.id, "campaign_created", data.id, { placement, device }); refresh(); redirect(`/admin/campaigns?campaign=${data.id}&step=creative`);
}

export async function approvePromotionRecommendation(form: FormData) {
  const { s, user } = await operator(true); const offerId = String(form.get("offerId") ?? ""), placement = String(form.get("placement") ?? "top_deals");
  const { data: offer } = await s.from("offers").select("id,status,current_price,destination_url,products(title,image_url)").eq("id", offerId).single();
  if (!offer || offer.status !== "active" || !offer.current_price || !offer.destination_url) throw new Error("Only a complete active affiliate offer can become a campaign.");
  const product = offer.products as unknown as { title?: string; image_url?: string } | null;
  const { data: campaign, error } = await s.from("homepage_campaigns").insert({ title: `${product?.title || "Approved deal"} promotion`, placement: placements.includes(placement) ? placement : "top_deals", device: "all", offer_id: offerId, image_url: product?.image_url || null, headline: product?.title || "Approved deal", cta_label: "View deal", status: "draft", created_by: user.id, approved_by: user.id, approved_at: new Date().toISOString() }).select("id").single();
  if (error) throw new Error(error.message);
  await s.from("promotion_recommendations").upsert({ offer_id: offerId, ai_score: Number(form.get("score")) || 75, recommended_placement: placement, rationale: String(form.get("rationale") ?? "Strong verified customer value."), status: "draft_created", reviewed_by: user.id, reviewed_at: new Date().toISOString(), campaign_id: campaign.id }, { onConflict: "offer_id,status" });
  await audit(s, user.id, "promotion_recommendation_approved", campaign.id, { offer_id: offerId }); refresh(); redirect(`/admin/campaigns?campaign=${campaign.id}&step=distribution&success=Campaign%20draft%20created`);
}

export async function saveCampaignDistribution(form: FormData) {
  const { s, user } = await operator(); const id = String(form.get("campaignId") ?? ""); if (!id) throw new Error("Campaign is required.");
  const website = form.getAll("website").map(String).filter((x) => ["hero", "top_deals", "category", "store", "search"].includes(x));
  if (!website.length) throw new Error("Select at least one website placement.");
  const startsAt = String(form.get("startsAt") ?? "") || null, endsAt = String(form.get("endsAt") ?? "") || null;
  const distribution = { website, ads: [], social: [], note: "External channels remain unavailable until their accounts are securely connected." };
  const { error } = await s.from("homepage_campaigns").update({ distribution_config: distribution, starts_at: startsAt, ends_at: endsAt, device: String(form.get("device") ?? "all"), status: "pending", updated_at: new Date().toISOString() }).eq("id", id); if (error) throw new Error(error.message);
  await s.from("campaign_channels").delete().eq("campaign_id", id);
  const { error: channelError } = await s.from("campaign_channels").insert(website.map((key) => ({ campaign_id: id, channel_type: "website", channel_key: key, is_enabled: true, connection_status: "connected", configuration: { display_order: Number(form.get(`order_${key}`)) || 1 }, status: "ready" }))); if (channelError) throw new Error(channelError.message);
  await audit(s, user.id, "campaign_distribution_saved", id, { website }); refresh(); redirect(`/admin/campaigns?campaign=${id}&step=review&success=Distribution%20saved`);
}

export async function campaignStatus(form: FormData) {
  const action = String(form.get("action") ?? ""), id = String(form.get("id") ?? ""); const { s, user } = await operator(["approve", "publish"].includes(action));
  const values = action === "submit" ? { status: "pending" } : action === "approve" ? { status: "approved", approved_by: user.id, approved_at: new Date().toISOString() } : action === "publish" ? { status: "published", final_approved_at: new Date().toISOString(), published_at: new Date().toISOString() } : action === "pause" ? { status: "paused" } : null;
  if (!id || !values) throw new Error("Invalid campaign action.");
  if (action === "publish") { const { count } = await s.from("campaign_channels").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("channel_type", "website").eq("status", "ready"); if (!count) throw new Error("Configure at least one ready website placement before publishing."); }
  const { error } = await s.from("homepage_campaigns").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw new Error(error.message);
  await audit(s, user.id, `campaign_${action}`, id); refresh(); redirect(`/admin/campaigns?campaign=${id}&step=${action === "publish" ? "complete" : "review"}`);
}
