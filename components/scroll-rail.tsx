'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import styles from './scroll-rail.module.css';

export function ScrollRail({ children, className = '', label, viewAllHref, hasMoreItems = false }: { children: ReactNode; className?: string; label: string; viewAllHref?: string; hasMoreItems?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const railId = `scroll-rail-${useId().replace(/:/g, '')}`;
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (!viewAllHref || !rail.current) return;
    const track = rail.current;
    const measure = () => setOverflows(track.scrollWidth > track.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of track.children) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [children, viewAllHref]);

  function move(direction: -1 | 1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(260, Math.round(element.clientWidth * 0.78)), behavior: 'smooth' });
  }
  return <div className={`${styles.rail} scroll-rail ${className}`} role="region" aria-label={label}><div ref={rail} id={railId} tabIndex={0} className={`${styles.track} scroll-rail-track`}>{children}</div>{viewAllHref && (hasMoreItems || overflows) && <Link className={`${styles.viewAllLink} scroll-rail-view-all`} href={viewAllHref} aria-label={`View all ${label}`}>View all <ChevronRight size={14}/></Link>}<button type="button" className={`${styles.control} ${styles.previous} rail-control rail-prev`} onClick={() => move(-1)} aria-controls={railId} aria-label={`Scroll ${label} left`}><ChevronLeft size={19}/></button><button type="button" className={`${styles.control} ${styles.next} rail-control rail-next`} onClick={() => move(1)} aria-controls={railId} aria-label={`Scroll ${label} right`}><ChevronRight size={19}/></button></div>;
}
