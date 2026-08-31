'use client';
import { useEffect } from 'react';
export function AdminNavigation(){useEffect(()=>{document.querySelectorAll<HTMLAnchorElement>('.admin-v2 .admin-side a[href="#"]').forEach((link)=>{const label=link.textContent?.trim();if(label==='Users')link.href='/admin/users';if(label==='Dashboard')link.href='/admin/dashboard';if(label==='Wallet & Payouts')link.href='/admin/wallet';if(label==='Offers & Rewards')link.href='/admin/offers';});},[]);return null;}
