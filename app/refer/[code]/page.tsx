import { redirect } from 'next/navigation';

export default async function ReferralLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referralCode = code.toUpperCase();
  if (!/^GLONNI-[A-Z0-9]{8}$/.test(referralCode)) redirect('/login?mode=signup&error=That+referral+link+is+invalid.');
  redirect(`/login?mode=signup&ref=${encodeURIComponent(referralCode)}`);
}
