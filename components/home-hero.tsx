import type { ReactNode } from 'react';
import styles from './home-hero.module.css';

type HomeHeroProps = {
  title: ReactNode;
  description: ReactNode;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string | null;
  interactive?: boolean;
};

export function HomeHero({ title, description, ctaLabel, ctaHref, imageUrl, interactive = true }: HomeHeroProps) {
  return <section className={`${styles.hero} home-hero`} aria-label="Featured offers">
    <div className={`${styles.copy} home-hero-copy`}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {interactive ? <a className={styles.cta} href={ctaHref}>{ctaLabel}<span aria-hidden="true">›</span></a> : <span className={`${styles.cta} ${styles.ctaStatic}`}>{ctaLabel}<span aria-hidden="true">›</span></span>}
    </div>
    <div className={`${styles.visual} home-hero-visual`} aria-hidden="true">
      {imageUrl && <img src={imageUrl} alt="" fetchPriority="high"/>}
    </div>
  </section>;
}
