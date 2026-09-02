import Link from 'next/link';
import styles from './contextual-faqs.module.css';

type Faq = { id: string; question: string; answer: string; scope: string };

export function ContextualFaqs({ faqs, title = 'Cashback & offer details' }: { faqs: Faq[]; title?: string }) {
  if (!faqs.length) return <section className={styles.box}><p>SUPPORT GUIDANCE</p><h2>{title}</h2><div className={styles.empty}>Cashback is shown only when the exact offer is eligible. Need help with this listing? <Link href="/support">Ask Glonni Support</Link></div></section>;
  return <section className={styles.box}><p>SUPPORT GUIDANCE</p><h2>{title}</h2><div className={styles.list}>{faqs.slice(0, 6).map((faq) => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div><Link className={styles.help} href="/support">Still need help? Ask Glonni Support →</Link></section>;
}
