import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type InviteBody = {
  mode?: "employee" | "complete_onboarding" | "owner_setup" | "employee_setup" | "employee_security" | "update_employee" | "revoke_sessions" | "reset_mfa" | "revoke_invitation";
  email?: string;
  token?: string;
  password?: string;
  employeeId?: string;
  invitationId?: string;
  displayName?: string;
  role?: "editor" | "admin" | "owner";
  status?: "invited" | "active" | "suspended" | "departed";
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

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
    const body = (await req.json()) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const siteUrl = "https://glonni-affiliate.vercel.app";

    if (body.mode === "owner_setup" || body.mode === "employee_setup") {
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
        .select("id, profile_id, purpose, invitation_id")
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!setupToken) return response({ error: "This setup link is invalid, expired or already used." }, 403);

      const [{ data: setupProfile }, { data: setupEmployee }] = await Promise.all([
        ctx.supabaseAdmin.from("profiles").select("role").eq("id", setupToken.profile_id).single(),
        ctx.supabaseAdmin.from("employees").select("status").eq("profile_id", setupToken.profile_id).single(),
      ]);
      const ownerSetup = body.mode === "owner_setup";
      if (!setupEmployee || !["invited", "active"].includes(setupEmployee.status)) {
        return response({ error: "This setup link is not authorized for an active admin account." }, 403);
      }
      if (ownerSetup && (setupProfile?.role !== "owner" || !["initial_password", "password_reset"].includes(setupToken.purpose))) {
        return response({ error: "This setup link is not authorized for the Owner account." }, 403);
      }
      if (!ownerSetup && setupToken.purpose !== "employee_invitation") {
        return response({ error: "This employee invitation is invalid." }, 403);
      }

      const { error: passwordError } = await ctx.supabaseAdmin.auth.admin.updateUserById(setupToken.profile_id, {
        password,
        email_confirm: true,
      });
      if (passwordError) return response({ error: "The Owner password could not be saved." }, 400);

      await ctx.supabaseAdmin.from("admin_setup_tokens").update({ used_at: new Date().toISOString() }).eq("id", setupToken.id).is("used_at", null);
      await ctx.supabaseAdmin.from("audit_events").insert({
        actor_id: setupToken.profile_id,
        event_type: ownerSetup ? (setupToken.purpose === "initial_password" ? "owner_password_initialized" : "owner_password_reset") : "employee_password_initialized",
        entity_type: "employee",
        entity_id: setupToken.profile_id,
        source: "admin",
        metadata: { method: "one_time_setup_token" },
      });
      return response({ ok: true, message: `${ownerSetup ? "Owner" : "Employee"} password saved. Sign in to complete 2FA.` });
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
      await ctx.supabaseAdmin.from("employees").update({ status: "active", mfa_enrolled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("profile_id", user.id);
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("email", user.email).in("status", ["pending", "sent"]);
      await ctx.supabaseAdmin.from("audit_events").insert({
        actor_id: user.id, event_type: "admin_onboarding_completed", entity_type: "employee", entity_id: user.id,
        source: "admin", metadata: { aal: "aal2" },
      });
      return response({ ok: true, message: "Admin onboarding completed." });
    }

    if (!["owner", "admin"].includes(profile.role)) return response({ error: "You do not have permission to invite employees." }, 403);

    const targetId = body.employeeId?.trim();
    if (["employee_security", "update_employee", "revoke_sessions", "reset_mfa"].includes(body.mode ?? "")) {
      if (!targetId) return response({ error: "Select a valid employee." }, 400);
      const [{ data: targetProfile }, { data: targetEmployee }, targetAuth] = await Promise.all([
        ctx.supabaseAdmin.from("profiles").select("id, display_name, role").eq("id", targetId).single(),
        ctx.supabaseAdmin.from("employees").select("*").eq("profile_id", targetId).single(),
        ctx.supabaseAdmin.auth.admin.getUserById(targetId),
      ]);
      if (!targetProfile || !targetEmployee || !targetAuth.data.user) return response({ error: "Employee record not found." }, 404);
      const assignedRole = targetEmployee.assigned_role ?? targetProfile.role;
      if (assignedRole === "owner" && profile.role !== "owner") return response({ error: "Only the Owner can manage an Owner account." }, 403);

      if (body.mode === "employee_security") {
        const factors = await ctx.supabaseAdmin.auth.admin.mfa.listFactors({ userId: targetId });
        const verified = factors.data?.factors?.filter((factor) => factor.status === "verified") ?? [];
        return response({
          ok: true,
          security: {
            emailConfirmed: Boolean(targetAuth.data.user.email_confirmed_at),
            lastSignInAt: targetAuth.data.user.last_sign_in_at ?? null,
            mfaVerified: verified.length > 0,
            mfaFactorCount: verified.length,
          },
        });
      }

      if (body.mode === "update_employee") {
        const nextRole = body.role ?? assignedRole;
        const nextStatus = body.status ?? targetEmployee.status;
        if (!["owner", "admin", "editor"].includes(nextRole)) return response({ error: "Choose a valid admin role." }, 400);
        if (!["invited", "active", "suspended", "departed"].includes(nextStatus)) return response({ error: "Choose a valid employment status." }, 400);
        if (nextRole === "owner" && profile.role !== "owner") return response({ error: "Only the Owner can grant Owner access." }, 403);
        if (targetId === user.id && (nextStatus === "suspended" || nextStatus === "departed")) return response({ error: "You cannot revoke your own active Owner access." }, 400);

        const accessEnabled = nextStatus === "active" || nextStatus === "invited";
        const effectiveRole = accessEnabled ? nextRole : "customer";
        const now = new Date().toISOString();
        const employeeChanges = {
          phone: body.phone || null,
          job_title: body.jobTitle || targetEmployee.job_title,
          department_id: body.departmentId || null,
          manager_id: body.managerId || null,
          employment_type: body.employmentType ?? targetEmployee.employment_type,
          status: nextStatus,
          joining_date: body.joiningDate || null,
          termination_date: nextStatus === "departed" ? new Date().toISOString().slice(0, 10) : null,
          approval_limit: Math.max(0, Number(body.approvalLimit ?? targetEmployee.approval_limit ?? 0)),
          assigned_role: nextRole,
          last_access_changed_at: now,
          last_access_changed_by: user.id,
          updated_at: now,
        };
        const [profileUpdate, employeeUpdate, authUpdate] = await Promise.all([
          ctx.supabaseAdmin.from("profiles").update({ display_name: body.displayName || targetProfile.display_name, role: effectiveRole, updated_at: now }).eq("id", targetId),
          ctx.supabaseAdmin.from("employees").update(employeeChanges).eq("profile_id", targetId),
          ctx.supabaseAdmin.auth.admin.updateUserById(targetId, {
            app_metadata: { ...targetAuth.data.user.app_metadata, admin_role: accessEnabled ? nextRole : "disabled", employee: accessEnabled },
            user_metadata: { ...targetAuth.data.user.user_metadata, display_name: body.displayName || targetProfile.display_name },
          }),
        ]);
        const updateError = profileUpdate.error || employeeUpdate.error || authUpdate.error;
        if (updateError) return response({ error: updateError.message }, 400);
        if (!accessEnabled) await ctx.supabaseAdmin.rpc("admin_revoke_user_sessions", { target_user_id: targetId });
        await ctx.supabaseAdmin.from("audit_events").insert({
          actor_id: user.id, event_type: "employee_access_updated", entity_type: "employee", entity_id: targetId,
          source: "admin", metadata: { role: nextRole, status: nextStatus, approval_limit: employeeChanges.approval_limit },
        });
        return response({ ok: true, message: "Employee record and access rules updated." });
      }

      if (body.mode === "revoke_sessions") {
        if (targetId === user.id) return response({ error: "Use Sign Out to end your own session." }, 400);
        const { data: removed, error: revokeError } = await ctx.supabaseAdmin.rpc("admin_revoke_user_sessions", { target_user_id: targetId });
        if (revokeError) return response({ error: revokeError.message }, 400);
        await ctx.supabaseAdmin.from("audit_events").insert({ actor_id: user.id, event_type: "employee_sessions_revoked", entity_type: "employee", entity_id: targetId, source: "admin", metadata: { sessions_removed: removed ?? 0 } });
        return response({ ok: true, message: "All employee sessions were revoked." });
      }

      if (body.mode === "reset_mfa") {
        if (targetId === user.id) return response({ error: "Another Owner must reset your 2FA to prevent lockout." }, 400);
        const factors = await ctx.supabaseAdmin.auth.admin.mfa.listFactors({ userId: targetId });
        for (const factor of factors.data?.factors ?? []) {
          const deleted = await ctx.supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: targetId, id: factor.id });
          if (deleted.error) return response({ error: deleted.error.message }, 400);
        }
        await Promise.all([
          ctx.supabaseAdmin.from("employees").update({ mfa_enrolled_at: null, updated_at: new Date().toISOString() }).eq("profile_id", targetId),
          ctx.supabaseAdmin.rpc("admin_revoke_user_sessions", { target_user_id: targetId }),
        ]);
        await ctx.supabaseAdmin.from("audit_events").insert({ actor_id: user.id, event_type: "employee_mfa_reset", entity_type: "employee", entity_id: targetId, source: "admin", metadata: {} });
        return response({ ok: true, message: "2FA was reset. The employee must enroll again at the next login." });
      }
    }

    if (body.mode === "revoke_invitation") {
      if (!body.invitationId) return response({ error: "Select a valid invitation." }, 400);
      const { data: invitation } = await ctx.supabaseAdmin.from("admin_invitations").select("id, email, status").eq("id", body.invitationId).single();
      if (!invitation || !["pending", "sent", "failed"].includes(invitation.status)) return response({ error: "This invitation can no longer be revoked." }, 400);
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "revoked" }).eq("id", invitation.id);
      await ctx.supabaseAdmin.from("audit_events").insert({ actor_id: user.id, event_type: "employee_invitation_revoked", entity_type: "admin_invitation", entity_id: invitation.id, source: "admin", metadata: { email: invitation.email } });
      return response({ ok: true, message: "Invitation revoked." });
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

    const temporaryPassword = `${randomToken()}Aa!1`;
    const { data: inviteData, error: inviteError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: body.displayName },
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
      assigned_role: body.role,
      requires_mfa: true,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });
    const setupToken = randomToken();
    const setupTokenHash = await sha256(setupToken);
    const { error: setupError } = await ctx.supabaseAdmin.from("admin_setup_tokens").insert({
      profile_id: invitedUser.id,
      invitation_id: invitation.id,
      purpose: "employee_invitation",
      token_hash: setupTokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id,
    });
    if (setupError) {
      await ctx.supabaseAdmin.from("admin_invitations").update({ status: "failed" }).eq("id", invitation.id);
      return response({ error: "The employee record was created, but its private setup link could not be issued." }, 400);
    }
    await ctx.supabaseAdmin.from("admin_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invitation.id);
    await ctx.supabaseAdmin.from("audit_events").insert({
      actor_id: user.id, event_type: "employee_invited", entity_type: "admin_invitation", entity_id: invitation.id,
      source: "admin", metadata: { email, role: body.role },
    });
    return response({ ok: true, invitationId: invitation.id, setupUrl: `${siteUrl}/admin/accept-invitation#token=${setupToken}` });
  }),
};
