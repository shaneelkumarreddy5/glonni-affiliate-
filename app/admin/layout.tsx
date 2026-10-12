import { Suspense } from "react";
import { AdminInteractionFeedback } from "@/components/admin-interaction-feedback";
import { AdminTablePan } from "@/components/admin-table-pan";
import { AdminTableFilter } from "@/components/admin-table-filter";
import { AdminIdentityProvider } from "@/components/admin-identity";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle() : { data: null };
  const identity = { name: profile?.display_name || 'Account', role: profile?.role || '' };
  return <AdminIdentityProvider identity={identity}><Suspense fallback={null}><AdminInteractionFeedback /></Suspense><AdminTablePan /><AdminTableFilter />{children}</AdminIdentityProvider>;
}
