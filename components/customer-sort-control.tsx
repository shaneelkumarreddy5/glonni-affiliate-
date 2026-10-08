'use client';

import { ArrowDownUp, ChevronDown } from 'lucide-react';

type SortOption = { value: string; label: string };
type SortParams = Record<string, string | string[] | undefined>;

export function CustomerSortControl({ action, value, params, options }: {
  action: string;
  value: string;
  params: SortParams;
  options: SortOption[];
}) {
  const hiddenFields = Object.entries(params).filter(([key, fieldValue]) => key !== 'sort' && key !== 'page' && fieldValue);
  return <form action={action} method="get" className="customer-sort-control">
    {hiddenFields.flatMap(([key, fieldValue]) => Array.isArray(fieldValue)
      ? fieldValue.map((entry, index) => <input type="hidden" name={key} value={entry} key={`${key}-${index}`}/>)
      : <input type="hidden" name={key} value={fieldValue} key={key}/>)}
    <ArrowDownUp size={20} aria-hidden="true"/>
    <label htmlFor={`customer-sort-${action.replace(/[^a-z0-9]/gi, '-')}`}>Sort:</label>
    <select id={`customer-sort-${action.replace(/[^a-z0-9]/gi, '-')}`} name="sort" value={value} onChange={(event) => event.currentTarget.form?.requestSubmit()} aria-label="Sort results">
      {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
    <ChevronDown size={17} aria-hidden="true"/>
  </form>;
}
