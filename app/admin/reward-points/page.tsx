import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { configurePointsOffer, decidePointAward, issuePointAward } from './actions';
import './reward-points.css';

export const dynamic = 'force-dynamic';
type DraftOffer = { id: string; reward_type: string; reward_points: number | null; reward_terms: string | null; cashback_confirmation_days: number | null; reward_funding_source: string; products: { title: string } | null; merchants: { name: string } | null };
type Conversion = { id: string; status: string; reward_type_snapshot: string | null; reward_points_snapshot: number | null; created_at: string; merchants: { name: string } | null };
type Award = { id: string; points: number; status: string; available_at: string; created_at: string; referral_conversions: { merchants: { name: string } | null } | null };

export default async function RewardPointsAdmin({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') redirect('/admin');
  const [{ data: draftData }, { data: conversionData }, { data: awardData, error: awardError }] = await Promise.all([
    supabase.from('offers').select('id,reward_type,reward_points,reward_terms,cashback_confirmation_days,reward_funding_source,products(title),merchants(name)').eq('status', 'draft').order('created_at', { ascending: false }).limit(100),
    supabase.from('referral_conversions').select('id,status,reward_type_snapshot,reward_points_snapshot,created_at,merchants(name)').eq('status', 'confirmed').eq('match_status', 'matched').eq('financial_validation_status', 'approved').eq('reward_type_snapshot', 'points').order('created_at', { ascending: false }).limit(100),
    supabase.from('reward_point_awards').select('id,conversion_id,points,status,available_at,created_at,referral_conversions(merchants(name))').order('created_at', { ascending: false }).limit(100),
  ]);
  const drafts = (draftData ?? []) as unknown as DraftOffer[];
  const awards = (awardData ?? []) as unknown as Award[];
  const awardConversionIds = new Set((awardData ?? []).map(item => item.conversion_id));
  const conversions = ((conversionData ?? []) as unknown as Conversion[]).filter(item => !awardConversionIds.has(item.id));
  const params = await searchParams;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content reward-admin">
    <header><p>WALLET OPERATIONS</p><h1>Reward points</h1><span>Configure non-withdrawable points on draft offers and review provider-confirmed point awards.</span><Link href="/admin/wallet">← Wallets &amp; Payouts</Link></header>
    {params.success && <p className="reward-admin-success" role="status">{params.success}</p>}
    {awardError && <p className="reward-admin-warning" role="alert">The rewards database migration is not active yet. Point awards cannot be reviewed until it is applied.</p>}
    <section><h2>Configure an offer</h2><p>Choose a draft offer only. The rule will need the normal offer review before it becomes visible to customers.</p><form action={configurePointsOffer} className="reward-admin-form"><label>Draft offer<select name="offerId" required><option value="">Select a draft offer</option>{drafts.map(item => <option key={item.id} value={item.id}>{item.products?.title || 'Product'} · {item.merchants?.name || 'Store'}{item.reward_type === 'points' ? ` · ${item.reward_points} points` : ''}</option>)}</select></label><label>Points per eligible order<input name="points" type="number" min="1" step="1" required/></label><label>Confirmation days<input name="confirmationDays" type="number" min="0" max="365" defaultValue="45" required/></label><label>Funding source<select name="fundingSource"><option value="provider">Affiliate provider</option><option value="merchant">Merchant</option><option value="glonni">Glonni</option></select></label><label className="wide">Approved points terms<textarea name="terms" minLength={20} required placeholder="Eligibility, exclusions, cancellations, and any points expiry"/></label><button>Save points rule on draft</button></form></section>
    <section><h2>Eligible conversions</h2><p>Only matched, financially approved, provider-confirmed points purchases can receive an award.</p><div className="reward-admin-list">{conversions.map(item => <div key={item.id}><span><b>{item.merchants?.name || 'Store'}</b><small>{new Date(item.created_at).toLocaleDateString('en-IN')} · {item.id.slice(0, 8)}</small></span><strong>{item.reward_points_snapshot || 0} points</strong><form action={issuePointAward}><input type="hidden" name="conversionId" value={item.id}/><button>Issue pending award</button></form></div>)}{!conversions.length && <p>No eligible points conversions yet.</p>}</div></section>
    <section><h2>Point award review</h2><div className="reward-admin-list">{awards.map(item => <div key={item.id}><span><b>{item.referral_conversions?.merchants?.name || 'Store'}</b><small>{item.status} · Ready {new Date(item.available_at).toLocaleDateString('en-IN')}</small></span><strong>{item.points} points</strong>{['pending','held','confirmed'].includes(item.status) && <form action={decidePointAward}><input type="hidden" name="awardId" value={item.id}/><input name="note" placeholder="Reason for hold, reject or reversal"/><select name="decision" aria-label="Decision" defaultValue="confirm">{item.status !== 'confirmed' ? <><option value="confirm">Confirm</option><option value="hold">Hold</option><option value="reject">Reject</option></> : <option value="reverse">Reverse</option>}</select><button>Apply</button></form>}</div>)}{!awards.length && <p>No point awards yet.</p>}</div></section>
  </main></section></main>;
}
