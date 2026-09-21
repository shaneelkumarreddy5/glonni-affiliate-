'use client';

import { useEffect } from 'react';

const aliases: Record<string, string[]> = {
  'price alerts': ['price', 'alert'],
  cashback: ['cashback', 'reward'],
  claims: ['claim', 'missing-order'],
  announcements: ['announcement', 'service'],
  queued: ['queued'],
  sent: ['sent'],
  failed: ['failed', 'failure'],
  imports: ['import', 'feed', 'csv'],
  validation: ['validation', 'invalid', 'duplicate'],
  permissions: ['permission', 'access'],
  'policy reviews': ['policy', 'review'],
  posts: ['post', 'published'],
  'tracked links': ['tracked', 'click'],
  security: ['security', 'auth', 'password', 'mfa'],
  legal: ['legal', 'terms', 'privacy'],
  'launch checklist': ['launch', 'required', 'pending'],
  'blocked items': ['blocked', 'pending'],
};

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export function AdminTabRepair() {
  useEffect(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('.table-head a:not([href])'));
    const cleanups = anchors.map((anchor) => {
      const label = anchor.textContent?.trim() || '';
      const key = label.toLowerCase();
      const table = anchor.closest('.store-table');
      anchor.href = `#admin-tab-${slug(label)}`;
      anchor.setAttribute('role', 'tab');
      anchor.setAttribute('aria-label', `Show ${label}`);
      const click = (event: MouseEvent) => {
        event.preventDefault();
        anchor.parentElement?.querySelectorAll('a').forEach((item) => item.classList.remove('current'));
        anchor.classList.add('current');
        const rows = table ? Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')) : [];
        const tokens = aliases[key] || [key];
        const all = key === 'all' || key === 'templates' || key === 'current overview' || key === 'platform configuration' || key === 'integration methods' || key === 'platform connections' || key === 'channel performance';
        let matched = 0;
        rows.forEach((row) => {
          const visible = all || tokens.some((token) => row.textContent?.toLowerCase().includes(token));
          row.hidden = !visible;
          if (visible) matched += 1;
        });
        if (table && rows.length && matched === 0) rows.forEach((row) => { row.hidden = false; });
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#admin-tab-${slug(label)}`);
      };
      anchor.addEventListener('click', click);
      return () => anchor.removeEventListener('click', click);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  return null;
}
