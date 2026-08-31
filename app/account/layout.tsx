import { redirect } from 'next/navigation';
import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const displayName = String(user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Customer');
  return <><aside className="customer-session" aria-label="Signed-in customer"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><b>{displayName}</b><small>{user.email}</small></div><form action={signOut}><button type="submit">Sign out</button></form></aside>{children}</>;
}
