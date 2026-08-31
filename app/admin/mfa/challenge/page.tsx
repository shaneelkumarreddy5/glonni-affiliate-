import { AdminMfaChallenge } from '@/components/admin-mfa-challenge';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}){const{next}=await searchParams;return <main className="admin-auth-page"><AdminMfaChallenge next={next}/></main>}
