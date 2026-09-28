import { CategoryCard as SharedCategoryCard } from '@/components/ui/catalog-cards';

type Props = {
  href: string;
  name: string;
  imageUrl?: string | null;
  storeCount?: number | null;
  interactive?: boolean;
};

export function CategoryCard({ href, name, imageUrl, storeCount, interactive = true }: Props) {
  return <SharedCategoryCard href={href} name={name} imageUrl={imageUrl} storeCount={storeCount} interactive={interactive}/>;
}
