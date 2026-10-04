'use client';

import { useEffect } from 'react';

/** Adds grab-to-pan behavior to horizontally overflowing admin data tables. */
export function AdminTablePan() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.admin-v2');
    if (!root) return;

    let active: { element: HTMLElement; pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null = null;
    let suppressNextClick = false;
    let clickResetTimer: number | undefined;

    const findPanContainer = (table: HTMLTableElement) => {
      let element = table.parentElement;
      while (element && element !== root) {
        const style = window.getComputedStyle(element);
        if (element.scrollWidth > element.clientWidth + 2 && ['auto', 'scroll', 'overlay'].includes(style.overflowX)) return element;
        element = element.parentElement;
      }
      return null;
    };

    const markTables = () => {
      root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
        const container = findPanContainer(table);
        if (!container) return;
        container.classList.add('admin-table-pan-enabled');
        if (container.title !== 'Grab and drag left or right to view more columns') container.title = 'Grab and drag left or right to view more columns';
        if (!container.hasAttribute('aria-label')) container.setAttribute('aria-label', 'Scrollable data table. Grab and drag left or right to view more columns.');
        if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) return;
      const table = event.target.closest('table');
      if (!(table instanceof HTMLTableElement)) return;
      const element = findPanContainer(table);
      if (!element) return;
      active = { element, pointerId: event.pointerId, startX: event.clientX, startScrollLeft: element.scrollLeft, moved: false };
      element.classList.add('admin-table-panning');
      element.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return;
      const distance = event.clientX - active.startX;
      if (Math.abs(distance) > 4) active.moved = true;
      if (!active.moved) return;
      event.preventDefault();
      active.element.scrollLeft = active.startScrollLeft - distance;
    };

    const finishPan = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return;
      const { element, moved } = active;
      element.classList.remove('admin-table-panning');
      active = null;
      if (moved) {
        suppressNextClick = true;
        window.clearTimeout(clickResetTimer);
        clickResetTimer = window.setTimeout(() => { suppressNextClick = false; }, 0);
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    markTables();
    const observer = new MutationObserver(markTables);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove, { passive: false });
    root.addEventListener('pointerup', finishPan);
    root.addEventListener('pointercancel', finishPan);
    root.addEventListener('click', onClickCapture, true);
    return () => {
      observer.disconnect();
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', finishPan);
      root.removeEventListener('pointercancel', finishPan);
      root.removeEventListener('click', onClickCapture, true);
      window.clearTimeout(clickResetTimer);
    };
  }, []);

  return null;
}
