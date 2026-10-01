import Link from 'next/link';
import { ArrowRight, BadgePercent, Cable, CircleAlert, CreditCard, Gift, PlugZap, ReceiptText, ShieldCheck, Smartphone, Ticket, WalletCards } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { getCatalogOffers } from '@/lib/catalog';
import styles from './vouchers-bills.module.css';

export const dynamic = 'force-dynamic';

const billServices = [
  { name: 'Mobile recharge', icon: Smartphone },
  { name: 'DTH', icon: Cable },
  { name: 'Electricity', icon: PlugZap },
  { name: 'Gas', icon: CreditCard },
  { name: 'Water', icon: ReceiptText },
  { name: 'FASTag', icon: WalletCards },
];

export default async function CouponsBillsPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string }> }) {
  const { tab, type } = await searchParams;
  const activeTab = tab === 'bills' || type === 'mobile-recharge' || type === 'bill-payments' ? 'bills' : 'coupons';
  const couponOffers = activeTab === 'coupons'
    ? (await getCatalogOffers()).filter((offer) => offer.reward_type === 'coupon' && offer.coupon_code?.trim())
    : [];

  return <><Header/><main className={styles.page}>
    <BrowseNav items={[{ label: 'Coupons & Bills' }]}/>
    <div className={styles.intro}>
      <div className={styles.introCopy}>
        <span className={styles.eyebrow}>SHOP &amp; SAVE WITH GLONNI</span>
        <h1>Coupons &amp; Bills</h1>
        <p>Find approved coupon codes for store offers, and check the status of bill-payment services in one place.</p>
      </div>
      <div className={styles.introArtwork} aria-hidden="true"><Ticket/><ReceiptText/><BadgePercent/></div>
    </div>

    <nav className={styles.tabs} aria-label="Coupons and bills">
      <Link href="/vouchers-bills?tab=coupons" className={activeTab === 'coupons' ? styles.activeTab : ''} aria-current={activeTab === 'coupons' ? 'page' : undefined}><Ticket size={18}/>Coupons</Link>
      <Link href="/vouchers-bills?tab=bills" className={activeTab === 'bills' ? styles.activeTab : ''} aria-current={activeTab === 'bills' ? 'page' : undefined}><ReceiptText size={18}/>Bill Payments</Link>
    </nav>

    {activeTab === 'coupons' ? <section className={styles.tabContent} aria-labelledby="coupons-title">
      <div className={styles.sectionHeading}><div><h2 id="coupons-title">Available coupons</h2><p>Only active, published store offers with an approved coupon code appear here.</p></div><span>{couponOffers.length} {couponOffers.length === 1 ? 'coupon' : 'coupons'}</span></div>
      {type === 'gift-cards' && <div className={styles.notice}><Gift size={20}/><p><b>Looking for gift cards?</b> Gift-card purchasing is not available yet. No voucher provider is connected.</p></div>}
      {couponOffers.length ? <div className={styles.couponGrid}>{couponOffers.map((offer) => <article className={styles.couponCard} key={offer.id}>
        <div className={styles.couponTop}><span><Ticket size={16}/>Store coupon</span><b>{offer.merchants?.name ?? 'Store'}</b></div>
        <h3>{offer.products?.title ?? 'Store offer'}</h3>
        {offer.reward_terms && <p className={styles.terms}>{offer.reward_terms}</p>}
        <div className={styles.codeRow}><span>COUPON CODE</span><strong>{offer.coupon_code}</strong></div>
        <Link href={`/product/${offer.products?.slug}`} className={styles.couponLink}>View offer &amp; terms <ArrowRight size={17}/></Link>
      </article>)}</div> : <div className={styles.emptyState}><Ticket size={30}/><h3>No coupon codes are published right now</h3><p>When an approved store offer includes a coupon code, it will appear here. You can still explore current deals.</p><Link href="/deals">Browse deals <ArrowRight size={16}/></Link></div>}
      <div className={styles.guidance}><ShieldCheck size={21}/><p><b>Before you shop:</b> Check the offer’s terms and final price on the store site. A coupon is not the same as Glonni Cashback; cashback applies only when the specific offer says it is eligible.</p></div>
    </section> : <section className={styles.tabContent} aria-labelledby="bills-title">
      <div className={styles.sectionHeading}><div><h2 id="bills-title">Bill payments</h2><p>Recharge and bill services are being prepared with approved payment partners.</p></div><span className={styles.pending}>Setup pending</span></div>
      <div className={styles.billNotice}><CircleAlert size={24}/><div><h3>Bill payments are not available yet</h3><p>No biller, recharge, or payment provider is connected. Glonni cannot fetch a bill or take a payment from this page until the service has been verified and enabled.</p></div></div>
      <h3 className={styles.subheading}>Services being evaluated</h3>
      <div className={styles.serviceGrid}>{billServices.map(({ name, icon: Icon }) => <div className={styles.serviceCard} key={name}><span><Icon size={22}/></span><b>{name}</b><small>Not enabled</small></div>)}</div>
      <div className={styles.guidance}><ShieldCheck size={21}/><p><b>For your safety:</b> Do not enter bill numbers, account details, OTPs, or payment information here. Supported billers, fees, and payment terms will be shown only after a provider is connected.</p></div>
    </section>}
  </main></>;
}
