import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Glonni | Discover better deals', description: 'Provider-neutral product discovery and deals.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
