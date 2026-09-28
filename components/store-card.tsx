import { StoreCard as SharedStoreCard } from '@/components/ui/catalog-cards';

type Props = {
  href: string;
  name: string;
  logoUrl?: string | null;
  interactive?: boolean;
};

export function StoreCard({ href, name, logoUrl, interactive = true }: Props) {
  return <SharedStoreCard href={href} name={name} logoUrl={logoUrl} interactive={interactive}/>;
}
