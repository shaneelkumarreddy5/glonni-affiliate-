import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { AdminNavigation } from '@/components/admin-navigation';
import './globals.css';
import './admin-sidebar.css';
import './ai-command.css';
import './auth.css';
export const metadata: Metadata = { title: 'Glonni | Discover better deals', description: 'Provider-neutral product discovery and deals.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<AdminNavigation/><SiteFooter/></body></html>; }
