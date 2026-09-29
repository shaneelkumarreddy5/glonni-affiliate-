import Link from 'next/link';
import styles from './contextual-faqs.module.css';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

type Faq = { id: string; question: string; answer: string; scope: string };

export function ContextualFaqs({ faqs, title = 'Cashback & offer details', maxItems = 6, eyebrow = 'SUPPORT GUIDANCE', intro }: { faqs: Faq[]; title?: string; maxItems?: number; eyebrow?: string; intro?: string }) {
  if (!faqs.length) return <section className={styles.box}><p>{eyebrow}</p><h2>{renderWebsiteRichText(title)}</h2>{intro && <span>{renderWebsiteRichText(intro)}</span>}<div className={styles.empty}>Cashback is shown only when the exact offer is eligible. Need help with this listing? <Link href="/support">Ask Glonni Support</Link></div></section>;
  return <section className={styles.box}><p>{eyebrow}</p><h2>{renderWebsiteRichText(title)}</h2>{intro && <span>{renderWebsiteRichText(intro)}</span>}<div className={styles.list}>{faqs.slice(0, maxItems).map((faq) => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div><Link className={styles.help} href="/support">Still need help? Ask Glonni Support →</Link></section>;
}
