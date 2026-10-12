import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { PlugZap } from 'lucide-react';

export default function AdPlatformsPage() {
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <div className="admin-title">
            <div><p>PAID GROWTH</p><h1>Ad Platforms</h1><span>Connected advertising accounts</span></div>
          </div>
          <section className="product-focused-page">
            <header><PlugZap /><div><h2>No ad accounts connected</h2><span>Connect an advertising account when its integration is ready.</span></div></header>
            <Link className="product-primary" href="/admin/integrations">View integrations</Link>
          </section>
        </main>
      </section>
    </main>
  );
}
