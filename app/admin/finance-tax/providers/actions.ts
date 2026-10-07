'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const base='/admin/finance-tax/providers';
const providerTypes=new Set(['affiliate_network','brand','voucher_bill_provider','payment_gateway','payout_provider','other']);
const documentKinds=new Set(['affiliate_statement','supplier_tax_invoice','sales_tax_invoice','payment_settlement','payout_statement','other']);
const flows=new Set(['inward','outward','settlement']);
const optional=(v:string)=>v||null;
const val=(data:FormData,key:string)=>String(data.get(key)??'').trim();
function fail(code:string):never { redirect(`${base}?notice=${code}`); }

async function requireFinanceAdmin() {
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([
    supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!user||assurance?.currentLevel!=='aal2') redirect('/admin/login?next=/admin/finance-tax/providers');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active') redirect('/admin/login?next=/admin/finance-tax/providers');
  return {supabase,user};
}

export async function createFinanceProviderDocument(formData:FormData) {
  const {supabase}=await requireFinanceAdmin();
  const providerType=val(formData,'providerType');
  let providerName=val(formData,'providerName');
  let providerKey=val(formData,'providerKey');
  const affiliateProviderId=val(formData,'affiliateProviderId');
  const merchantId=val(formData,'merchantId');
  const paymentProviderId=val(formData,'paymentProviderId');
  if((affiliateProviderId&&providerType!=='affiliate_network')||(merchantId&&providerType!=='brand')||
    (paymentProviderId&&providerType!=='payment_gateway')) fail('invalid_document');
  if(affiliateProviderId) {
    const {data}=await supabase.from('affiliate_providers').select('name,adapter_key').eq('id',affiliateProviderId).maybeSingle();
    if(!data) fail('invalid_document');
    providerName=data.name;providerKey=data.adapter_key;
  }
  if(merchantId) {
    const {data}=await supabase.from('merchants').select('name,slug').eq('id',merchantId).maybeSingle();
    if(!data) fail('invalid_document');
    providerName=data.name;providerKey=data.slug;
  }
  if(paymentProviderId) {
    const {data}=await supabase.from('payment_provider_configs').select('name,provider_key').eq('id',paymentProviderId).maybeSingle();
    if(!data) fail('invalid_document');
    providerName=data.name;providerKey=data.provider_key;
  }
  const documentKind=val(formData,'documentKind');
  const documentFlow=val(formData,'documentFlow');
  const periodStart=val(formData,'periodStart');
  const periodEnd=val(formData,'periodEnd');
  const invoiceDate=val(formData,'invoiceDate');
  const gstin=val(formData,'counterpartyGstin').toUpperCase();
  const amountKeys=['taxableValue','cgstAmount','sgstAmount','igstAmount','cessAmount','otherCharges','roundOff','documentTotal'];
  const nums=Object.fromEntries(amountKeys.map(key=>[key,Number(val(formData,key)||'0')]));
  if(!providerTypes.has(providerType)||!documentKinds.has(documentKind)||!flows.has(documentFlow)||
    providerName.length<2||providerName.length>200||providerKey.length>120||val(formData,'invoiceNumber').length>120||val(formData,'notes').length>2000||
    (periodStart&&!/^\d{4}-\d{2}-\d{2}$/.test(periodStart))||
    (periodEnd&&!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))||
    (periodStart&&!periodEnd)||(periodEnd&&!periodStart)||(periodStart&&periodEnd&&periodEnd<periodStart)||
    (invoiceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate))||
    (gstin&&gstin.length!==15)||
    amountKeys.some(key=>!Number.isFinite(nums[key])||(key!=='roundOff'&&nums[key]<0)||(key==='roundOff'&&Math.abs(nums[key])>100))||
    Math.abs(nums.documentTotal-(nums.taxableValue+nums.cgstAmount+nums.sgstAmount+nums.igstAmount+nums.cessAmount+nums.otherCharges+nums.roundOff))>.02) {
    fail('invalid_document');
  }
  const {data:id,error}=await supabase.rpc('create_finance_provider_document',{p_document:{
    providerType,providerName,providerKey:optional(providerKey),
    affiliateProviderId:optional(affiliateProviderId),
    merchantId:optional(merchantId),
    paymentProviderId:optional(paymentProviderId),
    documentKind,documentFlow,
    periodStart:optional(periodStart),periodEnd:optional(periodEnd),
    invoiceNumber:optional(val(formData,'invoiceNumber')),invoiceDate:optional(invoiceDate),
    counterpartyGstin:optional(gstin),...nums,currency:'INR',notes:optional(val(formData,'notes')),
  }});
  if(error||!id) fail('create_failed');
  revalidatePath(base);
  revalidatePath('/admin/finance-tax/transactions');
  redirect(`${base}?notice=document_saved&open=${id}`);
}

export async function recordFinanceProviderMatch(formData:FormData) {
  const {supabase}=await requireFinanceAdmin();
  const documentId=val(formData,'documentId');
  const selection=val(formData,'sourceSelection');
  const reportedAmount=Number(val(formData,'reportedAmount'));
  const note=val(formData,'matchNote');
  const sourceReference=val(formData,'sourceReference');
  if(!documentId||!Number.isFinite(reportedAmount)||reportedAmount<0||note.length<3||note.length>1000||sourceReference.length>160) fail('invalid_match');
  let error;
  if(selection==='manual') {
    ({error}=await supabase.rpc('record_manual_finance_provider_match',{
      p_document_id:documentId,p_source_reference:optional(sourceReference),p_reported_amount:reportedAmount,p_note:note,
    }));
  } else {
    const [sourceType,sourceId]=selection.split(':');
    if(!['affiliate_conversion','commerce_order','payout_item'].includes(sourceType)||! /^[0-9a-f-]{36}$/i.test(sourceId||'')) fail('invalid_match');
    ({error}=await supabase.rpc('record_finance_provider_document_match',{
      p_document_id:documentId,p_source_type:sourceType,p_source_id:sourceId,
      p_source_reference:optional(sourceReference),p_reported_amount:reportedAmount,p_note:note,
    }));
  }
  if(error) fail('match_failed');
  revalidatePath(base);
  redirect(`${base}?notice=match_saved&open=${documentId}`);
}

export async function attachFinanceProviderDocumentFile(documentId:string,path:string,fileName:string,mimeType:string,sizeBytes:number) {
  const {supabase}=await requireFinanceAdmin();
  const allowed=['application/pdf','image/jpeg','image/png','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if(!/^[0-9a-f-]{36}$/i.test(documentId)||!path.startsWith(`${documentId}/`)||fileName.length<1||fileName.length>255||
    !allowed.includes(mimeType)||!Number.isInteger(sizeBytes)||sizeBytes<1||sizeBytes>15728640) {
    return {ok:false,message:'Check the statement file type and size.'};
  }
  const {error}=await supabase.rpc('attach_finance_provider_document_file',{
    p_document_id:documentId,p_path:path,p_file_name:fileName,p_mime_type:mimeType,p_size_bytes:sizeBytes,
  });
  if(error) return {ok:false,message:'The private file could not be attached to this provider document.'};
  revalidatePath(base);
  return {ok:true,message:'Provider document saved privately.'};
}

export async function openFinanceProviderDocumentFile(formData:FormData) {
  const {supabase}=await requireFinanceAdmin();
  const documentId=val(formData,'documentId');
  const {data:doc}=await supabase.from('finance_provider_documents').select('document_path').eq('id',documentId).maybeSingle();
  if(!doc?.document_path) fail('document_missing');
  const {data,error}=await supabase.storage.from('finance-provider-documents').createSignedUrl(doc.document_path,60);
  if(error||!data?.signedUrl) fail('document_unavailable');
  redirect(data.signedUrl);
}

export async function voidFinanceProviderDocument(formData:FormData) {
  const {supabase}=await requireFinanceAdmin();
  const documentId=val(formData,'documentId');
  const reason=val(formData,'reason');
  if(!documentId||reason.length<5) fail('invalid_void');
  const {error}=await supabase.rpc('void_finance_provider_document',{p_document_id:documentId,p_reason:reason});
  if(error) fail('void_failed');
  revalidatePath(base);
  redirect(`${base}?notice=document_voided`);
}
