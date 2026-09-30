import { StoreCard as SharedStoreCard } from '@/components/ui/catalog-cards';
import type { ReactNode } from 'react';

type Props = {
  href: string;
  name: string;
  logoUrl?: string | null;
  meta?: ReactNode;
  layout?: 'stacked' | 'horizontal';
  interactive?: boolean;
  className?: string;
};

export function StoreCard({ href, name, logoUrl, meta, layout, interactive = true, className }: Props) {
  return <SharedStoreCard href={href} name={name} logoUrl={logoUrl} meta={meta} layout={layout} interactive={interactive} className={className}/>;
}
