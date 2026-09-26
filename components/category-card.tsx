import styles from './category-card.module.css';

type Props = {
  href: string;
  name: string;
  imageUrl?: string | null;
};

export function CategoryCard({ href, name, imageUrl }: Props) {
  return <a className={styles.card} href={href}>
    <span className={styles.image} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt=""/> : <b>{name.trim().slice(0, 1).toUpperCase()}</b>}
    </span>
    <strong>{name}</strong>
    <small>Explore category</small>
  </a>;
}
