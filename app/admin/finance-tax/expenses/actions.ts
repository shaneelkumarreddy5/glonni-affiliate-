'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const base = '/admin/finance-tax/expenses';
const categories = new Set(['hosting_software','advertising','payment_processing','professional_services','office','travel','hardware','telecom','banking','other']);
const treatments = new Set(['unclassified','taxable','exempt','nil_rated','zero_rated','outside_scope','reverse_charge','other']);
const statuses = new Set(['eligible','partially_eligible','ineligible','not_applicable']);
const numericFields = ['quantity','assessableValue','gstRatePercent','cgstRatePercent','sgstRatePercent','igstRatePercent','cessRatePercent','cgstAmount','sgstAmount','igstAmount','cessAmount'] as const;

async function requireFinanceAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login?next=/admin/finance-tax/expenses');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner','admin'].includes(profile.role) || employee?.status !== 'active') redirect('/admin/login?next=/admin/finance-tax/expenses');
  return { supabase, user };
}

const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const optional = (text: string) => text || null;
function fail(code: string): never { redirect(`${base}?notice=${code}`); }

export async function createBusinessExpense(formData: FormData) {
  const { supabase } = await requireFinanceAdmin();
  const category = field(formData,'category');
  const vendorName = field(formData,'vendorName');
  const description = field(formData,'description');
  const expenseDate = field(formData,'expenseDate');
  const invoiceDate = field(formData,'invoiceDate');
  const invoiceTotal = Number(field(formData,'invoiceTotal'));
  const otherCharges = Number(field(formData,'otherCharges') || '0');
  const roundOff = Number(field(formData,'roundOff') || '0');
  if (!categories.has(category) || vendorName.length < 2 || vendorName.length > 200 ||
      description.length < 2 || description.length > 500 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ||
      (invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) ||
      !Number.isFinite(invoiceTotal) || invoiceTotal < 0 ||
      !Number.isFinite(otherCharges) || otherCharges < 0 ||
      !Number.isFinite(roundOff) || Math.abs(roundOff) > 100) fail('invalid_expense');

  let rawLines: unknown;
  try { rawLines = JSON.parse(field(formData,'lines')); } catch { fail('invalid_lines'); }
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 30) fail('invalid_lines');
  const lines = rawLines.map((value: any) => {
    const description = String(value.description ?? '').trim();
    const treatment = String(value.gstTreatment ?? 'unclassified');
    const row: Record<string, unknown> = {
      description,
      hsnSac: optional(String(value.hsnSac ?? '').trim()),
      quantity: Number(value.quantity || 1),
      unitName: optional(String(value.unitName ?? '').trim()),
      assessableValue: Number(value.assessableValue),
      gstTreatment: treatments.has(treatment) ? treatment : 'unclassified',
    };
    for (const name of numericFields.slice(2)) {
      const raw = value[name];
      row[name] = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      if (row[name] !== null && (!Number.isFinite(row[name] as number) || (row[name] as number) < 0 || (name.endsWith('RatePercent') && (row[name] as number) > 100))) fail('invalid_lines');
    }
    row.quantity = Number(value.quantity || 1);
    if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity <= 0 ||
        typeof row.assessableValue !== 'number' || !Number.isFinite(row.assessableValue) || row.assessableValue < 0 ||
        description.length < 2 || description.length > 300) fail('invalid_lines');
    return row;
  });

  const { data: expenseId, error } = await supabase.rpc('create_business_expense_with_lines', {
    p_expense: {
      expenseDate, category, vendorName,
      vendorGstin: optional(field(formData,'vendorGstin').toUpperCase()),
      invoiceNumber: optional(field(formData,'invoiceNumber')),
      invoiceDate: optional(invoiceDate),
      invoiceType: field(formData,'invoiceType') || 'other',
      placeOfSupplyState: optional(field(formData,'placeOfSupplyState')),
      description, invoiceTotal, otherCharges, roundOff,
    },
    p_lines: lines,
  });
  if (error || !expenseId) fail('create_failed');
  revalidatePath(base);
  revalidatePath('/admin/finance-tax/transactions');
  redirect(`${base}?notice=expense_saved&open=${expenseId}`);
}

export async function reviewBusinessExpenseLine(formData: FormData) {
  const { supabase } = await requireFinanceAdmin();
  const lineId = field(formData,'lineId');
  const status = field(formData,'status');
  const eligibleAmount = Number(field(formData,'eligibleAmount') || '0');
  const note = field(formData,'note');
  if (!lineId || !statuses.has(status) || !Number.isFinite(eligibleAmount) || eligibleAmount < 0 || note.length < 3) fail('invalid_review');
  const { error } = await supabase.rpc('review_business_expense_line', {
    p_line_id: lineId, p_status: status, p_eligible_amount: eligibleAmount, p_note: note,
  });
  if (error) fail('review_failed');
  revalidatePath(base);
  redirect(`${base}?notice=review_saved&open=${field(formData,'expenseId')}`);
}

export async function attachBusinessExpenseDocument(expenseId: string, path: string, name: string, mimeType: string, sizeBytes: number) {
  const { supabase } = await requireFinanceAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(expenseId) || !path.startsWith(`${expenseId}/`) ||
      name.length < 1 || name.length > 255 || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10485760 ||
      !['application/pdf','image/jpeg','image/png','image/webp'].includes(mimeType)) {
    return { ok: false, message: 'Check the invoice file name, type and size.' };
  }
  const { error } = await supabase.rpc('attach_business_expense_document', {
    p_expense_id: expenseId, p_path: path, p_name: name, p_mime_type: mimeType, p_size_bytes: sizeBytes,
  });
  if (error) return { ok: false, message: 'The private upload could not be attached to this invoice.' };
  revalidatePath(base);
  return { ok: true, message: 'Invoice file saved privately.' };
}

export async function openBusinessExpenseDocument(formData: FormData) {
  const { supabase } = await requireFinanceAdmin();
  const expenseId = field(formData,'expenseId');
  const { data: expense } = await supabase.from('business_expenses').select('document_path').eq('id',expenseId).maybeSingle();
  if (!expense?.document_path) fail('document_missing');
  const { data, error } = await supabase.storage.from('finance-expense-invoices').createSignedUrl(expense.document_path,60);
  if (error || !data?.signedUrl) fail('document_unavailable');
  redirect(data.signedUrl);
}

export async function voidBusinessExpense(formData: FormData) {
  const { supabase } = await requireFinanceAdmin();
  const expenseId = field(formData,'expenseId');
  const reason = field(formData,'reason');
  if (!expenseId || reason.length < 5) fail('invalid_void');
  const { error } = await supabase.rpc('void_business_expense',{p_expense_id:expenseId,p_reason:reason});
  if (error) fail('void_failed');
  revalidatePath(base);
  revalidatePath('/admin/finance-tax/transactions');
  redirect(`${base}?notice=expense_voided`);
}
