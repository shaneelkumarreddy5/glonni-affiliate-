import Link from 'next/link';
import { X } from 'lucide-react';

export type CustomerFilterChip = { label: string; href: string };

export function CustomerFilterChips({ chips }: { chips: CustomerFilterChip[] }) {
  if (!chips.length) return null;
  return <div className="customer-filter-chips" aria-label="Active filters">
    {chips.map((chip, index) => <Link href={chip.href} key={`${chip.label}-${index}`} aria-label={`Remove filter: ${chip.label}`}>
      <span>{chip.label}</span><X size={15} aria-hidden="true"/>
    </Link>)}
  </div>;
}
