'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Crumb = { label: string; href?: string };

export function BrowseNav({ items, fallback = '/' }: { items: Crumb[]; fallback?: string }) {
  const router = useRouter();
  const goBack = () => {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const isExactParent = referrer?.origin === window.location.origin && `${referrer.pathname}${referrer.search}` === fallback;
    if (isExactParent) router.back(); else router.push(fallback);
  };

  return <div className="browse-nav" aria-label="Page navigation">
    <button type="button" onClick={goBack}><ArrowLeft size={15}/>Back</button>
    <Link href="/"><Home size={14}/>Home</Link>
    {items.map((item, index) => <span className="browse-crumb" key={`${item.label}-${index}`}><ChevronRight size={14}/>{item.href ? <Link href={item.href}>{item.label}</Link> : <b>{item.label}</b>}</span>)}
  </div>;
}
