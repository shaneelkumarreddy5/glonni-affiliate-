import Link from 'next/link';
import styles from './contextual-faqs.module.css';
import storeStyles from './contextual-faqs-store.module.css';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

type Faq = { id: string; question: string; answer: string; scope: string };

export function ContextualFaqs({ faqs, title = 'Cashback & offer details', maxItems = 6, eyebrow = 'SUPPORT GUIDANCE', intro, variant = 'default' }: { faqs: Faq[]; title?: string; maxItems?: number; eyebrow?: string; intro?: string; variant?: 'default' | 'store-page' }) {
  const isStorePage = variant === 'store-page';
  const className = `${styles.box}${isStorePage ? ` ${storeStyles.section}` : ''}`;
  if (!faqs.length) return <section className={className}>{!isStorePage && <p>{eyebrow}</p>}<h2>{renderWebsiteRichText(title)}</h2>{intro && <span>{renderWebsiteRichText(intro)}</span>}<div className={`${styles.empty}${isStorePage ? ` ${storeStyles.empty}` : ''}`}>Cashback is shown only when the exact offer is eligible. Need help with this listing? <Link href="/support">Ask Glonni Support</Link></div></section>;
  return <section className={className}>{!isStorePage && <p>{eyebrow}</p>}<h2>{renderWebsiteRichText(title)}</h2>{intro && <span>{renderWebsiteRichText(intro)}</span>}<div className={`${styles.list}${isStorePage ? ` ${storeStyles.list}` : ''}`}>{faqs.slice(0, maxItems).map((faq) => <details className={isStorePage ? storeStyles.item : undefined} key={faq.id}><summary className={isStorePage ? storeStyles.question : undefined}>{faq.question}</summary><p className={isStorePage ? storeStyles.answer : undefined}>{faq.answer}</p></details>)}</div><Link className={`${styles.help}${isStorePage ? ` ${storeStyles.help}` : ''}`} href="/support">Still need help? Ask Glonni Support →</Link></section>;
}
