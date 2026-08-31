import { AdminMfaEnroll } from '@/components/admin-mfa-enroll';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}){const{next}=await searchParams;return <main className="admin-auth-page"><AdminMfaEnroll next={next}/></main>}
