import type { Metadata, Viewport } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { AdminMockMode } from '@/components/admin-mock-mode';
import { ActivityTracker } from '@/components/activity-tracker';
import { AdminTableScrollEnhancer } from '@/components/admin-table-scroll-enhancer';
import './globals.css';
import './glonni-design-tokens.css';
import './admin-sidebar.css';
import './admin-theme.css';
import './admin-stores.css';
import './admin-categories.css';
import './ai-command.css';
import './auth.css';
import './product-page.css';
import './customer-product.css';
import './admin-products.css';
import './admin-products-cleanup.css';
import './admin-product-detail.css';
import './admin-interactions.css';
import './customer-states.css';
import './customer-accessibility.css';
import './admin-dashstack-theme.css';
import './admin-support.css';
import './admin-activity.css';
import './customer-catalogue.css';
import './admin-figma-system.css';
import './admin-dashboard-figma.css';
import './admin-products-figma.css';
import './admin-stores-figma.css';
import './admin-categories-figma.css';
import './admin-shell-overrides.css';
import './finance-tax.css';
import './admin-table-scroll.css';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Glonni | Discover better deals',
  description: 'Provider-neutral product discovery and deals.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: identity } = await supabase
    .from('website_identity')
    .select('site_name,logo_url,default_language')
    .eq('id', 1)
    .maybeSingle();

  return (
    <html lang={identity?.default_language ?? 'en-IN'}>
      <body>
        <AdminTableScrollEnhancer />
        <ActivityTracker />
        <AdminMockMode>{children}</AdminMockMode>
        <SiteFooter siteName={identity?.site_name ?? 'Glonni'} logoUrl={identity?.logo_url ?? ''} />
      </body>
    </html>
  );
}
