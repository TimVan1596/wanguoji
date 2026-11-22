import Civil from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {rulerAbilities,militaryAbilities} from '../../Politics/PersonAbilities';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
/** Real capture/succession and royal-death hooks in a directed extinct-house fixture, never natural frequency. */
export function checkPoliticalContinuation(core:any,input:WorldSaveV1,personId:string,check:(v:unknown,label:string)=>void){
 const clock=(month:number)=>core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(input));Civil.setPolicyForSimulation('BASELINE');
  const term=Civil.getByPerson(personId).find(t=>t.endMonth===undefined)!,month=term.startMonth+60,team=core.teams.find((t:any)=>t.name===term.factionId),enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE');
  for(let m=input.world.worldMonth+12;m<=month;m+=12){clock(m);(Civil as any).applyGovernance(m,core.teams);}
  clock(month);const dy=Dynasty.get(team.name)!,old=Dynasty.getCurrentRuler(team.name)!;
  // Use actual recorded royal persons and the same production death hook; no invented predecessor/kin.
  for(const r of dy.rulers.filter(r=>r.id!==old.id&&r.status!=='dead'))Dynasty.recordNativeRoyalEntityDeath(r.id,month);
  const p=Military.getPerson(personId)!,user=team.getUserById(p.sourceUserId),before=exportWorldSave(core),identity={id:user.id,born:p.bornMonth,name:p.personalName,abilities:militaryAbilities(p)},write=History.addEvent;let failed=false;
  History.addEvent=function(e){const id=write.call(this,e);if(e.type==='ruler-succession'){random.next();throw Error('injected lawful continuation');}return id;};
  try{Dynasty.resolveCapturedRuler(team,enemy,month);}catch{failed=true;}finally{History.addEvent=write;}
  check(failed&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'lawful political continuation failure restores ruler, official, civil term, population, history and RNG');
  Dynasty.resolveCapturedRuler(team,enemy,month);
  const ruler=Dynasty.getCurrentRuler(team.name)!;
  check(ruler.residentIdentity?.succession?.kind==='EXTINCT_HOUSE_CONTINUATION'&&ruler.residentIdentity.personId===personId&&ruler.relationType==='NEW_HOUSE'&&!ruler.militaryUsurperIdentity,'an actually vacant royal line continues through the real senior civilian, never a fictitious usurpation');
  check(ruler.bornYear===identity.born&&ruler.residentIdentity?.personalName===identity.name&&team.rulerUser?.id===identity.id&&JSON.stringify(rulerAbilities(ruler,Military.getPeople()))===JSON.stringify(identity.abilities),'lawful new monarch retains permanent body, birth, name and abilities');
  check(!Civil.getByPerson(personId).some(t=>t.endMonth===undefined)&&!Military.getPerson(personId)!.appointments.some(a=>a.endMonth===undefined),'accession ends real civil and military powers without creating a fictional army');
  const saved=exportWorldSave(core);hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'lawful civilian continuation strictly reads with its exact political provenance');
  const forged=structuredClone(saved),r=(forged.dynasties.find(d=>d.factionId===team.name)!.rulers as any[]).find(r=>r.rulerId===ruler.id);r.residentIdentity.succession.candidate.eventIds=['invented'];let rejected=false;try{hydrateWorldSave(core,forged);}catch{rejected=true;}check(rejected,'strict read rejects fabricated previous political service');
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
