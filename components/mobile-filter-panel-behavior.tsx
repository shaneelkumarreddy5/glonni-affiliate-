'use client';

import { useEffect } from 'react';

const FILTER_PANEL_SELECTOR = '[data-filter-panel]';

export function MobileFilterPanelBehavior() {
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLDetailsElement>(FILTER_PANEL_SELECTOR));
    if (!panels.length) return;

    const media = window.matchMedia('(max-width: 760px)');
    let wasMobile: boolean | null = null;
    const sync = () => {
      const mobile = media.matches;
      if (wasMobile !== mobile) {
        panels.forEach((panel) => { panel.open = false; });
        wasMobile = mobile;
      }
      document.documentElement.classList.toggle('mobile-filter-sheet-open', mobile && panels.some((panel) => panel.open));
    };
    const updateLock = () => document.documentElement.classList.toggle('mobile-filter-sheet-open', media.matches && panels.some((panel) => panel.open));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && media.matches) panels.forEach((panel) => { panel.open = false; });
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (!media.matches) return;
      panels.forEach((panel) => {
        if (panel.open && !panel.contains(event.target as Node)) panel.open = false;
      });
    };
    panels.forEach((panel) => panel.addEventListener('toggle', updateLock));
    media.addEventListener('change', sync);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);
    sync();
    return () => {
      panels.forEach((panel) => panel.removeEventListener('toggle', updateLock));
      media.removeEventListener('change', sync);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
      document.documentElement.classList.remove('mobile-filter-sheet-open');
    };
  }, []);
  return null;
}
