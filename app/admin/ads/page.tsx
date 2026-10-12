import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { loadApprovedContentQueue } from '@/lib/admin-content-queue';
import { Image, Megaphone, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const platformName: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads' };

export default async function AdsPage() {
  const { queue, error } = await loadApprovedContentQueue('paid_ads');
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <div className="admin-title">
            <div><p>PAID GROWTH</p><h1>Ads Manager</h1><span>{queue.length} approved assets</span></div>
            <Link className="add-store" href="/admin/ad-platforms">Ad platform accounts</Link>
          </div>
          <section className="store-table">
            <div className="table-head"><h2>Approved ad assets</h2><Link href="/admin/content-manager">Content Manager</Link></div>
            {error ? (
              <div className="ads-queue-empty"><ShieldCheck /><b>Could not load approved assets</b><span>{error}</span></div>
            ) : queue.length ? (
              <div className="ads-queue-list">{queue.map(asset => {
                const snapshot = (asset.campaign?.offer_snapshot ?? {}) as Record<string, unknown>;
                const context = [snapshot.product, snapshot.store].filter(Boolean).join(' · ');
                return <article className="ads-queue-card" key={asset.id}>
                  <div className="ads-queue-image">{asset.mediaUrl ? <img src={asset.mediaUrl} alt="Approved ad creative" /> : <Image />}</div>
                  <div className="ads-queue-info">
                    <div><span className="ads-queue-pill">{platformName[asset.platform_key] ?? asset.platform_key}</span><b className="ads-queue-approved">Approved</b></div>
                    <h2>{asset.campaign?.title}</h2>
                    {context && <p>{context}</p>}
                    <strong>{asset.headline}</strong>
                    <span>{asset.description || asset.caption}</span>
                    <div className="ads-queue-links"><a href={asset.destination_url} target="_blank" rel="noreferrer">Review destination ↗</a><Link href="/admin/ad-platforms">Ad accounts</Link></div>
                  </div>
                </article>;
              })}</div>
            ) : (
              <div className="ads-queue-empty"><Megaphone /><b>No approved ad assets</b><Link href="/admin/content-manager">Open Content Manager</Link></div>
            )}
          </section>
        </main>
      </section>
    </main>
  );
}
