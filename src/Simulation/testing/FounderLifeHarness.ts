import {runMilitaryBalance} from "./MilitaryBalanceHarness";
import Dynasty from "../../Politics/Dynasty";
import random from "../WorldRandom";
import {RULER_LIFESPAN_BANDS} from "../../Politics/RulerLifespanRules";
import type {WorldSaveV20} from "../../Persistence/WorldSaveSchema";

/** Observes actual ruler creation and snapshots; never substitutes life or population rules. */
export async function runFounderLife(seed:string,years=100){
 const original=(Dynasty as any).createFormalRuler,created:any[]=[];
 (Dynasty as any).createFormalRuler=function(...args:any[]){
  const pick=random.pickIndex,draws:number[]=[],bounds:number[]=[];
  random.pickIndex=function(max:number){const value=pick.call(this,max);draws.push(value);bounds.push(max);return value;};
  try{
   const r=original.apply(this,args);
   if(args[5]!==undefined&&!args[6]){
    const band=bounds[0]===100?RULER_LIFESPAN_BANDS.find(b=>draws[0]<b.maxRoll):undefined;
    created.push({rulerId:r.id,accessionMonth:args[2],bornMonth:args[5],scheduledDeathMonth:r.naturalDeathYear,
      // Only z9's unconditional sampler has these two draws; candidate labels its changed sampler separately.
      legacySampleDeathMonth:band?args[5]+12*(band.minAgeYears+draws[1]):undefined});
   }
   return r;
  }finally{random.pickIndex=pick;}
 };
 try{
  const balance=await runMilitaryBalance(seed,years,true);
  const checkpoints=balance.checkpoints.map(c=>{
   const s=c.snapshot as WorldSaveV20,rulers=s.dynasties.flatMap(d=>d.rulers).filter(r=>r.accessionMonth!==undefined);
   const lives=rulers.map(r=>({id:r.rulerId,personId:r.residentIdentity?.personId,
    kind:r.residentIdentity?(r.residentIdentity.military?"MILITARY_FOUNDER":"RESIDENT_FOUNDER"):r.accessionMonth===0?"INITIAL":"SUCCESSOR",
    bornMonth:r.bornMonth,accessionMonth:r.accessionMonth,accessionAge:(r.accessionMonth!-r.bornMonth)/12,
    scheduledDeathMonth:r.naturalDeathMonth,deathMonth:r.deathMonth,deathReason:r.deathReason,
    endMonth:r.endMonth,status:r.status,observedMonths:c.month-r.accessionMonth!,
    tenureMonths:(r.endMonth??c.month)-r.accessionMonth!}));
   const {snapshot,...metrics}=c;return {metrics,lives};
  });
  return {seed,years,created,checkpoints};
 }finally{(Dynasty as any).createFormalRuler=original;}
}
