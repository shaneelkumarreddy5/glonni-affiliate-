'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode, useId, useRef } from 'react';
import styles from './scroll-rail.module.css';

export function ScrollRail({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const railId = `scroll-rail-${useId().replace(/:/g, '')}`;
  function move(direction: -1 | 1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(260, Math.round(element.clientWidth * 0.78)), behavior: 'smooth' });
  }
  return <div className={`${styles.rail} scroll-rail ${className}`} role="region" aria-label={label}><div ref={rail} id={railId} tabIndex={0} className={`${styles.track} scroll-rail-track`}>{children}</div><button type="button" className={`${styles.control} ${styles.previous} rail-control rail-prev`} onClick={() => move(-1)} aria-controls={railId} aria-label={`Scroll ${label} left`}><ChevronLeft size={19}/></button><button type="button" className={`${styles.control} ${styles.next} rail-control rail-next`} onClick={() => move(1)} aria-controls={railId} aria-label={`Scroll ${label} right`}><ChevronRight size={19}/></button></div>;
}
