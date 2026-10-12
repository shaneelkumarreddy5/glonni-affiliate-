import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Share2 } from 'lucide-react';

export default function SocialAccountsPage() {
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <div className="admin-title">
            <div><p>ORGANIC GROWTH</p><h1>Social Accounts</h1><span>Connected social profiles</span></div>
          </div>
          <section className="product-focused-page">
            <header><Share2 /><div><h2>No social accounts connected</h2><span>Connect a social profile when its integration is ready.</span></div></header>
            <Link className="product-primary" href="/admin/integrations">View integrations</Link>
          </section>
        </main>
      </section>
    </main>
  );
}
