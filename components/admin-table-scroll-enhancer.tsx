'use client';

import { useEffect } from 'react';

const INTERACTIVE_TARGET = 'a,button,input,select,textarea,label,summary,[role="button"],[contenteditable="true"]';

export function AdminTableScrollEnhancer() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();
    const refreshes = new Map<HTMLElement, () => void>();

    const enhance = (table: HTMLTableElement) => {
      const container = table.parentElement;
      if (!container || cleanups.has(container)) return;

      container.classList.add('admin-horizontal-table-scroll');
      const originalAttributes = {
        tabindex: container.getAttribute('tabindex'),
        role: container.getAttribute('role'),
        'aria-label': container.getAttribute('aria-label'),
      };
      const restoreAttribute = (name: keyof typeof originalAttributes) => {
        const value = originalAttributes[name];
        if (value === null) container.removeAttribute(name);
        else container.setAttribute(name, value);
      };

      const hint = document.createElement('p');
      hint.className = 'admin-horizontal-scroll-hint';
      hint.textContent = 'Drag or scroll sideways to see all columns  ↔';
      container.parentElement?.insertBefore(hint, container);

      let startX = 0;
      let startY = 0;
      let startScrollLeft = 0;
      let pointerId: number | null = null;
      let dragging = false;
      let suppressClick = false;

      const updateOverflow = () => {
        const canScroll = container.scrollWidth > container.clientWidth + 2;
        container.classList.toggle('has-horizontal-overflow', canScroll);
        hint.hidden = !canScroll;
        if (!canScroll) {
          restoreAttribute('role');
          restoreAttribute('aria-label');
          restoreAttribute('tabindex');
        } else {
          if (!container.hasAttribute('role')) container.setAttribute('role', 'region');
          if (!container.hasAttribute('aria-label')) {
            container.setAttribute('aria-label', 'Scrollable table. Use the left and right arrow keys or drag to view all columns.');
          }
          if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
        }
      };

      const stopDrag = () => {
        if (pointerId !== null && container.hasPointerCapture(pointerId)) {
          container.releasePointerCapture(pointerId);
        }
        if (dragging) {
          suppressClick = true;
          window.setTimeout(() => { suppressClick = false; }, 0);
        }
        pointerId = null;
        dragging = false;
        container.classList.remove('is-dragging');
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || !container.classList.contains('has-horizontal-overflow')) return;
        if ((event.target as Element | null)?.closest(INTERACTIVE_TARGET)) return;
        const bounds = container.getBoundingClientRect();
        if (event.clientY >= bounds.bottom - 12) return;

        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startScrollLeft = container.scrollLeft;
        dragging = false;
        try { container.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (!dragging && Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        if (!dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
          stopDrag();
          return;
        }
        dragging = true;
        container.classList.add('is-dragging');
        container.scrollLeft = startScrollLeft - deltaX;
        event.preventDefault();
      };

      const onPointerUp = (event: PointerEvent) => {
        if (pointerId === event.pointerId) stopDrag();
      };

      const onClick = (event: MouseEvent) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.target !== container || !container.classList.contains('has-horizontal-overflow')) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          container.scrollBy({ left: event.key === 'ArrowRight' ? 120 : -120, behavior: 'smooth' });
        }
      };

      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove, { passive: false });
      container.addEventListener('pointerup', onPointerUp);
      container.addEventListener('pointercancel', onPointerUp);
      container.addEventListener('lostpointercapture', onPointerUp as EventListener);
      container.addEventListener('click', onClick, true);
      container.addEventListener('keydown', onKeyDown);
      const resizeObserver = new ResizeObserver(updateOverflow);
      resizeObserver.observe(container);
      window.addEventListener('resize', updateOverflow);
      refreshes.set(container, updateOverflow);
      updateOverflow();

      cleanups.set(container, () => {
        stopDrag();
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateOverflow);
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('pointercancel', onPointerUp);
        container.removeEventListener('lostpointercapture', onPointerUp as EventListener);
        container.removeEventListener('click', onClick, true);
        container.removeEventListener('keydown', onKeyDown);
        refreshes.delete(container);
        restoreAttribute('role');
        restoreAttribute('aria-label');
        restoreAttribute('tabindex');
        hint.remove();
        container.classList.remove('admin-horizontal-table-scroll', 'has-horizontal-overflow', 'is-dragging');
      });
    };

    const scan = () => {
      document.querySelectorAll<HTMLTableElement>('.admin-v2 table').forEach((table) => {
        const container = table.parentElement;
        if (container && cleanups.has(container)) refreshes.get(container)?.();
        else enhance(table);
      });
      for (const [container, cleanup] of cleanups) {
        if (!container.isConnected) {
          cleanup();
          refreshes.delete(container);
          cleanups.delete(container);
        }
      }
    };

    let frame = 0;
    const scheduleScan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    scheduleScan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const cleanup of cleanups.values()) cleanup();
      cleanups.clear();
    };
  }, []);

  return null;
}
