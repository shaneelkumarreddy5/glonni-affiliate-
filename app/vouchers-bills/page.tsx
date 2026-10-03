import Link from 'next/link';
import { ArrowRight, BadgePercent, Cable, CircleAlert, CreditCard, Gift, PlugZap, ReceiptText, ShieldCheck, ShoppingBag, Smartphone, Ticket, WalletCards } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { BILL_SERVICES, getCommerceVisibility, getVisibleVoucherCatalog, VOUCHER_CATEGORIES } from '@/lib/commerce';
import { getCatalogOffers } from '@/lib/catalog';
import styles from './vouchers-bills.module.css';

export const dynamic = 'force-dynamic';

const billIcons = { mobile_recharge: Smartphone, dth: Cable, electricity: PlugZap, gas: CreditCard, water: ReceiptText, fastag: WalletCards };
const formatMoney = (value: number) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default async function CouponsBillsPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; category?: string }> }) {
  const { tab, type, category } = await searchParams;
  const { settings } = await getCommerceVisibility();
  const availableTabs = [
    { key: 'coupons', label: 'Coupons', icon: Ticket, visible: settings.coupons_enabled },
    { key: 'buy', label: 'Buy Coupons', icon: ShoppingBag, visible: settings.buy_coupons_enabled },
    { key: 'bills', label: 'Bill Payments', icon: ReceiptText, visible: settings.bill_payments_enabled },
  ].filter((item) => item.visible);
  const requestedTab = tab === 'buy' || type === 'gift-cards' ? 'buy' : tab === 'bills' || type === 'mobile-recharge' || type === 'bill-payments' ? 'bills' : 'coupons';
  const activeTab = availableTabs.some((item) => item.key === requestedTab) ? requestedTab : availableTabs[0]?.key;
  const couponOffers = activeTab === 'coupons' ? (await getCatalogOffers()).filter((offer) => offer.reward_type === 'coupon' && offer.coupon_code?.trim()) : [];
  const voucherCatalog = activeTab === 'buy' ? await getVisibleVoucherCatalog(settings) : [];
  const visibleVoucherCategories = VOUCHER_CATEGORIES.filter((item) => settings.voucher_categories[item.key]);
  const selectedCategory = visibleVoucherCategories.some((item) => item.key === category) ? category : undefined;
  const displayedVouchers = selectedCategory ? voucherCatalog.filter((item) => item.category_key === selectedCategory) : voucherCatalog;
  const visibleBillServices = BILL_SERVICES.filter((item) => settings.bill_services[item.key]);

  return <><Header/><main className={styles.page}>
    <BrowseNav items={[{ label: 'Coupons & Bills' }]}/>
    <div className={styles.intro}><div className={styles.introCopy}><span className={styles.eyebrow}>SHOP &amp; SAVE WITH GLONNI</span><h1>Coupons &amp; Bill Payments</h1><p>Save with merchant codes, discover redeemable vouchers, and explore bill-payment services in one place.</p></div><div className={styles.introArtwork} aria-hidden="true"><Ticket/><ReceiptText/><BadgePercent/></div></div>

    {availableTabs.length ? <nav className={styles.tabs} aria-label="Coupons and bills">{availableTabs.map(({ key, label, icon: Icon }) => <Link key={key} href={`/vouchers-bills?tab=${key}`} className={activeTab === key ? styles.activeTab : ''} aria-current={activeTab === key ? 'page' : undefined}><Icon size={18}/>{label}</Link>)}</nav> : <div className={styles.emptyState}><CircleAlert size={30}/><h2>These services are temporarily unavailable</h2><p>Please check back later or explore current deals.</p><Link href="/deals">Browse deals <ArrowRight size={16}/></Link></div>}

    {activeTab === 'coupons' && <section className={styles.tabContent} aria-labelledby="coupons-title"><div className={styles.sectionHeading}><div><h2 id="coupons-title">Available coupons</h2><p>Published coupon codes from approved merchant offers. Redeem them on the merchant’s website.</p></div><span>{couponOffers.length} {couponOffers.length === 1 ? 'coupon' : 'coupons'}</span></div>
      {couponOffers.length ? <div className={styles.couponGrid}>{couponOffers.map((offer) => <article className={styles.couponCard} key={offer.id}><div className={styles.couponTop}><span><Ticket size={16}/>Merchant coupon</span><b>{offer.merchants?.name ?? 'Store'}</b></div><h3>{offer.products?.title ?? 'Store offer'}</h3>{offer.reward_terms && <p className={styles.terms}>{offer.reward_terms}</p>}<div className={styles.codeRow}><span>COUPON CODE</span><strong>{offer.coupon_code}</strong></div><Link href={`/product/${offer.products?.slug}`} className={styles.couponLink}>View offer &amp; terms <ArrowRight size={17}/></Link></article>)}</div> : <div className={styles.emptyState}><Ticket size={30}/><h3>No coupon codes are published right now</h3><p>When an approved store offer includes a coupon code, it will appear here. You can still explore current deals.</p><Link href="/deals">Browse deals <ArrowRight size={16}/></Link></div>}
      <div className={styles.guidance}><ShieldCheck size={21}/><p><b>Before you shop:</b> Check the offer’s terms and final price on the store site. Merchant coupons are separate from Buy Coupons and do not automatically earn Glonni Cashback.</p></div>
    </section>}

    {activeTab === 'buy' && <section className={styles.tabContent} aria-labelledby="buy-title"><div className={styles.sectionHeading}><div><h2 id="buy-title">Buy coupons &amp; gift cards</h2><p>Purchased on Glonni and redeemed with the brand once an approved provider is connected.</p></div><span className={styles.pending}>Provider setup pending</span></div>
      <nav className={styles.categoryChips} aria-label="Voucher categories"><Link href="/vouchers-bills?tab=buy" aria-current={!selectedCategory ? 'page' : undefined} className={!selectedCategory ? styles.selectedChip : ''}>All</Link>{visibleVoucherCategories.map((item) => <Link key={item.key} href={`/vouchers-bills?tab=buy&category=${item.key}`} aria-current={selectedCategory === item.key ? 'page' : undefined} className={selectedCategory === item.key ? styles.selectedChip : ''}>{item.label}</Link>)}</nav>
      {displayedVouchers.length ? <div className={styles.voucherGrid}>{displayedVouchers.map((item) => <article className={styles.voucherCard} key={item.id}><div className={styles.voucherArtwork}>{item.image_url ? <img src={item.image_url} alt=""/> : <Gift size={42}/>}</div><div className={styles.voucherBody}><span className={styles.voucherMerchant}>{item.merchant_name}</span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<div className={styles.voucherPrice}><span>Value {formatMoney(item.face_value)}</span><strong>{formatMoney(item.selling_price)}</strong></div>{item.redemption_terms && <small>{item.redemption_terms}</small>}<button type="button" disabled aria-label={`Buying ${item.title} is not available yet`}>Buying unavailable</button></div></article>)}</div> : <div className={styles.emptyState}><Gift size={30}/><h3>No buyable coupons are available yet</h3><p>We’ll show real brands, values, prices, and redemption terms here after an approved voucher provider is connected. No purchase is possible now.</p></div>}
      <div className={styles.howPanel}><div><h3>How it will work</h3><p>Purchasing opens only after provider fulfilment and payments are verified.</p></div><ol><li><b>1</b><span>Choose a voucher</span></li><li><b>2</b><span>Pay securely on Glonni</span></li><li><b>3</b><span>Redeem with the brand</span></li></ol></div>
    </section>}

    {activeTab === 'bills' && <section className={styles.tabContent} aria-labelledby="bills-title"><div className={styles.sectionHeading}><div><h2 id="bills-title">Bill payments</h2><p>Only the service categories currently shown by Glonni appear below.</p></div><span className={styles.pending}>Setup pending</span></div><div className={styles.billNotice}><CircleAlert size={24}/><div><h3>Bill payments are not available yet</h3><p>No biller, recharge, or payment provider is connected. Glonni cannot fetch a bill or take a payment from this page until the service has been verified and enabled.</p></div></div>
      {visibleBillServices.length ? <><h3 className={styles.subheading}>Services being evaluated</h3><div className={styles.serviceGrid}>{visibleBillServices.map((service) => { const Icon = billIcons[service.key]; return <div className={styles.serviceCard} key={service.key}><span><Icon size={22}/></span><b>{service.label}</b><small>Payments not enabled</small></div>; })}</div></> : <div className={styles.emptyState}><ReceiptText size={30}/><h3>No bill services are shown right now</h3><p>Service availability is controlled by Glonni administrators.</p></div>}
      <div className={styles.guidance}><ShieldCheck size={21}/><p><b>For your safety:</b> Do not enter bill numbers, account details, OTPs, or payment information here. Supported billers, fees, and payment terms will be shown only after a provider is connected.</p></div>
    </section>}
  </main></>;
}
