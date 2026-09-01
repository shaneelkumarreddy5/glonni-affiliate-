'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

export function AdminMockMode({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);

  const show = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>('.admin-v2 .admin-content button[disabled]').forEach((button) => {
      if (button.closest('.owner-chat, .emergency-bar')) return;
      button.disabled = false;
      button.dataset.mockControl = 'true';
      button.setAttribute('aria-label', `${button.textContent?.trim() || 'Control'} — mock preview`);
    });
  }, []);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const admin = target.closest('.admin-v2');
    if (!admin) return;
    const tab = target.closest<HTMLAnchorElement>('.table-head a');
    if (tab && (!tab.getAttribute('href') || tab.getAttribute('href') === '#')) {
      event.preventDefault();
      tab.parentElement?.querySelectorAll('a').forEach((item) => item.classList.remove('current'));
      tab.classList.add('current');
      show(`${tab.textContent?.trim()} view is active with mock data.`);
      return;
    }
    const button = target.closest<HTMLButtonElement>('button[data-mock-control="true"]');
    if (button) {
      show(`${button.textContent?.replace('MOCK', '').trim() || 'This action'} was simulated. No live change was made.`);
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href="#"]');
    if (link) {
      event.preventDefault();
      show(`${link.textContent?.trim() || 'This control'} is available as a safe preview.`);
      return;
    }
    const card = target.closest<HTMLElement>('.admin-stats article, .dashboard-card, .admin-right article');
    if (card) {
      admin.querySelectorAll('.mock-selected').forEach((item) => item.classList.remove('mock-selected'));
      card.classList.add('mock-selected');
    }
  };

  const onInput = (event: React.FormEvent<HTMLDivElement>) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches('.admin-v2 .table-head input')) return;
    const table = input.closest('.store-table');
    const query = input.value.trim().toLowerCase();
    table?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      row.hidden = Boolean(query) && !row.textContent?.toLowerCase().includes(query);
    });
  };

  return <div onClickCapture={onClick} onInput={onInput}>{children}{notice ? <div className="mock-mode-notice" role="status">Mock Mode · {notice}</div> : null}</div>;
}
