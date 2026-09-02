'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode, useRef } from 'react';

export function ScrollRail({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  function move(direction: -1 | 1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(260, Math.round(element.clientWidth * 0.78)), behavior: 'smooth' });
  }
  return <div className={`scroll-rail ${className}`}><div ref={rail} className="scroll-rail-track">{children}</div><button type="button" className="rail-control rail-prev" onClick={() => move(-1)} aria-label={`Scroll ${label} left`}><ChevronLeft size={19}/></button><button type="button" className="rail-control rail-next" onClick={() => move(1)} aria-label={`Scroll ${label} right`}><ChevronRight size={19}/></button></div>;
}
