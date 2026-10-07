"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { attachBusinessExpenseDocument } from "@/app/admin/finance-tax/expenses/actions";

const ACCEPTED = ["application/pdf","image/jpeg","image/png","image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function ExpenseInvoiceUploader({expenseId,documentName}:{expenseId:string;documentName:string|null}) {
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function upload(file?:File) {
    if(!file) return;
    setMessage("");
    if(!ACCEPTED.includes(file.type)||file.size<1||file.size>MAX_BYTES) {
      setMessage("Choose a PDF, JPG, PNG or WebP under 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const supabase=createClient();
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user) throw new Error("Your admin session expired. Sign in again.");
      const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"invoice";
      const path=`${expenseId}/${crypto.randomUUID()}-${safeName}`;
      const {error}=await supabase.storage.from("finance-expense-invoices").upload(path,file,{contentType:file.type,upsert:false});
      if(error) throw error;
      const result=await attachBusinessExpenseDocument(expenseId,path,file.name,file.type,file.size);
      if(!result.ok) throw new Error(result.message);
      setMessage(result.message);
      router.refresh();
    } catch(reason) {
      setMessage(reason instanceof Error?reason.message:"Upload failed. Retry the invoice file.");
    } finally {
      setBusy(false);
      if(input.current) input.current.value="";
    }
  }
  return <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
    <input ref={input} type="file" accept={ACCEPTED.join(",")} disabled={busy} onChange={e=>void upload(e.target.files?.[0])} />
    {busy&&<small>Uploading privately…</small>}
    {documentName&&<small style={{display:"inline-flex",gap:5,alignItems:"center",color:"#277247"}}><FileText size={14}/>{documentName}</small>}
    {message&&<small role="status">{message}</small>}
    {!documentName&&<small style={{color:"#68758b"}}>Private invoice file; admins only.</small>}
  </div>;
}
