'use client';

import { useEffect } from 'react';

const cookie = (name: string) => document.cookie.split('; ').find((item) => item.startsWith(`${name}=`))?.split('=')[1] ?? '';

export function ActivityTracker() {
  useEffect(() => {
    const send = (eventType: string, target: Element) => {
      const label = target.getAttribute('data-activity') || target.getAttribute('aria-label') || target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) || target.tagName.toLowerCase();
      fetch('/api/activity', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType, label, sessionId: cookie('glonni_session_id'), deviceId: cookie('glonni_device_id'), path: window.location.pathname }) }).catch(() => undefined);
    };
    const click = (event: MouseEvent) => { const target = (event.target as Element | null)?.closest('a,button'); if (target) send('ui_click', target); };
    const submit = (event: Event) => { const target = event.target as HTMLFormElement | null; if (target?.tagName === 'FORM') send('ui_submit', target); };
    document.addEventListener('click', click, { capture: true });
    document.addEventListener('submit', submit, { capture: true });
    return () => { document.removeEventListener('click', click, { capture: true }); document.removeEventListener('submit', submit, { capture: true }); };
  }, []);
  return null;
}
