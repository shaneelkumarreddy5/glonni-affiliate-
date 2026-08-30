'use client';
import { BellRing, Check } from 'lucide-react';
import { useState } from 'react';
export function PriceAlertButton({ productTitle, price, compact = false }: { productTitle: string; price: number; compact?: boolean }) { const [enabled, setEnabled] = useState(false); function setAlert() { setEnabled(true); localStorage.setItem(`glonni-price-alert-${productTitle}`, JSON.stringify({ productTitle, targetPrice: price, createdAt: new Date().toISOString() })); } return <button className={`price-alert-button ${enabled ? 'enabled' : ''} ${compact ? 'compact' : ''}`} onClick={setAlert}>{enabled ? <><Check size={15} /> Demo alert set</> : <><BellRing size={15} /> Alert me at {`₹${price.toLocaleString('en-IN')}`}</>}</button>; }
