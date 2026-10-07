export type FiscalSelection={fy:string;q:string};
export type FiscalPeriod={fy:string;q:string;start:string;end:string};

const DATE_ZONE='Asia/Kolkata';
const iso=(year:number,month:number,day:number)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

export function getLatestCompletedFiscalSelection(now=new Date()):FiscalSelection {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:DATE_ZONE,year:'numeric',month:'2-digit'}).formatToParts(now);
  const year=Number(parts.find(p=>p.type==='year')?.value);
  const month=Number(parts.find(p=>p.type==='month')?.value);
  let fyStart=month>=4?year:year-1;
  const currentQuarter=Math.floor((month>=4?month-4:month+8)/3)+1;
  let completedQuarter=currentQuarter-1;
  if(completedQuarter===0){completedQuarter=4;fyStart--;}
  return {fy:`${fyStart}-${String((fyStart+1)%100).padStart(2,'0')}`,q:String(completedQuarter)};
}

export function resolveFiscalPeriod(fy:string,q:string):FiscalPeriod|null {
  const match=/^(\d{4})-(\d{2})$/.exec(fy);
  const quarter=Number(q);
  if(!match||!Number.isInteger(quarter)||quarter<1||quarter>4)return null;
  const startYear=Number(match[1]);
  const endYear=Number(match[2]);
  if(endYear!==(startYear+1)%100||startYear<2010||startYear>2100)return null;
  const firstMonth=4+(quarter-1)*3;
  const year=startYear+Math.floor((firstMonth-1)/12);
  const month=((firstMonth-1)%12)+1;
  const afterQuarter=new Date(Date.UTC(year,month-1+3,1));
  const lastDay=new Date(afterQuarter.getTime()-86400000);
  return {fy,q:String(quarter),start:iso(year,month,1),end:iso(lastDay.getUTCFullYear(),lastDay.getUTCMonth()+1,lastDay.getUTCDate())};
}

export function fiscalYearOptions(currentFy:string,count=6):string[] {
  const start=Number(currentFy.slice(0,4));
  return Array.from({length:count},(_,i)=>{
    const year=start-i;
    return `${year}-${String((year+1)%100).padStart(2,'0')}`;
  });
}

export function addIsoDays(value:string,days:number):string {
  const [year,month,day]=value.split('-').map(Number);
  const next=new Date(Date.UTC(year,month-1,day+days));
  return iso(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
}
