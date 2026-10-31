import Factions from '../FactionRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Controlled real founding; user-provided Dongyuan save is not available and is not claimed reproduced. */
export function checkStateFormationCore(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{for(const type of ['FRONTIER','REBEL','SPLIT'] as const){
  hydrateWorldSave(core,structuredClone(base));let month=base.world.worldMonth;
  const home=core.teams.find((t:any)=>t.cities.length>=4)!,city=home.cities.find((c:any)=>c!==home.capitalCity)!;
  const t=Factions.createRebelFaction({city,year:month,factionType:type,godDriven:true});check(t,`${type} uses real founding and its original royal identity`);if(!t)throw Error('founding failed');
  home.cities.find((c:any)=>c!==home.capitalCity)!.capture(t,month);
  for(const c of t.cities)c.loyalty=100;
  const id=t.name,origin=JSON.stringify(t.origin),ruler=Dynasty.getCurrentRuler(id)!.id,pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),events=(core.simulator as any).events;
  const at=(m:number)=>{core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});events.checkStateFormation(m,core.teams,core.totalCells);};
  month+=60;at(month);const rng=JSON.stringify(random.exportState());at(month+11);
  check(t.identityStage==='PROVISIONAL'&&JSON.stringify(random.exportState())===rng,`${type} waiting period does not form or consume naming RNG`);
  if(type==='FRONTIER'){
   t.cities.forEach(c=>c.loyalty=0);at(month+11);check(t.stateFormationEligibleSinceMonth===undefined,'frontier interruption resets its real continuous progress');
   t.cities.forEach(c=>c.loyalty=100);month+=12;at(month);
  }
  const saved=exportWorldSave(core),v=validateWorldSave(saved);check(v.valid,`${type} partial qualification strictly saves: ${v.errors.join(';')}`);
  hydrateWorldSave(core,structuredClone(saved));const resumed=core.teams.find((x:any)=>x.name===id)!;
  const frozen=exportWorldSave(core),writer=History.addEvent;
  History.addEvent=function(e){const result=writer.call(this,e);if(e.type==='state-founded')throw Error('injected formation write');return result;};
  try{at(month+12);}finally{History.addEvent=writer;}
  // Calendar itself is outside the political transaction; compare at the same canonical month.
  core.simulator.clock.importState({worldMonth:frozen.world.worldMonth,elapsedMs:0,running:false});check(diffCanonicalWorldSave(frozen,exportWorldSave(core)).matched,`${type} failed formal write restores identity, dynasty, history and RNG`);
  at(month+12);check(resumed.identityStage==='STATE'&&resumed.sovereigntyRank==='KING'&&resumed.name===id&&JSON.stringify(resumed.origin)===origin,`${type} becomes a kingdom retaining ID and origin`);
  check(Dynasty.getCurrentRuler(id)!.id===ruler&&pop===core.teams.reduce((n:number,t:any)=>n+t.users.size,0),`${type} formalization creates no second ruler or residents`);
  const n=History.getEventsForFaction(id).filter(e=>e.type==='state-founded').length;at(month+13);check(n===1&&History.getEventsForFaction(id).filter(e=>e.type==='state-founded').length===1,`${type} formalization writes exactly one state event`);
  const final=exportWorldSave(core);check(validateWorldSave(final).valid,`${type} kingdom passes strict V38 validation`);hydrateWorldSave(core,structuredClone(final));check(diffCanonicalWorldSave(final,exportWorldSave(core)).matched,`${type} formed state reads again without identity drift`);
 }}finally{hydrateWorldSave(core,structuredClone(base));}
}
