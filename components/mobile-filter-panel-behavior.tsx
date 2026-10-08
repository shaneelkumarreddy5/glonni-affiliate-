'use client';

import { useEffect } from 'react';

const FILTER_PANEL_SELECTOR = '.category-filter-panel, .deals-filter-panel';

export function MobileFilterPanelBehavior() {
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLDetailsElement>(FILTER_PANEL_SELECTOR));
    if (!panels.length) return;

    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
    let previousMobile: boolean | null = null;
    const updateScrollLock = () => {
      const shouldLock = isMobile() && panels.some((panel) => panel.open);
      document.documentElement.classList.toggle('mobile-filter-sheet-open', shouldLock);
    };
    const syncViewport = () => {
      const mobile = isMobile();
      if (mobile !== previousMobile) {
        panels.forEach((panel) => { panel.open = !mobile; });
        previousMobile = mobile;
      }
      updateScrollLock();
    };
    const handleToggle = () => updateScrollLock();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      panels.forEach((panel) => { if (isMobile()) panel.open = false; });
      updateScrollLock();
    };
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isMobile()) return;
      panels.forEach((panel) => {
        if (panel.open && !panel.contains(event.target as Node)) panel.open = false;
      });
      updateScrollLock();
    };

    panels.forEach((panel) => panel.addEventListener('toggle', handleToggle));
    window.addEventListener('resize', syncViewport);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleOutsideClick);
    syncViewport();

    return () => {
      panels.forEach((panel) => panel.removeEventListener('toggle', handleToggle));
      window.removeEventListener('resize', syncViewport);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleOutsideClick);
      document.documentElement.classList.remove('mobile-filter-sheet-open');
    };
  }, []);

  return null;
}
