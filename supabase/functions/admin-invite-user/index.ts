import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type InviteBody = {
  mode?: "bootstrap_owner" | "employee" | "complete_onboarding" | "owner_setup";
  email?: string;
  token?: string;
  password?: string;
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

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
    const body = (await req.json()) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const siteUrl = "https://glonni-affiliate.vercel.app";

    if (body.mode === "owner_setup") {
      const token = body.token?.trim() ?? "";
      const password = body.password ?? "";
      const strongPassword = password.length >= 12
        && /[a-z]/.test(password)
        && /[A-Z]/.test(password)
        && /[0-9]/.test(password)
        && /[^A-Za-z0-9]/.test(password);
      if (token.length < 40 || !strongPassword) {
        return response({ error: "Use a valid setup link and a password with 12+ characters, uppercase, lowercase, number and symbol." }, 400);
      }

      const tokenHash = await sha256(token);
      const { data: setupToken } = await ctx.supabaseAdmin
        .from("admin_setup_tokens")
        .select("id, profile_id, purpose")
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!setupToken) return response({ error: "This setup link is invalid, expired or already used." }, 403);

      const [{ data: setupProfile }, { data: setupEmployee }] = await Promise.all([
        ctx.supabaseAdmin.from("profiles").select("role").eq("id", setupToken.profile_id).single(),
        ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", setupToken.profile_id).single(),
      ]);
      if (setupProfile?.role !== "owner" || !setupEmployee || !["invited", "active"].includes(setupEmployee.status)) {
        return response({ error: "This setup link is not authorized for the Owner account." }, 403);
      }

      const { error: passwordError } = await ctx.supabaseAdmin.auth.admin.updateUserById(setupToken.profile_id, {
        password,
        email_confirm: true,
      });
      if (passwordError) return response({ error: "The Owner password could not be saved." }, 400);

      await ctx.supabaseAdmin.from("admin_setup_tokens").update({ used_at: new Date().toISOString() }).eq("id", setupToken.id).is("used_at", null);
      await ctx.supabaseAdmin.from("audit_events").insert({
        actor_id: setupToken.profile_id,
        event_type: setupToken.purpose === "initial_password" ? "owner_password_initialized" : "owner_password_reset",
        entity_type: "employee",
        entity_id: setupToken.profile_id,
        source: "admin",
        metadata: { method: "one_time_setup_token" },
      });
      return response({ ok: true, message: "Owner password saved. Sign in to complete 2FA." });
    }

    if (body.mode === "bootstrap_owner") {
      if (email !== "admin@glonni.com") return response({ error: "Owner bootstrap email is fixed." }, 403);
      const { data: ownerProfiles } = await ctx.supabaseAdmin.from("profiles").select("id").eq("role", "owner").limit(1);
      if (ownerProfiles?.length) return response({ error: "The Owner account is already provisioned." }, 409);
      const { data: users } = await ctx.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let invitedUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
      let invitationSent = false;
      if (!invitedUser) {
        const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { display_name: "Glonni Owner" },
          redirectTo: `${siteUrl}/auth/callback?next=/admin/onboarding`,
        });
        if (error || !data.user) return response({ error: error?.message ?? "Owner invitation failed." }, 400);
        invitedUser = data.user;
        invitationSent = true;
      }
      await ctx.supabaseAdmin.auth.admin.updateUserById(invitedUser.id, {
        app_metadata: { ...invitedUser.app_metadata, admin_role: "owner", employee: true },
        user_metadata: { ...invitedUser.user_metadata, display_name: "Glonni Owner" },
      });
      await ctx.supabaseAdmin.from("profiles").upsert({ id: invitedUser.id, display_name: "Glonni Owner", role: "owner", updated_at: new Date().toISOString() });
      const { data: ownerDepartment } = await ctx.supabaseAdmin.from("departments").select("id").eq("code", "OWNER").single();
      await ctx.supabaseAdmin.from("employees").upsert({
        profile_id: invitedUser.id,
        employee_code: `GL-${invitedUser.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
        work_email: email,
        job_title: "Founder & Owner",
        department_id: ownerDepartment?.id ?? null,
        employment_type: "full_time",
        status: "invited",
        approval_limit: 0,
        requires_mfa: true,
        updated_at: new Date().toISOString(),
      });
      return response({ ok: true, message: invitationSent ? "Owner invitation sent." : "Existing Owner invitation repaired." });
    }

    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await ctx.supabaseAdmin.auth.getUser(token);
    const claims = decodeJwt(token);
    if (userError || !user || claims.aal !== "aal2") return response({ error: "A verified admin session with 2FA is required." }, 401);

    const { data: profile } = await ctx.supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    const { data: employee } = await ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", user.id).single();
    if (!profile || !["owner", "admin", "editor"].includes(profile.role) || !employee || !["active", "invited"].includes(employee.status)) return response({ error: "This admin account is not active." }, 403);

    if (body.mode === "complete_onboarding") {
      await ctx.supabaseAdmin.from("employees").update({ status: "active", updated_at: new Date().toISOString() }).eq("profile_id", user.id);
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("email", user.email).in("status", ["pending", "sent"]);
      await ctx.supabaseAdmin.from("audit_events").insert({
        actor_id: user.id, event_type: "admin_onboarding_completed", entity_type: "employee", entity_id: user.id,
        source: "admin", metadata: { aal: "aal2" },
      });
      return response({ ok: true, message: "Admin onboarding completed." });
    }

    if (!["owner", "admin"].includes(profile.role)) return response({ error: "You do not have permission to invite employees." }, 403);

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

    const { data: inviteData, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: body.displayName },
      redirectTo: `${siteUrl}/auth/callback?next=/admin/onboarding`,
    });
    if (inviteError || !inviteData.user) {
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "failed" }).eq("id", invitation.id);
      return response({ error: inviteError.message }, 400);
    }
    const invitedUser = inviteData.user;
    await ctx.supabaseAdmin.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: { ...invitedUser.app_metadata, admin_role: body.role, employee: true },
      user_metadata: { ...invitedUser.user_metadata, display_name: body.displayName },
    });
    await ctx.supabaseAdmin.from("profiles").upsert({ id: invitedUser.id, display_name: body.displayName, role: body.role, updated_at: new Date().toISOString() });
    await ctx.supabaseAdmin.from("employees").upsert({
      profile_id: invitedUser.id,
      employee_code: `GL-${invitedUser.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      work_email: email,
      phone: body.phone || null,
      job_title: body.jobTitle,
      department_id: body.departmentId || null,
      manager_id: body.managerId || null,
      employment_type: body.employmentType ?? "full_time",
      status: "invited",
      joining_date: body.joiningDate || null,
      approval_limit: Number(body.approvalLimit ?? 0),
      requires_mfa: true,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });
    await ctx.supabaseAdmin.from("admin_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invitation.id);
    await ctx.supabaseAdmin.from("audit_events").insert({
      actor_id: user.id, event_type: "employee_invited", entity_type: "admin_invitation", entity_id: invitation.id,
      source: "admin", metadata: { email, role: body.role },
    });
    return response({ ok: true, invitationId: invitation.id });
  }),
};
