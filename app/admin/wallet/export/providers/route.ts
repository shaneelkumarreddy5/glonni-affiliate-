import { customerAdminClient } from '@/lib/admin-customers';
import { getProviderCommissionReport } from '@/lib/provider-commission-report';
import { financeCsvCell } from '@/lib/admin-finance';

export async function GET() {
  await customerAdminClient();
  const report = await getProviderCommissionReport();
  if (report.failed) return Response.json({ error: 'Commission report unavailable. Refresh and try again.' }, { status: 503 });
  const rows: (string | number)[][] = [
    ['Provider', 'Currency', 'Orders', 'Orders missing commission', 'Reported commission', 'Validated commission', 'Awaiting validation', 'Held', 'Rejected or cancelled'],
    ...report.summaries.map(row => [row.name, row.currency, row.orders, row.unpricedOrders, ...[row.reported, row.approved, row.pending, row.held, row.rejected].map(value => row.unpricedOrders ? '' : value)]),
  ];
  const csv = rows.map(row => row.map(financeCsvCell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="glonni-provider-commissions.csv"', 'Cache-Control': 'private, no-store' } });
}
