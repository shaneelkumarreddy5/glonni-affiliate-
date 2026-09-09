const rows = [
  ['Provider','Network','Period','Expected cashback','Approved','Pending','Disputed','Due date','Payment status'],
  ['Amazon Associates','Amazon','Sep 2026','420000','280000','110000','30000','15 Oct 2026','Pending confirmation'],
  ['Flipkart Affiliate','Flipkart','Sep 2026','280000','190000','70000','20000','10 Oct 2026','Approved by provider'],
  ['Myntra Affiliate','Myntra','Sep 2026','175000','120000','40000','15000','12 Oct 2026','Payment due'],
  ['Nykaa Affiliate','Nykaa','Sep 2026','120000','80000','30000','10000','08 Oct 2026','Partially paid'],
  ['AJIO Affiliate','AJIO','Sep 2026','95000','70000','20000','5000','20 Oct 2026','Paid'],
  ['Tata CLiQ Affiliate','Tata CLiQ','Sep 2026','58000','40000','15000','3000','18 Oct 2026','Disputed'],
];
export function GET(){
  const csv=rows.map(row=>row.map(value=>`"${value.replaceAll('"','""')}"`).join(',')).join('\n');
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="glonni-provider-receivables.csv"'}});
}
