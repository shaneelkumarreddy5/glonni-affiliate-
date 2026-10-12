import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { loadApprovedContentQueue } from '@/lib/admin-content-queue';
import { Image, Share2, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const platformName: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook' };

export default async function SocialMediaManagerPage() {
  const { queue, error } = await loadApprovedContentQueue('social');
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <div className="admin-title">
            <div><p>ORGANIC GROWTH</p><h1>Social Media Manager</h1><span>{queue.length} approved assets</span></div>
            <Link className="add-store" href="/admin/social-accounts">Social accounts</Link>
          </div>
          <section className="store-table">
            <div className="table-head"><h2>Approved social assets</h2><Link href="/admin/content-manager">Content Manager</Link></div>
            {error ? (
              <div className="ads-queue-empty"><ShieldCheck /><b>Could not load approved assets</b><span>{error}</span></div>
            ) : queue.length ? (
              <div className="social-queue-list">{queue.map(asset => {
                const snapshot = (asset.campaign?.offer_snapshot ?? {}) as Record<string, unknown>;
                const context = [snapshot.product, snapshot.store].filter(Boolean).join(' · ');
                return <article className="social-queue-card" key={asset.id}>
                  <div className="social-queue-image">{asset.mediaUrl ? <img src={asset.mediaUrl} alt="Approved social creative" /> : <Image />}</div>
                  <div className="social-queue-info">
                    <div><span className="ads-queue-pill">{platformName[asset.platform_key] ?? asset.platform_key}</span><b className="ads-queue-approved">Approved</b></div>
                    <h3>{asset.campaign?.title}</h3>
                    {context && <p>{context}</p>}
                    <strong>{asset.headline}</strong>
                    <p>{asset.caption || asset.description}</p>
                    <div className="ads-queue-links"><a href={asset.destination_url} target="_blank" rel="noreferrer">Review destination ↗</a><Link href="/admin/social-accounts">Social accounts</Link><Link href="/admin/content-manager">Source content</Link></div>
                  </div>
                </article>;
              })}</div>
            ) : (
              <div className="ads-queue-empty"><Share2 /><b>No approved social assets</b><Link href="/admin/content-manager">Open Content Manager</Link></div>
            )}
          </section>
        </main>
      </section>
    </main>
  );
}
