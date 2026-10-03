import Link from 'next/link';
import { ArrowRight, Banknote, Cable, CheckCircle2, CircleAlert, CreditCard, FileText, Gift, PlugZap, ReceiptText, ShieldCheck, Smartphone, Ticket } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { BILL_SERVICES, CommerceVisibility, getCommerceVisibility, VOUCHER_CATEGORIES } from '@/lib/commerce';
import { getCatalogOffers } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';
import { setCommerceVisibility } from './actions';
import styles from './vouchers-bills.module.css';

export const dynamic = 'force-dynamic';

const tabs = [
  ['overview', 'Overview'], ['coupons', 'Merchant Coupons'], ['vouchers', 'Buy Coupons'],
  ['bills', 'Bill Services'], ['providers', 'Providers & APIs'], ['transactions', 'Transactions'],
] as const;
const billIcons = { mobile_recharge: Smartphone, dth: Cable, electricity: PlugZap, gas: Banknote, water: ReceiptText, fastag: CreditCard };

function ProviderState({ title, detail }: { title: string; detail: string }) {
  return <article className={styles.providerState}><span className={styles.providerIcon}><Cable size={19}/></span><div><b>{title}</b><small>{detail}</small></div><span className={styles.notConnected}><i/>Not connected</span></article>;
}

function VisibilitySwitch({ scope, settingKey, checked, returnTab, disabled, label }: { scope: 'section' | 'bill' | 'voucher'; settingKey: string; checked: boolean; returnTab: string; disabled: boolean; label: string }) {
  return <form action={setCommerceVisibility} className={styles.toggleForm}>
    <input type="hidden" name="scope" value={scope}/><input type="hidden" name="key" value={settingKey}/><input type="hidden" name="enabled" value={String(!checked)}/><input type="hidden" name="returnTab" value={returnTab}/>
    <span className={checked ? styles.onBadge : styles.offBadge}>{checked ? 'Shown' : 'Hidden'}</span>
    <button type="submit" role="switch" aria-label={`${label} visibility`} aria-checked={checked} title={`${checked ? 'Hide' : 'Show'} ${label} on the customer page`} className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`} disabled={disabled}><span/></button>
  </form>;
}

function MasterControls({ settings, disabled, returnTab }: { settings: CommerceVisibility; disabled: boolean; returnTab: string }) {
  const controls = [
    { key: 'coupons', label: 'Coupons', detail: 'Merchant coupon codes from approved offers', icon: Ticket, on: settings.coupons_enabled },
    { key: 'buy_coupons', label: 'Buy Coupons', detail: 'Provider-supplied vouchers bought on Glonni', icon: Gift, on: settings.buy_coupons_enabled },
    { key: 'bill_payments', label: 'Bill Payments', detail: 'Recharge and bill service categories', icon: ReceiptText, on: settings.bill_payments_enabled },
  ];
  return <section className={styles.masterPanel} aria-labelledby="customer-visibility-title"><div className={styles.masterHeading}><h2 id="customer-visibility-title">Customer page visibility</h2><p>Switch a tab off to remove it from the customer page. This does not delete offers or transaction history.</p></div><div className={styles.masterGrid}>{controls.map(({ key, label, detail, icon: Icon, on }) => <article className={styles.masterCard} key={key}><span className={styles.masterIcon}><Icon size={20}/></span><div><b>{label}</b><small>{detail}</small>{key !== 'coupons' && <em>Provider setup required for transactions</em>}</div><VisibilitySwitch scope="section" settingKey={key} checked={on} returnTab={returnTab} disabled={disabled} label={label}/></article>)}</div></section>;
}

export default async function VouchersBillsPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string }> }) {
  const query = await searchParams;
  const requested = query.tab ?? 'overview';
  const activeTab = tabs.some(([id]) => id === requested) ? requested : 'overview';
  const supabase = await createClient();
  const [{ settings, connected }, { data: { user } }, { data: assurance }, offers, voucherResult] = await Promise.all([
    getCommerceVisibility(), supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    getCatalogOffers(), supabase.from('voucher_catalog_items').select('id', { count: 'exact', head: true }),
  ]);
  const [{ data: profile }, { data: employee }] = user ? await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const canManage = !!connected && !!profile && ['owner', 'admin'].includes(profile.role) && employee?.status === 'active' && assurance?.currentLevel === 'aal2';
  const couponCount = offers.filter((offer) => offer.reward_type === 'coupon' && offer.coupon_code?.trim()).length;
  const voucherCount = voucherResult.count ?? 0;

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><header className="admin-top"><Gift size={21}/><b>Vouchers &amp; Bills</b><span className="dashboard-date">Customer commerce controls</span><span className="avatar">SR</span></header><main className={`admin-content ${styles.page}`}>
    <div className="admin-title"><div><p>PARTNERS &amp; GROWTH</p><h1>Vouchers &amp; Bill Payments</h1><span>Control customer tabs and categories while keeping merchant codes, buyable vouchers, and bill services separate.</span></div><Link className="add-store" href="/admin/integrations"><PlugZap size={16}/> API Integrations</Link></div>
    {!connected && <div className={styles.setupNotice} role="alert"><CircleAlert size={20}/><div><b>Visibility settings unavailable</b><p>Apply the commerce visibility database migration before using these controls. Buy Coupons and Bill Payments remain hidden until settings can be read.</p></div></div>}
    {connected && !canManage && <div className={styles.setupNotice} role="status"><ShieldCheck size={20}/><div><b>Read-only access</b><p>An active Owner or Admin with two-step verification is required to change customer visibility.</p></div></div>}
    {query.notice && <p className={query.notice === 'saved' ? styles.saveSuccess : styles.saveError} role="status">{query.notice === 'saved' ? 'Customer visibility updated.' : query.notice === 'denied' ? 'Owner or Admin access with two-step verification is required.' : 'The setting could not be saved. Check the database connection and try again.'}</p>}
    <MasterControls settings={settings} disabled={!canManage} returnTab={activeTab}/>
    <nav className={styles.tabs} aria-label="Vouchers and bills sections">{tabs.map(([id, label]) => <Link key={id} href={`/admin/vouchers-bills?tab=${id}`} className={activeTab === id ? styles.activeTab : ''} aria-current={activeTab === id ? 'page' : undefined}>{label}</Link>)}</nav>

    {activeTab === 'overview' && <><section className={styles.statusGrid} aria-label="Provider setup status"><ProviderState title="Voucher supplier" detail="Required for Buy Coupons, not merchant coupon codes"/><ProviderState title="Bill-payment partner" detail="Biller and recharge coverage"/><ProviderState title="Payment route" detail="Checkout, settlement, and refunds"/></section><section className={styles.catalogueGrid}>
      <article className={styles.cataloguePanel}><header><span className={styles.panelIcon}><Ticket size={20}/></span><div><h2>Merchant Coupons</h2><p>Codes from published, approved offers—not paid vouchers.</p></div></header><p className={styles.panelBody}>{couponCount} live coupon {couponCount === 1 ? 'offer' : 'offers'}</p><div className={styles.panelFoot}><span>Manage codes and terms in Offers &amp; Rewards.</span><Link href="/admin/vouchers-bills?tab=coupons">Open coupons <ArrowRight size={15}/></Link></div></article>
      <article className={styles.cataloguePanel}><header><span className={styles.panelIcon}><Gift size={20}/></span><div><h2>Buy Coupons</h2><p>Provider-neutral voucher catalogue, separate from physical products.</p></div></header><p className={styles.panelBody}>{voucherCount} imported voucher {voucherCount === 1 ? 'item' : 'items'}</p><div className={styles.panelFoot}><span>Purchasing remains unavailable without a fulfilment provider and payment route.</span><Link href="/admin/vouchers-bills?tab=vouchers">Open catalogue <ArrowRight size={15}/></Link></div></article>
    </section><section className={styles.bottomGrid}><article className={styles.simplePanel}><header><ShieldCheck size={19}/><h2>Safe launch order</h2></header><ol><li>Connect and verify approved provider APIs.</li><li>Import real voucher or biller data with availability and terms.</li><li>Test payment, fulfilment, status checks, and refunds end to end.</li><li>Then enable the relevant customer services.</li></ol></article><article className={styles.simplePanel}><header><ReceiptText size={19}/><h2>Transactions</h2></header><p>Voucher purchases and bill payments will be logged here once the payment and fulfilment workflows are connected.</p><Link href="/admin/vouchers-bills?tab=transactions">View workspace <ArrowRight size={15}/></Link></article></section></>}

    {activeTab === 'coupons' && <section className={styles.detailPanel}><header><span className={styles.panelIcon}><Ticket size={20}/></span><div><h2>Merchant Coupons</h2><p>These are coupon codes attached to approved store offers. No voucher supplier is needed for this tab.</p></div></header><div className={styles.detailSummary}><strong>{couponCount}</strong><span>published coupon {couponCount === 1 ? 'offer' : 'offers'} visible when the Coupons tab is on</span></div><Link className={styles.primaryLink} href="/admin/offers?tab=rules#offers-table">Manage coupon offers <ArrowRight size={16}/></Link></section>}

    {activeTab === 'vouchers' && <section className={styles.detailPanel}><header><span className={styles.panelIcon}><Gift size={20}/></span><div><h2>Buy Coupons</h2><p>Control voucher categories. Real products can be imported from any approved provider using its own adapter.</p></div></header><div className={styles.controlList}>{VOUCHER_CATEGORIES.map((category) => <article key={category.key}><span className={styles.controlIcon}><Gift size={18}/></span><div><b>{category.label}</b><small>Show this category when voucher offers are available</small></div><VisibilitySwitch scope="voucher" settingKey={category.key} checked={settings.voucher_categories[category.key]} returnTab="vouchers" disabled={!canManage} label={`${category.label} vouchers`}/></article>)}</div><div className={styles.emptySource}><Gift size={24}/><b>{voucherCount ? `${voucherCount} voucher catalogue items` : 'No voucher offers are connected'}</b><p>A provider must supply actual brands, denominations, prices, validity, and redemption terms. Customer checkout will remain unavailable until payment and fulfilment are integrated and tested.</p><Link href="/admin/vouchers-bills?tab=providers">Review provider setup <ArrowRight size={15}/></Link></div></section>}

    {activeTab === 'bills' && <section className={styles.detailPanel}><header><span className={`${styles.panelIcon} ${styles.billIcon}`}><ReceiptText size={20}/></span><div><h2>Bill service controls</h2><p>Show or hide each service individually on the customer page. Visibility does not activate payments.</p></div></header><div className={styles.controlList}>{BILL_SERVICES.map((service) => { const Icon = billIcons[service.key]; return <article key={service.key}><span className={styles.controlIcon}><Icon size={18}/></span><div><b>{service.label}</b><small>Payment unavailable until a verified partner supports this service</small></div><VisibilitySwitch scope="bill" settingKey={service.key} checked={settings.bill_services[service.key]} returnTab="bills" disabled={!canManage} label={service.label}/></article>; })}</div><div className={styles.caution}><ShieldCheck size={18}/><p>Bill payments require approved partner coverage, secure customer fields, payment confirmation, and tested refunds before any payment action can be enabled.</p></div></section>}

    {activeTab === 'providers' && <section className={styles.detailPanel}><header><span className={styles.panelIcon}><Cable size={20}/></span><div><h2>Providers &amp; APIs</h2><p>Separate voucher supply, biller coverage, and payment processing. No provider is hard-coded.</p></div></header><div className={styles.providerList}><ProviderState title="Voucher supplier" detail="Buy Coupons catalogue, fulfilment, and reversals"/><ProviderState title="Bill-pay / recharge partner" detail="Biller discovery, bill fetch, payment, and status"/><ProviderState title="Payment route" detail="Customer payment, settlement, and refunds"/></div><div className={styles.providerSecurity}><ShieldCheck size={18}/><span>API credentials belong server-side. Provider setup is incomplete, so purchases and bill payments cannot be submitted.</span><Link href="/admin/integrations">Open API Integrations <ArrowRight size={15}/></Link></div></section>}

    {activeTab === 'transactions' && <section className={styles.detailPanel}><header><span className={styles.panelIcon}><FileText size={20}/></span><div><h2>Transactions</h2><p>One audit trail for future voucher fulfilment and bill-payment status updates.</p></div></header><div className={styles.transactionColumns}><span>TYPE</span><span>CUSTOMER</span><span>AMOUNT</span><span>PROVIDER REFERENCE</span><span>STATUS</span><span>UPDATED</span></div><div className={styles.emptyTransactions}><CheckCircle2 size={27}/><b>No transactions yet</b><p>Real purchase and payment records will appear only after approved providers and customer checkout are connected.</p></div></section>}
  </main></section></main>;
}
