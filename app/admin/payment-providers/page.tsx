import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, Banknote, Bell, Cable, CheckCircle2, CircleAlert, CreditCard, Gift, Plus, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { addPaymentProvider, setPaymentProviderEnabled } from './actions';
import styles from './payment-providers.module.css';

export const dynamic = 'force-dynamic';

type Provider = {
  id: string;
  name: string;
  provider_key: string;
  services: string[];
  priority: number;
  enabled: boolean;
  adapter_status: string;
  credential_status: string;
  last_health_check_at: string | null;
  last_health_check_status: string;
};

const serviceLabel: Record<string, string> = {
  voucher_purchase: 'Voucher purchases',
  bill_payment: 'Bill payments',
};
const formatLabel = (value: string) => value.replaceAll('_', ' ');
const canRoute = (provider: Provider) => provider.adapter_status === 'live_ready'
  && provider.credential_status === 'live_verified'
  && provider.last_health_check_status === 'healthy';

export default async function PaymentProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }, { data: providersData, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.from('payment_provider_configs').select('*').order('priority').order('created_at'),
  ]);
  const [{ data: profile }, { data: employee }] = user ? await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const canManage = !!user && assurance?.currentLevel === 'aal2'
    && !!profile && ['owner', 'admin'].includes(profile.role)
    && employee?.status === 'active';
  const providers = (providersData ?? []) as Provider[];
  const active = providers.filter((provider) => provider.enabled).length;
  const healthy = providers.filter(canRoute).length;

  const messages: Record<string, string> = {
    added: 'Provider added. Add a server-side adapter and verify live credentials before enabling checkout.',
    disabled: 'Provider disabled for new checkout attempts.',
    enabled: 'Provider enabled.',
    invalid: 'Check the provider name, services, and priority.',
    save_failed: 'Provider could not be saved. Check that the payment-provider database migration is applied and the provider key is unique.',
  };
  const notice = query.notice ? messages[query.notice] ?? 'Provider could not be updated. Live-ready adapter, verified credentials, and a healthy check are required before activation.' : null;

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><CreditCard size={21}/><b>Payment Providers</b><span className="dashboard-date">Customer checkout · vouchers and bill payments</span><Bell size={19}/><span className="avatar">SR</span></header>
    <main className={`admin-content ${styles.page}`}>
      <div className="admin-title"><div><p>OPERATIONS · PAYMENTS</p><h1>Payment Providers</h1><span>Manage payment gateways for customer voucher purchases and bill payments.</span></div></div>
      {notice && <p className={query.notice === 'added' || query.notice === 'disabled' || query.notice === 'enabled' ? styles.success : styles.notice} role="status">{notice}</p>}
      {!canManage && <div className={styles.notice}><ShieldCheck size={18}/><span>Read-only. An active Owner or Admin with two-step verification is required to manage providers.</span></div>}
      {error && <div className={styles.notice}><CircleAlert size={18}/><span>Payment provider registry is not available yet. Apply the database migration before using this page.</span></div>}

      <section className={styles.stats}>
        <article><span className={styles.statIcon}><Cable size={19}/></span><div><small>Providers added</small><b>{providers.length}</b><em>Across both checkout services</em></div></article>
        <article><span className={styles.statIcon}><Activity size={19}/></span><div><small>Live-ready</small><b>{healthy}</b><em>Adapter, credentials, and health verified</em></div></article>
        <article><span className={styles.statIcon}><CheckCircle2 size={19}/></span><div><small>Enabled for checkout</small><b>{active}</b><em>Eligible to receive new payment attempts</em></div></article>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHead}><div><h2>Provider routing</h2><p>Glonni tries the enabled, healthy provider with the lowest priority number first. Keep at least one verified fallback for each service.</p></div><span className={styles.routeBadge}><Activity size={15}/>{active ? 'Routing controlled by readiness' : 'No live payment route'}</span></header>
        <div className={styles.tableWrap}><table><thead><tr><th>PROVIDER</th><th>SERVICES</th><th>PRIORITY</th><th>INTEGRATION</th><th>HEALTH</th><th>CHECKOUT</th></tr></thead>
          <tbody>{providers.map((provider) => {
            const ready = canRoute(provider);
            return <tr key={provider.id}>
              <td><strong>{provider.name}</strong><small>{provider.provider_key}</small></td>
              <td><div className={styles.chips}>{provider.services.map((service) => <span key={service}>{serviceLabel[service] ?? service}</span>)}</div></td>
              <td>{provider.priority}</td>
              <td><span className={ready ? styles.good : styles.pending}><i/>{ready ? 'Live ready' : formatLabel(provider.adapter_status)}</span><small className={styles.subStatus}>Credentials: {formatLabel(provider.credential_status)}</small></td>
              <td><span className={provider.last_health_check_status === 'healthy' ? styles.good : styles.pending}><i/>{formatLabel(provider.last_health_check_status)}</span></td>
              <td>{canManage ? <form action={setPaymentProviderEnabled} className={styles.toggleForm}>
                <input type="hidden" name="id" value={provider.id}/>
                <input type="hidden" name="enabled" value={String(!provider.enabled)}/>
                <button type="submit" role="switch" aria-checked={provider.enabled} aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name}`} disabled={!provider.enabled && !ready} className={`${styles.toggle} ${provider.enabled ? styles.toggleOn : ''}`} title={!provider.enabled && !ready ? 'Complete adapter, live credentials, and health verification first' : undefined}><span/></button>
                <small>{provider.enabled ? 'Enabled' : ready ? 'Disabled' : 'Not ready'}</small>
              </form> : <span>{provider.enabled ? 'Enabled' : 'Disabled'}</span>}</td>
            </tr>;
          })}</tbody></table>
          {!providers.length && <div className={styles.empty}><span><WalletCards size={21}/></span><b>No payment providers added</b><p>Add a provider below. Its checkout toggle stays locked until a live adapter, credentials, and health check are verified.</p></div>}
        </div>
        <footer className={styles.tableFoot}><ShieldCheck size={15}/>Provider secrets are never stored in this registry or exposed to the browser.</footer>
      </section>

      <section className={styles.lowerGrid}>
        <form action={addPaymentProvider} className={styles.addPanel}>
          <div className={styles.addHeader}><span><Plus size={18}/></span><div><h2>Add a payment provider</h2><p>Create a provider entry for the adapter you will connect.</p></div></div>
          <label>Provider name<input name="name" placeholder="e.g. Pine Labs" required minLength={2} maxLength={100}/></label>
          <label>Provider key<input name="providerKey" placeholder="e.g. pine-labs (optional)" maxLength={80}/><small>Used internally to map the provider adapter.</small></label>
          <fieldset><legend>Services this provider handles</legend><label><input type="checkbox" name="services" value="voucher_purchase"/> Voucher purchases</label><label><input type="checkbox" name="services" value="bill_payment"/> Bill payments</label></fieldset>
          <label>Routing priority<input type="number" name="priority" defaultValue={100} min={1} max={9999}/><small>Lower numbers are tried first when providers are eligible.</small></label>
          <button className={styles.submit} type="submit" disabled={!canManage}>Add provider</button>
        </form>
        <aside className={styles.workflow}>
          <h2>Activation checklist</h2>
          <p><span>1</span><b>Add provider</b><small>Choose vouchers, bill payments, or both.</small></p>
          <p><span>2</span><b>Connect adapter and secrets</b><small>Implement the provider server-side; keep keys in deployment secrets.</small></p>
          <p><span>3</span><b>Verify sandbox and live health</b><small>Confirm payment creation, callback signature, status updates, and refunds.</small></p>
          <p><span>4</span><b>Enable checkout</b><small>The toggle becomes available only after all live checks pass.</small></p>
          <div className={styles.caution}><CircleAlert size={16}/><span>Adding a provider here does not itself accept money. No payment gateway adapter is connected yet.</span></div>
        </aside>
      </section>
    </main>
  </section></main>;
}
