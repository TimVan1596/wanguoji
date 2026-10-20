/** Reading selection only: canonical facts and complete archives are never edited. */
export function selectChronicleHighlights<T>(items: readonly T[], limit: number, describe: (item:T)=>{
  id:string; month:number; priority:number; cityId?:string; diversityGroup?:string;
}, range?: {start:number;end:number}) {
  const capacity=Math.max(0,Math.floor(limit));
  const rows=items.map(item=>({item,...describe(item)}));
  const chronological=(a:typeof rows[number],b:typeof rows[number])=>a.month-b.month||a.id.localeCompare(b.id);
  if(rows.length<=capacity)return rows.sort(chronological).map(r=>r.item);
  const start=range?.start??Math.min(...rows.map(r=>r.month)),end=range?.end??Math.max(...rows.map(r=>r.month));
  const period=(month:number)=>Math.min(2,Math.max(0,Math.floor((month-start)*3/Math.max(1,end-start+1))));
  const selected:typeof rows=[],remaining=[...rows];
  while(selected.length<capacity&&remaining.length){
    const value=(r:typeof rows[number])=>r.priority+
      (selected.some(s=>period(s.month)===period(r.month))?0:60)-
      (r.diversityGroup?selected.filter(s=>s.diversityGroup===r.diversityGroup).length*220:0)-
      (r.cityId&&selected.some(s=>s.cityId===r.cityId)?80:0);
    remaining.sort((a,b)=>value(b)-value(a)||chronological(a,b));
    selected.push(remaining.shift()!);
  }
  return selected.sort(chronological).map(r=>r.item);
}
