'use client';

import { useEffect } from 'react';

/** Adds a real destination to legacy action labels that were rendered as inert buttons. */
export function AdminActionRepair() {
  useEffect(() => {
    const exports = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-v2 button')).filter(button => button.textContent?.trim() === 'Export analytics');
    const exportLinks = exports.map(button => {
      const link = document.createElement('a');
      link.className = button.className;
      link.href = '/admin/social-analytics/export';
      link.textContent = 'Export analytics';
      link.setAttribute('aria-label', 'Export social analytics CSV');
      button.replaceWith(link);
      return [button, link] as const;
    });
    const reviewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-v2 button.table-edit-button'));
    const handlers = reviewButtons.map((button) => {
      const row = button.closest('tr');
      const productId = row?.id?.startsWith('product-') ? row.id.slice('product-'.length) : '';
      const store = new URLSearchParams(window.location.search).get('store');
      if (!productId) return [button, () => {}] as const;
      const handler = () => {
        window.location.href = `/admin/products/${productId}?from=store${store ? `&store=${encodeURIComponent(store)}` : ''}`;
      };
      button.addEventListener('click', handler);
      return [button, handler] as const;
    });
    return () => {
      handlers.forEach(([button, handler]) => button.removeEventListener('click', handler));
      exportLinks.forEach(([button, link]) => link.replaceWith(button));
    };
  }, []);
  return null;
}
