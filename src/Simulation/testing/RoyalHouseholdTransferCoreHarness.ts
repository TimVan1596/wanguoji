import {createNaturalCore} from './NaturalCoreHarness';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import {householdBirthParents,householdBirthPlan,observeRoyalBirthPlanning} from '../../Politics/RoyalHouseholdBirth';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
/** Predetermined seed, real living royal bridge and real User transfer/death. Not natural frequency. */
export async function runRoyalHouseholdTransferCore(seed='royal-military-z11'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);},clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  core.setWorldRunning(false);clock(12);Dynasty.setRoyalBirthPolicyForSimulation('HIGH');
  let choice:any;
  for(const t of core.teams){const d=Dynasty.get(t.name);if(!d)continue;const parents=householdBirthParents(d,12);for(const c of Dynasty.getRoyalMilitaryCandidates(t,12)){const r=parents.find(r=>r.id===c.rulerId);if(!r)continue;const epoch=d.houseEpochs!.at(-1)!.foundingRulerId;for(let due=12;due<72;due++)if(due-r.bornYear>=240&&due-r.bornYear<=600&&r.naturalDeathYear!>due&&householdBirthPlan(r,due,seed,'HIGH',epoch,0)){choice={t,d,c,r,due};break;}if(choice)break;}if(choice)break;}
  check(choice,'fixed initial royal has a real possible delivery before transfer');const {t,d,c,r,due}=choice;check(Dynasty.enlistRoyalMilitary(c,t,12,[]),'parent has an actual unique military User before transfer');clock(due);
  const original=exportWorldSave(core),u=t.getUserById(r.militaryIdentity.sourceUserId),foreign=core.teams.find(x=>x!==t&&x.status==='ACTIVE')!,pop=core.teams.reduce((n,t)=>n+t.users.size,0);
  check(householdBirthParents(d,due).some(x=>x.id===r.id),'parent qualified before the real transfer');u.setTeam(foreign,{cause:'LIVE_TRANSFER',month:due});let entered=false;observeRoyalBirthPlanning((_d,_m,parents)=>{if(_d.factionId===t.name)entered=parents.some(p=>p.id===r.id);});Dynasty.updateRoyalHouseholds(due,[t]);observeRoyalBirthPlanning(undefined);
  check(!entered&&!d.rulers.some((x:any)=>x.householdBirth?.parentId===r.id),'actual foreign transfer cancels old-court delivery without materializing a child');check(foreign.getUserById(u.id)===u&&pop===core.teams.reduce((n,t)=>n+t.users.size,0)&&Military.getPerson(r.militaryIdentity.personId)?.factionId===foreign.name,'transfer retains the one real parent, population and permanent military identity');const transferred=exportWorldSave(core);hydrateWorldSave(core,structuredClone(transferred));
  hydrateWorldSave(core,structuredClone(original));const restored=Dynasty.get(t.name)!,owner=core.teams.find(x=>x.name===t.name)!,parent=restored.rulers.find(x=>x.id===r.id)!;owner.getUserById(parent.militaryIdentity!.sourceUserId)!.destroyUser(false,{cause:'BATTLE_DEATH',month:due});Dynasty.updateRoyalHouseholds(due,[owner]);check(!restored.rulers.some(x=>x.householdBirth?.parentId===parent.id),'actual father death before delivery cannot create a posthumously backfilled child');exportWorldSave(core);
  return {seed,checks,scope:'controlled actual Core parent transfer and death before the keyed delivery month; no imaginary children, no natural-frequency claim'};
 }finally{observeRoyalBirthPlanning(undefined);game.destroy(true);}
}
