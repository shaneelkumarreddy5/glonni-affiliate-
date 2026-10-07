"use client";

import { Printer } from "lucide-react";

export function ReportPrintButton() {
  return <button type="button" className="add-store" onClick={()=>window.print()}><Printer size={14} style={{verticalAlign:"middle",marginRight:5}}/>Print summary</button>;
}
