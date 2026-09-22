import { notFound } from 'next/navigation';
import { CeoOperationsPage } from '../ceo-page';
import { SpecialistAgentPage, specialistConfigs } from '../specialist-page';

export default async function AiAgentPage({ params, searchParams }: {
  params: Promise<{ agent: string }>;
  searchParams: Promise<{ tab?: string; agent?: string; success?: string; error?: string }>;
}) {
  const slug = (await params).agent;
  if (slug === 'ceo-operations') return <CeoOperationsPage searchParams={searchParams} />;
  if (!specialistConfigs[slug]) return notFound();
  return <SpecialistAgentPage slug={slug} searchParams={searchParams} />;
}
