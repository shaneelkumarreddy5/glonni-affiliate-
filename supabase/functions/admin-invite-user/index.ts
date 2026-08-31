import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type InviteBody = {
  mode?: "bootstrap_owner" | "employee";
  email?: string;
  displayName?: string;
  role?: "editor" | "admin" | "owner";
  departmentId?: string | null;
  jobTitle?: string;
  phone?: string;
  managerId?: string | null;
  joiningDate?: string | null;
  employmentType?: "full_time" | "part_time" | "contractor" | "intern";
  approvalLimit?: number;
};

const response = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const decodeJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
};

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
    const body = (await req.json()) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const siteUrl = "https://glonni-affiliate.vercel.app";

    if (body.mode === "bootstrap_owner") {
      if (email !== "admin@glonni.com") return response({ error: "Owner bootstrap email is fixed." }, 403);
      const { data: ownerProfiles } = await ctx.supabaseAdmin.from("profiles").select("id").eq("role", "owner").limit(1);
      if (ownerProfiles?.length) return response({ error: "The Owner account is already provisioned." }, 409);
      const { data: users } = await ctx.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (users.users.some((user) => user.email?.toLowerCase() === email)) return response({ error: "The Owner invitation already exists." }, 409);
      const { error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: "Glonni Owner" },
        redirectTo: `${siteUrl}/auth/callback?next=/admin/onboarding`,
      });
      if (error) return response({ error: error.message }, 400);
      return response({ ok: true, message: "Owner invitation sent." });
    }

    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await ctx.supabaseAdmin.auth.getUser(token);
    const claims = decodeJwt(token);
    if (userError || !user || claims.aal !== "aal2") return response({ error: "A verified admin session with 2FA is required." }, 401);

    const { data: profile } = await ctx.supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    const { data: employee } = await ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role) || !employee || !["active", "invited"].includes(employee.status)) {
      return response({ error: "You do not have permission to invite employees." }, 403);
    }

    if (!email || !body.displayName || !body.jobTitle || !body.role) return response({ error: "Complete all required employee fields." }, 400);
    if (body.role === "owner" && profile.role !== "owner") return response({ error: "Only the Owner can grant Owner access." }, 403);

    const { data: invitation, error: insertError } = await ctx.supabaseAdmin.from("admin_invitations").insert({
      email,
      display_name: body.displayName,
      role: body.role,
      department_id: body.departmentId || null,
      job_title: body.jobTitle,
      phone: body.phone || null,
      manager_id: body.managerId || null,
      joining_date: body.joiningDate || null,
      employment_type: body.employmentType ?? "full_time",
      approval_limit: Number(body.approvalLimit ?? 0),
      status: "pending",
      invited_by: user.id,
    }).select("id").single();
    if (insertError) return response({ error: insertError.message }, 400);

    const { error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: body.displayName },
      redirectTo: `${siteUrl}/auth/callback?next=/admin/onboarding`,
    });
    if (inviteError) {
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "failed" }).eq("id", invitation.id);
      return response({ error: inviteError.message }, 400);
    }
    await ctx.supabaseAdmin.from("admin_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invitation.id);
    await ctx.supabaseAdmin.from("audit_events").insert({
      actor_id: user.id, event_type: "employee_invited", entity_type: "admin_invitation", entity_id: invitation.id,
      source: "admin", metadata: { email, role: body.role },
    });
    return response({ ok: true, invitationId: invitation.id });
  }),
};
