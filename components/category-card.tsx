import { CategoryCard as SharedCategoryCard } from '@/components/ui/catalog-cards';

type Props = {
  href: string;
  name: string;
  imageUrl?: string | null;
  interactive?: boolean;
  className?: string;
};

export function CategoryCard({ href, name, imageUrl, interactive = true, className }: Props) {
  return <SharedCategoryCard href={href} name={name} imageUrl={imageUrl} interactive={interactive} className={className}/>;
}
