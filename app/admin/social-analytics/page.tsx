import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { BarChart3 } from 'lucide-react';

export default function SocialAnalyticsPage() {
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <div className="admin-title">
            <div><p>ORGANIC GROWTH</p><h1>Social Analytics</h1><span>Performance from connected social profiles</span></div>
          </div>
          <section className="product-focused-page">
            <header><BarChart3 /><div><h2>No analytics data available</h2><span>Connect a social profile to view its reporting here.</span></div></header>
            <Link className="product-primary" href="/admin/social-accounts">Manage social accounts</Link>
          </section>
        </main>
      </section>
    </main>
  );
}
