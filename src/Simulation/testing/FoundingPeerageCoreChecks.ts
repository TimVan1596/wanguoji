import Factions from '../FactionRegistry';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {selectFoundingNobleGrant} from '../../Politics/FoundingNobility';
import {checkPoliticalPeerageInheritance} from './PoliticalPeerageCoreChecks';
/** Controlled real uprising, actual pre-state City.capture receipts, formation and independent reward. */
export function checkFoundingPeerage(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(base));Military.setFamilyFoundationPolicyForSimulation('FOUNDING');const start=base.world.worldMonth;clock(start);
  const home=core.teams.find((t:any)=>t.cities.length>=4)!,city=home.cities.find((c:any)=>c!==home.capitalCity)!,rebel=Factions.createRebelFaction({city,year:start,factionType:'REBEL',godDriven:true})!;check(rebel,'real provisional faction and sovereign exist before opening-state military service');
  home.cities.find((c:any)=>c!==home.capitalCity)!.capture(rebel,start);for(const c of rebel.cities)c.loyalty=100;
  const id=rebel.name,prepare=start+60,formed=start+72,eventSystem=core.simulator.events;
  clock(prepare);eventSystem.checkStateFormation(prepare,core.teams,core.totalCells);
  let actor=[...rebel.users].find((u:any)=>(Military as any).isEligible(u,prepare)) as any;
  if(!actor){actor=core.teams.flatMap((t:any)=>[...t.users]).find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId&&!u.historicalPersonId&&u.bornMonth<=prepare-216&&(Military as any).isEligible(u,prepare));actor.setTeam(rebel,{cause:'LIVE_TRANSFER',month:prepare});}
  check((Military as any).appoint(actor,id,prepare,[actor.player.logicalUnitId]),'an existing nonroyal resident receives one actual pre-foundation XIAOWEI appointment');
  const personId=actor.militaryPersonId,command=Military.getPerson(personId)!.appointments.at(-1)!.commandId;
  const enemy=core.teams.find((t:any)=>t!==rebel&&t.status==='ACTIVE'&&t.capitalCity&&t.cities.length>=2)!,capital=enemy.capitalCity,other=enemy.cities.find((c:any)=>c!==capital)!;
  for(const [i,c]of [capital,other].entries()){clock(prepare+i+1);actor.player.setPosition(c.block.x,c.block.y);actor.player.body.reset(actor.player.x,actor.player.y);const unit=core.logicalUnitRegistry.getEntry(actor.player.logicalUnitId)!.state;unit.logicalX=c.block.x;unit.logicalY=c.block.y;c.capture(rebel,prepare+i+1,undefined,command,personId);}
  for(const c of rebel.cities)c.loyalty=100;clock(formed);eventSystem.checkStateFormation(formed,core.teams,core.totalCells);
  const dy=Dynasty.get(id)!,p=Military.getPerson(personId)!;check(rebel.identityStage==='STATE'&&History.getRecordedEvents().some(e=>e.type==='state-founded'),'actual continuity-qualified uprising formally becomes a kingdom');
  Military.updateNobility(formed,core.teams,Dynasty.getAll());check(!p.nobilityHistory,'short real service does not bypass original military peerage thresholds');
  const proposed=selectFoundingNobleGrant(Military.getPeople(),Military.getFormations(),History.getRecordedEvents(),formed,rebel,dy);check(proposed?.personId===personId&&proposed?.foundingMeritEventIds?.length===2,`two original pre-state victories including the enemy capital support one real opening-state peerage candidate: ${JSON.stringify({proposed,person:p,foundation:History.getRecordedEvents().filter(e=>e.type==='state-founded'),wins:History.getRecordedEvents().filter(e=>e.metadata?.commanderPersonId===personId),r:dy.rulers.find(r=>r.id===dy.currentRulerId)})}`);
  for(const mutation of [(p:any)=>p.royalIdentity={rulerId:'royal'},(p:any)=>p.politicalRulerId=dy.currentRulerId,(p:any)=>p.status='DEAD',(p:any)=>p.appointments.at(-1).startMonth=formed+1]){const people=structuredClone(Military.getPeople()),copy=people.find(p=>p.personId===personId)!;mutation(copy);check(!selectFoundingNobleGrant(people,Military.getFormations(),History.getRecordedEvents(),formed,rebel,dy),'royals, sovereigns, dead officers and post-founding appointments cannot claim opening-state rewards');}
  const before=exportWorldSave(core),writer=History.addEvent;History.addEvent=function(e){const written=writer.call(this,e);if(e.type==='founding-peerage-granted')throw Error('injected founding reward write');return written;};try{Military.updateFoundingRewards(formed,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'founding reward failure restores its people, titles, history and RNG without undoing the earlier real state formation');
  const population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=JSON.stringify(Military.getFormations());Military.updateFoundingRewards(formed,core.teams,Dynasty.getAll());const grant=p.nobilityHistory?.find(g=>g.basis==='FOUNDING');check(grant?.rank==='BO'&&grant.captureEventIds.length===0&&grant.foundingMeritEventIds?.length===2,'lawful founder monarch grants a distinct political BO backed by actual founding and battle receipts');
  check(population===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&commands===JSON.stringify(Military.getFormations()),'founding political award changes no population, army ownership, capacity or office');
  Military.updateFoundingRewards(formed,core.teams,Dynasty.getAll());check(p.nobilityHistory?.length===1,'one actual foundation can grant only one political peerage, even on a repeated update');Military.updateFamilies(formed,core.teams,Dynasty.getAll());check(Military.getFamilies().some(f=>f.founderPersonId===personId&&f.sourceEventId===grant?.eventId),'new political BO creates its real sourced nonroyal family');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'founding award and family pass exact source, issuer, chronology and deterministic candidate replay');
  for(const field of ['foundingEventId','foundingMeritEventIds','rank']){const bad=structuredClone(saved),g=bad.registries.militaryCommandRegistry.people.find(p=>p.personId===personId)!.nobilityHistory![0] as any;g[field]=field==='foundingMeritEventIds'?['invented']:field==='rank'?'GONG':'invented';const e=(bad.worldHistory.events as any[]).find(e=>e.id===g.eventId);e.metadata.nobility=JSON.stringify(g);check(!validateWorldSave(bad).valid,`strict save rejects forged opening-state ${field} even with rewritten event JSON`);}
  checkPoliticalPeerageInheritance(core,id,personId,check,formed+12);
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
