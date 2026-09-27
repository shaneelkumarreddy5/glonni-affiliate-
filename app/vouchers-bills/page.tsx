import { InfoPage } from '@/components/info-page';

const services = {
  'gift-cards': { title: 'Gift cards', detail: 'Digital gift cards from supported brands will appear here.' },
  'mobile-recharge': { title: 'Mobile recharge', detail: 'Recharge options from supported operators will appear here.' },
  'bill-payments': { title: 'Pay bills', detail: 'Supported billers and payment options will appear here.' },
} as const;

export default async function VouchersBillsServicePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const service = type && type in services ? services[type as keyof typeof services] : null;
  const title = service?.title ?? 'Vouchers & bill payments';
  return <InfoPage eyebrow="VOUCHERS & BILLS" title={title} intro="This service is being prepared. Glonni will show real options only after the relevant provider and payment flow are connected.">
    <h2>Not available yet</h2>
    <p>{service?.detail ?? 'Gift cards, mobile recharge and supported bill-payment options will be listed here when available.'}</p>
    <p>No purchase or payment can be made from this page yet. We will not display sample offers or collect money while provider setup is pending.</p>
    <p><a href="/">Back to Glonni home</a></p>
  </InfoPage>;
}
