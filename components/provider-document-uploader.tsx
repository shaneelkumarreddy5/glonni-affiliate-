"use client";

import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet,UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { attachFinanceProviderDocumentFile } from "@/app/admin/finance-tax/providers/actions";

const ACCEPTED=["application/pdf","image/jpeg","image/png","image/webp","text/csv","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const MAX_BYTES=15*1024*1024;

export function ProviderDocumentUploader({documentId,fileName}:{documentId:string;fileName:string|null}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const router=useRouter();
  async function upload(file?:File) {
    if(!file)return;
    setMessage("");
    if(!ACCEPTED.includes(file.type)||file.size<1||file.size>MAX_BYTES){setMessage("Choose a PDF, image, CSV or XLSX under 15 MB.");return;}
    setBusy(true);
    try {
      const client=createClient();
      const {data:{user},error:userError}=await client.auth.getUser();
      if(userError||!user)throw new Error("Your admin session expired. Sign in again.");
      const safe=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"provider-document";
      const path=`${documentId}/${crypto.randomUUID()}-${safe}`;
      const {error}=await client.storage.from("finance-provider-documents").upload(path,file,{contentType:file.type,upsert:false});
      if(error)throw error;
      const result=await attachFinanceProviderDocumentFile(documentId,path,file.name,file.type,file.size);
      if(!result.ok)throw new Error(result.message);
      setMessage(result.message);
      router.refresh();
    } catch(reason) {
      setMessage(reason instanceof Error?reason.message:"Upload failed. Retry the provider document.");
    } finally {
      setBusy(false);
      if(input.current)input.current.value="";
    }
  }
  return <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
    <input ref={input} type="file" accept={ACCEPTED.join(",")} disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/>
    {busy&&<small>Uploading privately…</small>}
    {fileName&&<small style={{display:"inline-flex",gap:5,alignItems:"center",color:"#277247"}}><FileSpreadsheet size={14}/>{fileName}</small>}
    {message&&<small role="status">{message}</small>}
    {!fileName&&<small style={{color:"#68758b"}}><UploadCloud size={13}/> Attach provider statement or tax document privately.</small>}
  </div>;
}
