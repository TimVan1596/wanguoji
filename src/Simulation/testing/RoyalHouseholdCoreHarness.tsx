import {createNaturalCore} from './NaturalCoreHarness';
import {Provider} from 'react-redux';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {store} from '../../store';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {householdBirthParents,householdBirthPlan} from '../../Politics/RoyalHouseholdBirth';
import {posthumousPeerage} from '../../Politics/PosthumousPeerage';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import GenealogyBrowser from '../../UI/Components/FactionDetails/GenealogyBrowser';
import PosthumousPeeragePanel from '../../UI/Components/FactionDetails/PosthumousPeeragePanel';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
export async function runRoyalHouseholdCore(seed='royal-military-z11'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);},clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  core.setWorldRunning(false);Dynasty.setRoyalBirthPolicyForSimulation('HIGH');clock(12);
  const options=core.teams.flatMap(t=>Dynasty.getRoyalMilitaryCandidates(t,12).map(c=>({t,c,r:Dynasty.get(t.name)!.rulers.find(r=>r.id===c.rulerId)!}))).filter(x=>x.r.bornYear>-360&&!Dynasty.get(x.t.name)!.rulers.some(r=>r.parentId===x.r.id));
  options.sort((a,b)=>Number(Dynasty.get(a.t.name)!.heirIds.includes(a.r.id))-Number(Dynasty.get(b.t.name)!.heirIds.includes(b.r.id)));
  const choice=options.find(x=>Array.from({length:5},(_,i)=>12+i*12).some(m=>m-x.r.bornYear>=240&&householdBirthPlan(x.r,m,seed,'HIGH',Dynasty.get(x.t.name)!.houseEpochs!.at(-1)!.foundingRulerId)));
  check(choice,'fixed source supplies a real young, childless royal with a possible keyed natural birth');const {t,c,r}=choice!,id=r.id;
  check(Dynasty.enlistRoyalMilitary(c,t,12,[]),'real young parent enters original legal military appointment');const person=Military.getPerson(r.militaryIdentity!.personId)!,unit=t.getUserById(person.sourceUserId)!,command=person.appointments[0].commandId;
  const targets=core.allCities.filter(city=>city.ownerTeam!==t).slice(0,6);let childId:string|undefined,failed=false;const trace:any[]=[];
  for(let month=12;month<=72;month++){
   clock(month); // Controlled birth transaction fixture retains the existing court; not a natural monthly world.
   if(month>=24&&(month-24)%6===0&&(month-24)/6<6){const city=targets[(month-24)/6];unit.player.setPosition(city.block.x,city.block.y);unit.player.Body.reset(unit.player.x,unit.player.y);city.capture(t,month,undefined,command,person.personId);}
   if(month%12===0){
    const dy=Dynasty.get(t.name)!,parent=dy.rulers.find(x=>x.id===id)!,epoch=dy.houseEpochs!.find(e=>e.houseName===dy.houseName&&(e.endMonth??Infinity)>month)!;
    const ordinal=householdBirthParents(dy,month).findIndex(x=>x.id===id),possible=ordinal>=0&&householdBirthPlan(parent,month,seed,'HIGH',epoch.foundingRulerId,ordinal);
    trace.push({month,ordinal,possible:!!possible,seed:random.exportState().seed,parentStatus:parent.status,born:parent.bornYear,children:dy.rulers.filter(x=>x.parentId===id).map(x=>({id:x.id,birth:x.bornYear,scope:x.successionScope}))});
    if(possible&&!failed){const before=exportWorldSave(core),write=History.addEvent;History.addEvent=function(e){const out=write.call(this,e);if(e.type==='royal-child-born'){random.next();throw Error('injected birth write');}return out;};try{Dynasty.updateRoyalHouseholds(month,[t]);}finally{History.addEvent=write;}check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failed real birth restores all family identities, annual boundary, history and world RNG');const beforeRegistration=exportWorldSave(core);History.addEvent=function(e){const out=write.call(this,e);if(e.type==='royal-person-registered'){random.next();throw Error('injected birth registration write');}return out;};try{Dynasty.updateRoyalHouseholds(month,[t]);}finally{History.addEvent=write;}check(diffCanonicalWorldSave(beforeRegistration,exportWorldSave(core)).matched,'failed second birth registration restores both birth events, IDs, annual boundary, population and RNG');failed=true;}
    const population=core.teams.reduce((n,t)=>n+t.users.size,0),rng=JSON.stringify(random.exportState());Dynasty.updateRoyalHouseholds(month,core.teams);
    check(population===core.teams.reduce((n,t)=>n+t.users.size,0)&&JSON.stringify(random.exportState())===rng,'birth adds no map User, soldiers or world RNG draws');
    childId??=Dynasty.get(t.name)!.rulers.find(x=>x.parentId===id&&x.householdBirth)?.id;
    const saved=exportWorldSave(core);Dynasty.updateRoyalHouseholds(month,core.teams);check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'annual repeat is idempotent without duplicate birth or registration');
   }
  }
  const d=Dynasty.get(t.name)!,child=d.rulers.find(x=>x.id===childId)!;check(failed&&child&&child.bornYear===child.registration?.month&&child.householdBirth?.month===child.bornYear,'actual child is born and registered in the same real month before the parent dies '+JSON.stringify({id,failed,childId,trace}));
  check(!d.heirIds.includes(child.id)&&d.designatedHeirId!==child.id&&!child.militaryIdentity,'household child is neither crown candidate nor military officer');
  Military.updateNobility(72,core.teams,Dynasty.getAll());Dynasty.updateRoyalNobility(72,core.teams);check(d.royalNobility?.some(a=>a.holderRulerId===id&&a.rank==='BO'),'parent has a real earned military earl source, independent of birth');
  clock(73);unit.destroyUser(false,{cause:'BATTLE_DEATH',month:73,damageSource:'HOSTILE_HOME_OCCUPATION'});Dynasty.updateRoyalNobility(73,core.teams);
  check(d.royalNobility?.at(-1)?.holderRulerId===child.id&&d.royalNobility.at(-1)?.rank==='ZI'&&73-child.bornYear<216,'actual newly born registered minor succeeds BO to ZI without military office');
  const saved=exportWorldSave(core),rows=posthumousPeerage(person,Military.getFamilies(),Dynasty.getAll(),History.getRecordedEvents(),73);check(rows.length===1&&rows[0].type==='royal-noble-act','military afterlife reading uses exactly the existing royal death settlement');
  const host=document.createElement('div'),root=createRoot(host);document.body.append(host);try{
   flushSync(()=>root.render(<Provider store={store}><GenealogyBrowser open dynasty={d} team={t as any} worldMonth={73} targetId={id} onClose={()=>{}}/></Provider>));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const card=document.querySelector<HTMLButtonElement>(`[data-ruler-id="${id}"] [data-genealogy-card]`)!;check(card,'real shared tree retains deceased military parent');flushSync(()=>card.click());
   check(document.querySelector('[data-royal-children]')?.textContent?.includes(child.givenName),'selected royal parent displays registered true child');
   const button=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-royal-children] button')).find(b=>b.textContent?.includes(child.givenName))!;flushSync(()=>button.click());check(document.querySelector(`[data-genealogy-person="${child.id}"]`)?.textContent?.includes('未任军职'),'child click selects the real child without manufacturing an officer');
   flushSync(()=>root.render(<Provider store={store}><PosthumousPeeragePanel person={person} month={73}/></Provider>));check(host.textContent?.includes('身后爵位传承')&&host.textContent?.includes(child.givenName),'real military archive afterlife panel shows the actual successor');
   check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'children navigation and afterlife React reading never mutate canonical facts');
  }finally{flushSync(()=>root.unmount());host.remove();}
  for(const mutation of ['birth','parent','scope','lifespan']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as any[]).find(r=>r.rulerId===child.id)!;if(mutation==='birth')r.bornMonth--;if(mutation==='parent')r.parentId=id+'-fake';if(mutation==='scope')delete r.successionScope;if(mutation==='lifespan')r.naturalDeathMonth++;check(!validateWorldSave(bad).valid,'strict V55 rejects forged child '+mutation);}
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'actual new child and inherited title continue twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second read creates no child, title, body or event');
  hydrateWorldSave(core,structuredClone(saved));
  const adultMonth=child.bornYear+216;for(let m=74;m<=adultMonth;m++){clock(m);Dynasty.update(m,core.teams);Dynasty.updateRoyalHouseholds(m,core.teams);Dynasty.updateRoyalNobility(m,core.teams);}
  const adultTeam=core.teams.find(x=>x.name===t.name)!,grown=Dynasty.get(t.name)!.rulers.find(x=>x.id===child.id)!;
  check(grown.bornYear===child.bornYear&&grown.naturalDeathYear===child.naturalDeathYear&&!grown.militaryIdentity,'registered child grows under the original lifespan without automatic office');
  const candidate=Dynasty.getRoyalMilitaryCandidates(adultTeam,adultMonth).find(c=>c.rulerId===grown.id);check(candidate,'adult household child meets the original real military qualification while remaining outside crown candidates');
  check(Dynasty.enlistRoyalMilitary(candidate!,adultTeam,adultMonth,[]),'adult child may enter through the original legal military appointment');
  const own=Military.getPerson(grown.militaryIdentity!.personId)!;check(own.appointments[0].officeHistory?.[0].office==='XIAOWEI'&&own.capturedEventIds.length===0,'child starts as real colonel with no copied father captures or senior rank');
  check(History.getRecordedEvents().filter(e=>e.type==='military-person-died'&&e.metadata?.personId===person.personId).length===1,'dead parent never receives a second natural death during child growth');
  const adult=exportWorldSave(core);hydrateWorldSave(core,structuredClone(adult));check(diffCanonicalWorldSave(adult,exportWorldSave(core)).matched,'adult real military bridge and original birth remain strict after reading');
  return {seed,checks,scope:'controlled real Core birth, military capture/award, actual User death, minor inheritance, shared React controls and strict save; not natural frequency'};
 }finally{game.destroy(true);}
}
