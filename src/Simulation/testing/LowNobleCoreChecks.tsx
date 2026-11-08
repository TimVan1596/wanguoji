import {Provider} from 'react-redux';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {store} from '../../store';
import {setTeams} from '../../store/rootSlice';
import Military,{deriveUserBornMonth} from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {getLocalUserId} from '../../Live/LocalDanmaku';
import {planFamilyPopulationEntry} from '../../Politics/MilitaryFamily';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
/** Controlled real captures and ordinary resident entry. Never a natural frequency sample. */
export async function checkLowMilitaryNobility(core:any,oneCapture:ReturnType<typeof exportWorldSave>,factionId:string,personId:string,secondCityId:string,check:(v:unknown,s:string)=>void){
 const resume=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(oneCapture));Military.setNobleMeritPolicyForSimulation('MEDIUM');
  const team=()=>core.teams.find((t:any)=>t.name===factionId),p=()=>Military.getPerson(personId)!,family=()=>Military.getFamilies().find(f=>f.founderPersonId===personId)!;
  clock(60);const population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),rng=JSON.stringify(random.exportState()),forms=JSON.stringify(Military.getFormations());
  Military.updateNobility(60,core.teams,Dynasty.getAll());check(p().nobilityHistory?.at(-1)?.rank==='NAN','one real distinct capture and two service years grant a sourced military NAN');
  Military.updateFamilies(60,core.teams,Dynasty.getAll());check(family()?.sourceEventId===p().nobilityHistory![0].eventId,'low military rank creates one charter with the actual personal grant source');
  Military.updateAppanages(60,core.teams,Dynasty.getAll(),core.allCities);check(!p().appanageHistory?.length&&population===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&rng===JSON.stringify(random.exportState())&&forms===JSON.stringify(Military.getFormations()),'low title creates no population, command, food estate or RNG draw');
  const u=team().getUserById(p().sourceUserId),command=p().appointments[0].commandId,city=core.allCities.find((c:any)=>c.id===secondCityId)!;
  clock(66);u.player.setPosition(city.block.x,city.block.y);u.player.Body.reset(u.player.x,u.player.y);city.capture(team(),66,undefined,command,personId);
  clock(72);const before=exportWorldSave(core),write=History.addEvent;
  History.addEvent=function(e){const id=write.call(this,e);if(e.type==='military-ennobled'){random.next();throw Error('injected low noble write');}return id;};try{Military.updateNobility(72,core.teams,Dynasty.getAll());}finally{History.addEvent=write;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'low-rank upgrade failure restores grant, original history and a consumed RNG draw');
  Military.updateNobility(72,core.teams,Dynasty.getAll());Military.updateFamilies(72,core.teams,Dynasty.getAll());check(p().nobilityHistory?.map(g=>g.rank).join(',')==='NAN,ZI'&&Military.getFamilies().filter(f=>f.founderPersonId===personId).length===1,'second distinct capture upgrades NAN to ZI in the same family without copying merit');
  const zi=exportWorldSave(core),bad=structuredClone(zi),grant=bad.registries.militaryCommandRegistry.people.find(p=>p.personId===personId)!.nobilityHistory!.at(-1)!;grant.rank='BO';const e=(bad.worldHistory.events as any[]).find((e:any)=>e.id===grant.eventId) as any;e.metadata.nobility=JSON.stringify(grant);check(!validateWorldSave(bad).valid,'strict save rejects a jointly forged higher low-rank grant and event');
  clock(73);Military.endPersonCommands(personId,73,'DISMISSED');check(p().status!=='ACTIVE'&&p().nobilityHistory?.at(-1)?.rank==='ZI','real office ending retains the existing ZI without further service or automatic promotion');
  clock(240);const populationSystem=core.simulator.population,t=team();
  while(t.users.size>=populationSystem.getCapacity(t)){const u=[...t.users].find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId&&!Military.getFormations().some(f=>f.status==='ACTIVE'&&f.memberUnitIds.includes(u.player.logicalUnitId??''))) as any;check(u,'real civilian supports bounded controlled capacity fixture');u.destroyUser(false,{cause:'GOD_ACTION',month:240});}
  let counter:number|undefined;
  for(let n=Math.max(1,(populationSystem.counters[factionId]??0)+1);n<5000;n++){const label=`${t.shortName??t.name}-${String(n).padStart(3,'0')}`,id=getLocalUserId(label),born=deriveUserBornMonth(id,label,factionId,240);if(core.teams.some((t:any)=>t.getUserById(id))||Military.getPeople().some(p=>p.sourceUserId===id)||Military.getFamilies().some(f=>f.members.some(m=>m.sourceUserId===id)))continue;const plan=planFamilyPopulationEntry(Military.getFamilies(),factionId,family().epochFounderId,id,born,240,String(random.exportState().seed));if(plan?.familyId===family().familyId){counter=n;break;}}
  check(counter!==undefined,'real ordinary population entry has a verifiable direct child of the new ZI holder');populationSystem.counters[factionId]=counter!-1;const child=populationSystem.spawn(t,undefined,false,{cause:'NATURAL_GROWTH',month:240});check(child?.familyMemberId&&!child.militaryPersonId,'actual low noble child is a resident without invented office');
  Military.updateFamilyTitles(240,core.teams,Dynasty.getAll());check(!family().nobleSuccession?.length,'living low noble does not transfer his title early');t.getUserById(p().sourceUserId).destroyUser(false,{cause:'BATTLE_DEATH',month:240});Military.updateFamilyTitles(240,core.teams,Dynasty.getAll());
  const act=family().nobleSuccession?.at(-1);check(act?.kind==='SUCCEEDED'&&act.previousRank==='ZI'&&act.rank==='NAN'&&family().members.find(m=>m.memberId===act.holderMemberId)?.sourceUserId===child.id,'real military ZI source descends to one already-registered civilian NAN');
  const inherited=exportWorldSave(core),host=document.createElement('div'),root=createRoot(host);document.body.append(host);try{store.dispatch(setTeams(core.teams));flushSync(()=>root.render(<Provider store={store}><MilitaryFamilyBrowser families={Military.getFamilies()} worldMonth={240} initialFamilyId={family().familyId} initialMemberId={child.familyMemberId} onClose={()=>{}}/></Provider>));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));check(document.body.textContent?.includes('男爵')&&document.body.textContent?.includes('未任军职'),'shared real family UI shows inherited NAN independently of military office');check(diffCanonicalWorldSave(inherited,exportWorldSave(core)).matched,'low noble family reading creates no new authority');}finally{flushSync(()=>root.unmount());host.remove();}
  clock(241);child.destroyUser(false,{cause:'BATTLE_DEATH',month:241});Military.updateFamilyTitles(241,core.teams,Dynasty.getAll());check(family().nobleSuccession?.at(-1)?.reason==='RANK_EXHAUSTED','real civilian NAN death ends an exhausted chain without creating another title');
  const ended=exportWorldSave(core);hydrateWorldSave(core,structuredClone(ended));check(diffCanonicalWorldSave(ended,exportWorldSave(core)).matched,'low military grants, civilian descent and exhausted chain strictly reread');
 }finally{hydrateWorldSave(core,structuredClone(resume));}
}
