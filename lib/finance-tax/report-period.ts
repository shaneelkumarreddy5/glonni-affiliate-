import { addIsoDays, getLatestCompletedFiscalSelection, resolveFiscalPeriod } from './fiscal-period';

export type ReportPeriod={mode:'day'|'week'|'month'|'custom'|'quarter';start:string;end:string;label:string};

function isoDateInIndia(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function validDate(value:string|null) {
  if(!value||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function label(mode:string,start:string,end:string) {
  return start===end?`${mode[0].toUpperCase()}${mode.slice(1)} · ${start} `: `${mode[0].toUpperCase()}${mode.slice(1)} · ${start} to ${end}`;
}

export function resolveReportPeriod(params:{mode?:string|null;date?:string|null;from?:string|null;to?:string|null;fy?:string|null;q?:string|null},now=new Date()):ReportPeriod|null {
  const mode=params.mode??'quarter';
  const today=isoDateInIndia(now);
  let start:string,end:string;
  if(mode==='day') { start=validDate(params.date??null)?params.date!:today; end=start; }
  else if(mode==='week') {
    const selected=validDate(params.date??null)?params.date!:today;
    const [year,month,day]=selected.split('-').map(Number);
    const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay();
    const mondayOffset=(weekday+6)%7;
    start=addIsoDays(selected,-mondayOffset); end=addIsoDays(start,6);
  } else if(mode==='month') {
    const selected=validDate(params.date??null)?params.date!:today;
    const [year,month]=selected.split('-').map(Number);
    start=`${year}-${String(month).padStart(2,'0')}-01`;
    const next=new Date(Date.UTC(year,month,1));
    end=addIsoDays(next.toISOString().slice(0,10),-1);
  } else if(mode==='custom') {
    if(!validDate(params.from??null)||!validDate(params.to??null))return null;
    start=params.from!;end=params.to!;
    if(start>end)return null;
  } else if(mode==='quarter') {
    const latest=getLatestCompletedFiscalSelection();
    const period=resolveFiscalPeriod(params.fy??latest.fy,params.q??latest.q);
    if(!period)return null;
    start=period.start;end=period.end;
  } else return null;
  if(start>end)return null;
  return {mode:mode as ReportPeriod['mode'],start,end,label:label(mode,start,end)};
}
