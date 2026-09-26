import styles from './store-card.module.css';

type Props = {
  href: string;
  name: string;
  logoUrl?: string | null;
};

export function StoreCard({ href, name, logoUrl }: Props) {
  return <a className={styles.card} href={href} aria-label={`Open ${name} store page`}>
    <span className={styles.logo} aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt=""/> : <b>{name.trim().slice(0, 1).toUpperCase()}</b>}
    </span>
    <strong>{name}</strong>
  </a>;
}
