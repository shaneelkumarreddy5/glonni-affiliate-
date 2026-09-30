import { CategoryCard as SharedCategoryCard } from '@/components/ui/catalog-cards';

type Props = {
  href: string;
  name: string;
  imageUrl?: string | null;
  subtitle?: string;
  storeCount?: number | null;
  interactive?: boolean;
  className?: string;
};

export function CategoryCard({ href, name, imageUrl, subtitle, storeCount, interactive = true, className }: Props) {
  return <SharedCategoryCard href={href} name={name} imageUrl={imageUrl} subtitle={subtitle} storeCount={storeCount} interactive={interactive} className={className}/>;
}
