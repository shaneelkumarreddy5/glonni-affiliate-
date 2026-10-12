'use client';

import { useEffect } from 'react';

/** Keeps the existing local table searches, without preview-mode click interception. */
export function AdminTableFilter() {
  useEffect(() => {
    const onInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('.admin-v2 .table-head input')) return;
      const query = input.value.trim().toLowerCase();
      input.closest('.store-table')?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
        row.hidden = Boolean(query) && !row.textContent?.toLowerCase().includes(query);
      });
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, []);
  return null;
}
