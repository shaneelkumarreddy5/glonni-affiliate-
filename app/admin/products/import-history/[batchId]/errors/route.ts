import { createClient } from "@/lib/supabase/server";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const [{ data: auth }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!auth.user) return new Response("Unauthorized", { status: 401 });
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
    supabase.from("employees").select("status").eq("profile_id", auth.user.id).single(),
  ]);
  if (!profile || !["owner", "admin"].includes(profile.role) || employee?.status !== "active" || assurance?.currentLevel !== "aal2")
    return new Response("Forbidden", { status: 403 });
  const { data: batch } = await supabase.from("import_batches").select("source_label").eq("id", batchId).single();
  if (!batch) return new Response("Import batch not found", { status: 404 });
  const { data, error } = await supabase.from("import_batch_rows").select("row_number,status,raw_data,validation_errors").eq("batch_id", batchId).in("status", ["invalid", "duplicate"]).order("row_number");
  if (error) return new Response(error.message, { status: 500 });
  const headers = ["row_number", "status", "title", "brand", "category", "store", "product_url", "price", "errors"];
  const rows = (data ?? []).map((row) => {
    const raw = (row.raw_data ?? {}) as Record<string, unknown>;
    return [row.row_number, row.status, raw.title, raw.brand, raw.category, raw.store, raw.product_url, raw.price, (row.validation_errors ?? []).join("; ")].map(csv).join(",");
  });
  const filename = batch.source_label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "import";
  return new Response([headers.join(","), ...rows].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}-errors.csv"`, "Cache-Control": "no-store" } });
}
