import { NextResponse } from 'next/server';

export async function GET() {
  const rows = [
    ['channel', 'audience', 'reach', 'engagements', 'status'],
    ['Instagram', '0', '0', '0', 'Not connected'],
    ['Facebook', '0', '0', '0', 'Not connected'],
    ['YouTube', '0', '0', '0', 'Not connected'],
    ['LinkedIn', '0', '0', '0', 'Not connected'],
  ];
  const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
  return new NextResponse(`${csv}\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="glonni-social-analytics.csv"', 'Cache-Control': 'no-store' } });
}
