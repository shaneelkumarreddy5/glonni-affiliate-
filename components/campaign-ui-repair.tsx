'use client';

import { useEffect } from 'react';

type Decision = 'held' | 'rejected';

export function CampaignUiRepair() {
  useEffect(() => {
    if (!window.location.pathname.startsWith('/admin/campaigns')) return;
    const kpis = document.querySelector<HTMLElement>('.campaign-kpis');
    if (kpis && !kpis.dataset.repaired) {
      kpis.dataset.repaired = 'true';
      const campaignRows = Array.from(document.querySelectorAll<HTMLElement>('.campaign-list article'));
      const count = (status: string) => campaignRows.filter(row => row.textContent?.toLowerCase().includes(status)).length;
      [['Awaiting approval', count('pending')], ['Live campaigns', count('published')]].forEach(([label, value]) => {
        const card = document.createElement('article'); card.innerHTML = `<span><b>${value}</b><small>${label}</small></span>`; kpis.append(card);
      });
    }
    const tabBar = document.querySelector<HTMLElement>('.recommendation-tabs');
    if (tabBar && !tabBar.dataset.repaired) {
      tabBar.dataset.repaired = 'true';
      const stages: Record<string, string> = { Recommended: 'recommendations', 'High cashback': 'high_cashback', 'Price drops': 'price_drops', Trending: 'trending', 'Needs review': 'needs_review', Campaigns: 'campaigns' };
      Array.from(tabBar.children).forEach((item) => {
        const label = item.textContent?.replace(/\d+/g, '').trim() || '';
        const link = document.createElement('a');
        link.className = item.tagName === 'B' ? 'active' : '';
        link.href = `/admin/campaigns?stage=${encodeURIComponent(stages[label] || 'recommendations')}`;
        link.innerHTML = item.innerHTML;
        item.replaceWith(link);
      });
    }
    const table = document.querySelector<HTMLElement>('.recommendation-table');
    const search = table?.querySelector<HTMLInputElement>('header label input');
    const placement = table?.querySelector<HTMLSelectElement>('header select');
    const risk = table?.querySelector<HTMLSelectElement>('header select:nth-of-type(2)');
    const filterRows = () => {
      const query = search?.value.trim().toLowerCase() || '';
      const placementValue = placement?.value.toLowerCase() || 'all placements';
      const riskValue = risk?.value.toLowerCase() || 'all risk levels';
      table?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
        const text = row.textContent?.toLowerCase() || '';
        row.hidden = Boolean(query && !text.includes(query)) || (placementValue !== 'all placements' && !text.includes(placementValue.replace('homepage ', ''))) || (riskValue !== 'all risk levels' && !text.includes(riskValue.replace('safe to promote', 'safe').replace('needs review', 'review')));
      });
    };
    search?.addEventListener('input', filterRows); placement?.addEventListener('change', filterRows); risk?.addEventListener('change', filterRows);
    const reviewForm = document.querySelector<HTMLFormElement>('.recommendation-review form');
    const offerId = reviewForm?.querySelector<HTMLInputElement>('input[name="offerId"]')?.value;
    if (reviewForm && offerId && !reviewForm.querySelector('[data-decision-actions]')) {
      const actions = document.createElement('div'); actions.dataset.decisionActions = 'true'; actions.className = 'campaign-decision-actions'; actions.innerHTML = '<b>Decision</b><button type="button" data-decision="held">Hold</button><button type="button" data-decision="rejected">Reject</button>';
      actions.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        const response = await fetch('/api/admin/campaign-decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId, decision: button.dataset.decision as Decision }) });
        if (response.ok) window.location.href = `/admin/campaigns?success=${encodeURIComponent(button.textContent || 'Decision')}%20recorded`;
        else { button.disabled = false; window.alert('The campaign decision could not be saved. Please try again.'); }
      }));
      reviewForm.append(actions);
    }
    return () => { search?.removeEventListener('input', filterRows); placement?.removeEventListener('change', filterRows); risk?.removeEventListener('change', filterRows); };
  }, []);
  return null;
}
