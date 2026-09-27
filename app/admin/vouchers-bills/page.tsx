import Link from 'next/link';
import {
  ArrowRight, Banknote, Cable, CheckCircle2, CircleAlert, CreditCard,
  FileText, Gift, PlugZap, ReceiptText, ShieldCheck, Smartphone, Ticket,
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import styles from './vouchers-bills.module.css';

export const dynamic = 'force-dynamic';

const tabs = [
  ['overview', 'Overview'],
  ['vouchers', 'Voucher Catalogue'],
  ['bills', 'Bill Services'],
  ['providers', 'Providers & APIs'],
  ['transactions', 'Transactions'],
] as const;

const voucherCategories = ['Shopping', 'Food & Dining', 'Travel', 'Entertainment', 'Gaming'];
const billServices = [
  ['Mobile', Smartphone], ['DTH', Cable], ['Electricity', PlugZap],
  ['Gas', Banknote], ['Water', ReceiptText], ['FASTag', CreditCard],
] as const;

function ProviderState({ title, detail }: { title: string; detail: string }) {
  return <article className={styles.providerState}>
    <span className={styles.providerIcon}><Cable size={19}/></span>
    <div><b>{title}</b><small>{detail}</small></div>
    <span className={styles.notConnected}><i/>Not connected</span>
  </article>;
}

export default async function VouchersBillsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const query = await searchParams;
  const requested = query.tab ?? 'overview';
  const activeTab = tabs.some(([id]) => id === requested) ? requested : 'overview';

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><Gift size={21}/><b>Vouchers &amp; Bills</b><span className="dashboard-date">Partner &amp; growth commerce setup</span><span className="avatar">SR</span></header>
    <main className={`admin-content ${styles.page}`}>
      <div className="admin-title">
        <div><p>PARTNERS &amp; GROWTH</p><h1>Vouchers &amp; Bill Payments</h1><span>Set up customer voucher catalogues and bill-payment services as separate shopping destinations.</span></div>
        <Link className="add-store" href="/admin/integrations"><PlugZap size={16}/> API Integrations</Link>
      </div>

      <div className={styles.setupNotice} role="status">
        <CircleAlert size={20}/><div><b>Provider setup is still required</b><p>No voucher, bill-payment, or payment provider is connected here yet. This page will not invent offers, prices, availability, or transaction records.</p></div>
      </div>

      <nav className={styles.tabs} aria-label="Vouchers and bills sections">
        {tabs.map(([id, label]) => <Link key={id} href={`/admin/vouchers-bills?tab=${id}`} className={activeTab === id ? styles.activeTab : ''} aria-current={activeTab === id ? 'page' : undefined}>{label}</Link>)}
      </nav>

      {activeTab === 'overview' && <>
        <section className={styles.statusGrid} aria-label="Provider setup status">
          <ProviderState title="Voucher catalogue" detail="Gift cards and paid vouchers"/>
          <ProviderState title="Bill services" detail="Biller and recharge catalogue"/>
          <ProviderState title="Payment route" detail="Customer payment and settlement"/>
        </section>
        <section className={styles.catalogueGrid}>
          <article className={styles.cataloguePanel}>
            <header><span className={styles.panelIcon}><Ticket size={20}/></span><div><h2>Voucher catalogue</h2><p>Provider-supplied gift cards, denominations, prices, and terms.</p></div></header>
            <p className={styles.panelBody}>Suggested customer categories</p>
            <div className={styles.chips}>{voucherCategories.map((category) => <span key={category}>{category}</span>)}</div>
            <div className={styles.panelFoot}><span>Categories are a starting structure; offers appear only after a voucher provider is connected.</span><Link href="/admin/vouchers-bills?tab=vouchers">Open catalogue <ArrowRight size={15}/></Link></div>
          </article>
          <article className={styles.cataloguePanel}>
            <header><span className={`${styles.panelIcon} ${styles.billIcon}`}><ReceiptText size={20}/></span><div><h2>Bill services</h2><p>Supported services and billers from the selected payment partner.</p></div></header>
            <p className={styles.panelBody}>Service categories</p>
            <div className={styles.serviceGrid}>{billServices.map(([name, Icon]) => <span key={name}><Icon size={16}/>{name}</span>)}</div>
            <div className={styles.panelFoot}><span>Only services supported by the connected partner should be enabled.</span><Link href="/admin/vouchers-bills?tab=bills">Open services <ArrowRight size={15}/></Link></div>
          </article>
        </section>
        <section className={styles.bottomGrid}>
          <article className={styles.simplePanel}><header><ShieldCheck size={19}/><h2>Safe launch order</h2></header><ol><li>Select approved providers and confirm their commercial terms.</li><li>Connect credentials securely on the server, then test the catalogue.</li><li>Review biller coverage, refunds, settlement, and customer terms.</li><li>Enable customer access only after end-to-end tests pass.</li></ol></article>
          <article className={styles.simplePanel}><header><ReceiptText size={19}/><h2>Transactions</h2></header><p>Voucher purchases, bill fetches, payments, refunds, and provider references will be shown here after the payment workflow is connected.</p><Link href="/admin/vouchers-bills?tab=transactions">View transaction workspace <ArrowRight size={15}/></Link></article>
        </section>
      </>}

      {activeTab === 'vouchers' && <section className={styles.detailPanel}>
        <header><span className={styles.panelIcon}><Ticket size={20}/></span><div><h2>Voucher Catalogue</h2><p>Manage gift-card categories and provider-sourced voucher offers separately from physical products.</p></div></header>
        <div className={styles.categoryList}>{voucherCategories.map((category, index) => <article key={category}><span className={styles.categoryNumber}>{String(index + 1).padStart(2, '0')}</span><span><b>{category}</b><small>Suggested category · no offers imported</small></span><em>Setup pending</em></article>)}</div>
        <div className={styles.emptySource}><Gift size={24}/><b>No voucher offers are connected</b><p>Choose an approved gift-card supplier first. Its catalogue can then be mapped into these customer-facing categories, with denominations, price, stock, expiry, and redemption terms.</p><Link href="/admin/integrations">Review integration setup <ArrowRight size={15}/></Link></div>
      </section>}

      {activeTab === 'bills' && <section className={styles.detailPanel}>
        <header><span className={`${styles.panelIcon} ${styles.billIcon}`}><ReceiptText size={20}/></span><div><h2>Bill Services</h2><p>Service categories are distinct from product categories; the partner supplies supported billers and required customer fields.</p></div></header>
        <div className={styles.billServicesGrid}>{billServices.map(([name, Icon]) => <article key={name}><Icon size={20}/><b>{name}</b><small>Waiting for partner coverage</small><span>Not enabled</span></article>)}</div>
        <div className={styles.caution}><ShieldCheck size={18}/><p>Bill payments need an eligible BBPS arrangement or other approved payment setup appropriate to the service. Provider availability and operating obligations must be confirmed before launch.</p></div>
      </section>}

      {activeTab === 'providers' && <section className={styles.detailPanel}>
        <header><span className={styles.panelIcon}><Cable size={20}/></span><div><h2>Providers &amp; APIs</h2><p>Keep voucher supply, biller coverage, and payment processing as separately verified connections.</p></div></header>
        <div className={styles.providerList}>
          <ProviderState title="Voucher supplier" detail="Gift-card catalogue, denominations, fulfilment, and reversals"/>
          <ProviderState title="Bill-pay / recharge partner" detail="Biller discovery, bill fetch, payment, and status enquiry"/>
          <ProviderState title="Payment provider" detail="Payment authorisation, settlement, and refund route"/>
        </div>
        <div className={styles.providerSecurity}><ShieldCheck size={18}/><span>API credentials must be stored server-side. This page does not accept or expose API secrets.</span><Link href="/admin/integrations">Open API Integrations <ArrowRight size={15}/></Link></div>
      </section>}

      {activeTab === 'transactions' && <section className={styles.detailPanel}>
        <header><span className={styles.panelIcon}><FileText size={20}/></span><div><h2>Transactions</h2><p>One audit trail for voucher fulfilment and bill-payment status updates.</p></div></header>
        <div className={styles.transactionColumns}><span>TYPE</span><span>CUSTOMER</span><span>AMOUNT</span><span>PROVIDER REFERENCE</span><span>STATUS</span><span>UPDATED</span></div>
        <div className={styles.emptyTransactions}><CheckCircle2 size={27}/><b>No transactions yet</b><p>Real purchase and payment records will appear after providers are connected and customer checkout is enabled.</p></div>
      </section>}
    </main>
  </section></main>;
}
