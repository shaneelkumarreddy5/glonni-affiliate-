"use client";

import { useState } from "react";

type ExpenseLine = {
  description: string; hsnSac: string; quantity: string; unitName: string;
  assessableValue: string; gstTreatment: string; gstRatePercent: string;
  cgstRatePercent: string; sgstRatePercent: string; igstRatePercent: string; cessRatePercent: string;
  cgstAmount: string; sgstAmount: string; igstAmount: string; cessAmount: string;
};
const blankLine = (): ExpenseLine => ({
  description: "", hsnSac: "", quantity: "1", unitName: "unit", assessableValue: "",
  gstTreatment: "unclassified", gstRatePercent: "", cgstRatePercent: "", sgstRatePercent: "",
  igstRatePercent: "", cessRatePercent: "", cgstAmount: "0", sgstAmount: "0", igstAmount: "0", cessAmount: "0",
});
const treatments = [
  ["unclassified","Not classified"],["taxable","Taxable"],["exempt","Exempt"],
  ["nil_rated","Nil rated"],["zero_rated","Zero rated"],["outside_scope","Outside scope"],
  ["reverse_charge","Reverse charge"],["other","Other / adviser guidance"],
] as const;

export function ExpenseLinesEditor() {
  const [lines,setLines] = useState<ExpenseLine[]>([blankLine()]);
  const update = (index:number,key:keyof ExpenseLine,value:string) =>
    setLines(current=>current.map((line,i)=>i===index?{...line,[key]:value}:line));
  return <section style={{borderTop:"1px solid #e5e9f0",paddingTop:16,marginTop:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
      <div><b>Invoice lines</b><small style={{display:"block",color:"#68758b",marginTop:4}}>Enter the line wording, HSN/SAC and GST amounts exactly as shown on the supplier document.</small></div>
      <button type="button" className="add-store" disabled={lines.length>=30} onClick={()=>setLines(current=>[...current,blankLine()])}>Add line</button>
    </div>
    <input type="hidden" name="lines" value={JSON.stringify(lines)} />
    <div style={{display:"grid",gap:12,marginTop:12}}>
      {lines.map((line,index)=><fieldset key={index} style={{border:"1px solid #e5e9f0",borderRadius:8,padding:12,minWidth:0}}>
        <legend style={{fontSize:12,fontWeight:700}}>Line {index+1}</legend>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:9}}>
          <label>Description<input required maxLength={300} value={line.description} onChange={e=>update(index,"description",e.target.value)} /></label>
          <label>HSN / SAC<input maxLength={24} value={line.hsnSac} onChange={e=>update(index,"hsnSac",e.target.value)} /></label>
          <label>GST treatment<select value={line.gstTreatment} onChange={e=>update(index,"gstTreatment",e.target.value)}>{treatments.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,marginTop:9}}>
          <label>Quantity<input type="number" min="0.001" step="0.001" required value={line.quantity} onChange={e=>update(index,"quantity",e.target.value)} /></label>
          <label>Unit<input maxLength={40} value={line.unitName} onChange={e=>update(index,"unitName",e.target.value)} /></label>
          <label>Taxable / assessable value (₹)<input type="number" min="0" step="0.01" required value={line.assessableValue} onChange={e=>update(index,"assessableValue",e.target.value)} /></label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:9,marginTop:9}}>
          {(["gstRatePercent","cgstRatePercent","sgstRatePercent","igstRatePercent","cessRatePercent"] as const).map((key)=><label key={key}>{key.replace("Percent","").replace(/([A-Z])/g," $1")} %<input type="number" min="0" max="100" step="0.0001" value={line[key]} onChange={e=>update(index,key,e.target.value)} /></label>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:9,marginTop:9}}>
          {(["cgstAmount","sgstAmount","igstAmount","cessAmount"] as const).map((key)=><label key={key}>{key.replace("Amount","").toUpperCase()} (₹)<input type="number" min="0" step="0.01" value={line[key]} onChange={e=>update(index,key,e.target.value)} /></label>)}
        </div>
        {lines.length>1&&<button type="button" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))} style={{marginTop:8,color:"#a63d36",border:0,background:"transparent",cursor:"pointer"}}>Remove line</button>}
      </fieldset>)}
    </div>
  </section>;
}
