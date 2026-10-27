import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {createNaturalCore} from './NaturalCoreHarness';
import Factions from '../FactionRegistry';
import History from '../../History/WorldHistory';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import random from '../WorldRandom';
import {assessPopularSupport,hasPopularPoliticalCrisis} from '../PopularRebellionSupport';
import {assessMilitarySecession} from '../MilitarySecession';
import {selectDepositionCandidates,evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {composeMilitaryBiography} from '../../Politics/PersonBiography';
import {getFactionStability} from '../../Components/City';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
export async function runRegionalPoliticsCore(seed='royal-military-z11'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state;s.logicalX=x;s.logicalY=y;};
 const pop=()=>core.teams.reduce((n,t)=>n+t.users.size,0),strict=()=>exportWorldSave(core);
 const step=()=>{for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 const site=(team:typeof core.teams[number])=>{const b=core.map!.blocks.flat().find(b=>!b.city&&(!b.team||b.team===team)&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>160))!;if(!b)throw Error('No real free city site');return Factions.foundCity(team,b,undefined,core.simulator!.year)!;};
 try{
  core.setWorldRunning(false);const initial=strict();
  // Actual foreign occupation starts at loyalty 35; repeated real transfers cause damage.
  const home=core.teams[0],enemy=core.teams[1],town=site(home);site(home);
  for(const [m,owner]of [[0,enemy],[3,home],[6,enemy],[9,home],[12,enemy]] as const){clock(m);if(m===12)town.revoltTo(owner,m);else town.capture(owner,m);}
  clock(13);check(town.loyalty===35&&town.captureCount===5&&town.devastation>=50&&!hasPopularPoliticalCrisis(town,13,core.totalCells),'fresh real occupation cannot immediately use the new crisis path');
  clock(24);const supporters=[...enemy.users].filter(u=>u.role==='NORMAL'&&!u.militaryPersonId).slice(0,3);for(const u of supporters)place(u,town.block.x,town.block.y);
  check(hasPopularPoliticalCrisis(town,24,core.totalCells)&&assessPopularSupport(town,24).users.length>0,'mature repeated occupation has real local resident support without loyalty rewriting');
  const events=(core.simulator as any).events,next=random.next;let calls=0;random.next=function(){next.call(random);calls++;return .999999;};
  try{events.checkRestorations(24,core.teams);}finally{random.next=next;}
  const funnel=events.getRegionalRebellionSnapshot().popularFunnel;check(funnel.draws===1&&funnel.misses===1&&calls===1,'ordinary candidate reaches exactly its original shared political lottery and can fail');
  const before=strict(),initialize=Dynasty.initializeFaction;Dynasty.initializeFaction=function(...args){if(args[3])throw Error('injected founding failure');return initialize.apply(this,args);};
  try{check(!Factions.createRebelFaction({city:town,year:24,factionType:'REBEL'}),'new reachable crisis still obeys the real founding transaction failure');}finally{Dynasty.initializeFaction=initialize;}
  const after=strict();before.worldRandom=after.worldRandom;const rollback=diffCanonicalWorldSave(before,after);check(rollback.matched,'founding failure restores population, identity, city, country and history except attempted original RNG');
  const bodies=pop();clock(36);calls=0;random.next=function(){const actual=next.call(random);return calls++===0?0:actual;};try{events.checkRestorations(36,core.teams);}finally{random.next=next;}
  const polity=town.ownerTeam!;check(polity!==enemy&&polity.factionType==='REBEL'&&events.getRegionalRebellionSnapshot().popularFunnel.successes===1,'the original production city check can found a real ordinary rebellion');
  check(pop()===bodies&&supporters.includes(polity.rulerUser!)&&polity.identityStage==='PROVISIONAL','founder and supporters transfer once, with no new leader body or formal kingdom privilege');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(36));store.dispatch(setSelectedFactionName(polity.name));store.dispatch(setFactionDetailTab('military'));root.render(createElement(Provider,{store,children:createElement(FactionDetails)}));});
    check(Array.from(host.querySelectorAll('button')).some(b=>b.textContent==='军政人物'),'real provisional rebel detail exposes the existing military tab');
    check(host.textContent?.includes('本势力尚无将领任职')&&host.textContent.includes('真实居民'),'empty rebel military archive explains actual resident and annual appointment requirements');
  }finally{flushSync(()=>root.unmount());host.remove();}
  const save=strict();{const bad:any=structuredClone(save),e=bad.worldHistory.events.find((e:any)=>e.type==='rebel-faction-founded'&&e.actorFactionId===polity.name);const f=JSON.parse(e.metadata.popularCrisisFacts);f.devastation=0;e.metadata.popularCrisisFacts=JSON.stringify(f);check(!validateWorldSave(bad).valid,'strict save rejects a fabricated mature-war crisis');}
  const resume=()=>{core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(save));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'new ordinary political path resumes twelve real months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'resaved ordinary founder reads again with the same unique identity');
  // A real zero-capture defender, legal promotion/recruitment, then the existing political transactions.
  hydrateWorldSave(core,structuredClone(initial));clock(12);
  const owner=core.teams.find(t=>{const d=Dynasty.get(t.name)!,r=Dynasty.getCurrentRuler(t.name)!;return r.naturalDeathYear!>180&&selectDepositionCandidates({currentRuler:r,rulers:d.rulers,houseName:d.houseName,worldMonth:108}).length&&[...t.users].some(u=>(Military as any).isEligible(u,12)&&u.bornMonth>108-54*12);})!;
  check(owner,'controlled defense has a real living sovereign, kin and a sufficiently young resident');const other=core.teams.find(t=>t!==owner)!;
  const city=site(owner);site(owner);site(owner);
  const defenders=[...owner.users].filter(u=>(Military as any).isEligible(u,12)).sort((a,b)=>b.bornMonth-a.bornMonth).slice(0,4),commander=defenders[0],positions=core.teams.flatMap(t=>[...t.users]).map(u=>({u,x:u.player.x,y:u.player.y}));
  for(const {u}of positions)place(u,-1024,-1024);for(const u of defenders)place(u,city.block.x,city.block.y);for(const u of [...other.users].filter(u=>u.role==='NORMAL').slice(0,2))place(u,city.block.x,city.block.y);
  check((Military as any).appoint(commander,owner.name,12,[commander.player.logicalUnitId!]),'real defender begins as an ordinary one-person colonel');
  for(let m=12;m<36&&!History.getEvents().some(e=>e.type==='siege-defended'&&e.metadata?.personId===commander.militaryPersonId);m++){clock(m);city.updateDefense(m);}
  const p=Military.getPerson(commander.militaryPersonId!)!,defense=History.getEvents().find(e=>e.type==='siege-defended'&&e.metadata?.personId===p.personId);check(defense&&p.capturedEventIds.length===0,'production battle actually repulses attackers and grants no city capture');
  for(const {u,x,y}of positions)if(!u.isDestroyed)place(u,x,y);
  clock(48);(Military as any).advanceOffices(48,core.teams);clock(108);(Military as any).advanceOffices(108,core.teams);
  const influence=Military.getPoliticalInfluence(owner,108,core.logicalUnitRegistry),candidate=influence.candidates.find(c=>c.personId===p.personId);check(candidate&&candidate.unitCount===2&&candidate.defenseEventIds?.includes(defense!.id),'eight-year two-body defender gains real political eligibility with original promotion and nearby recruitment');
  check(composeMilitaryBiography(p,Military.getChronicle(p,108,owner.name),owner.name).assessment.includes('守土'),'real defender assessment recognizes defense without inventing a capture');
  const peaceful=evaluateDepositionOpportunity({factionId:owner.name,status:owner.status,identityStage:owner.identityStage,cityCount:owner.cities.length,stability:90,currentRuler:Dynasty.getCurrentRuler(owner.name)!,rulers:Dynasty.get(owner.name)!.rulers,houseName:Dynasty.get(owner.name)!.houseName,worldMonth:108,events:[],military:influence});check(!peaceful.militaryParticipant,'new defensive qualification creates no independent peaceful coup');
  const militaryBase=strict();owner.capitalCity!.capture(other,108);owner.capitalCity!.capture(other,108);for(const c of owner.cities)c.loyalty=20;
  const d=Dynasty.get(owner.name)!,r=Dynasty.getCurrentRuler(owner.name)!,ev=evaluateDepositionOpportunity({factionId:owner.name,status:owner.status,identityStage:owner.identityStage,cityCount:owner.cities.length,stability:getFactionStability(owner),currentRuler:r,rulers:d.rulers,houseName:d.houseName,worldMonth:108,events:History.getEvents(),military:Military.getPoliticalInfluence(owner,108,core.logicalUnitRegistry)});check(ev.eligible&&ev.militaryParticipant?.personId===p.personId,'real capital losses create the original court political opportunity for the defender');
  calls=0;random.next=function(){const actual=next.call(random);return calls++===0?ev.probability*.75:actual;};try{(Dynasty as any).evaluateInReignDeposition(owner,d,r,108);}finally{random.next=next;}
  const deposed=History.getEvents().find(e=>e.type==='ruler-deposed'&&e.year===108)!;check(deposed&&JSON.parse(String(deposed.metadata?.militaryParticipation)).participant.defenseEventIds.includes(defense!.id),'existing single political transaction persists the actual defender evidence');const court=strict();{const bad:any=structuredClone(court),e=bad.worldHistory.events.find((e:any)=>e.id===deposed.id),proof=JSON.parse(e.metadata.militaryParticipation);proof.participant.defenseEventIds=['fake'];e.metadata.militaryParticipation=JSON.stringify(proof);check(!validateWorldSave(bad).valid,'strict court evidence rejects invented defensive political merit');}
  hydrateWorldSave(core,structuredClone(militaryBase));const country=core.teams.find(t=>t.name===owner.name)!,general=Military.getPerson(p.personId)!,formation=Military.getFormations().find(f=>f.commanderPersonId===p.personId&&f.status==='ACTIVE')!,branch=country.cities.find(c=>!c.isCapital&&!c.isInCaptureGrace(108))!;
  for(const c of country.cities)c.loyalty=20;branch.loyalty=0;branch.devastation=100;for(const u of country.users)u.loyalty=99;
  const party=[...country.users].filter(u=>formation.memberUnitIds.includes(u.player.logicalUnitId!)),ordinary=[...country.users].find(u=>u.role==='NORMAL'&&!u.militaryPersonId&&!Military.isAssigned(u.player.logicalUnitId!))!;
  for(const u of [...party,ordinary]){u.loyalty=20;place(u,branch.block.x,branch.block.y);}
  check(assessMilitarySecession(branch,108)?.evidence.defenseEventIds?.includes(defense!.id),'existing local secession qualification accepts the same verified defender, with actual willing followers');
  const count=pop(),split=Factions.createSplitFaction(country,[branch],108,100);check(split&&general.politicalRulerId&&general.appointments.at(-1)?.endReason==='TRANSFERRED'&&pop()===count,'real defensive general secession preserves one identity and population, ending the original command');const rebellion=strict();{const bad:any=structuredClone(rebellion),r=bad.dynasties.flatMap((d:any)=>d.rulers).find((r:any)=>r.rulerId===general.politicalRulerId),e=bad.worldHistory.events.find((e:any)=>e.type==='empire-split'&&e.metadata?.foundingRulerId===general.politicalRulerId);r.residentIdentity.military.defenseEventIds=['fake'];e.metadata.militarySplitEvidence=JSON.stringify(r.residentIdentity.military);check(!validateWorldSave(bad).valid,'strict secession rejects copied but unsupported defense evidence');}
  return {seed,checks,scope:'controlled actual ordinary failure/success, resident rollback, defensive court participation and military secession; not a natural frequency estimate'};
 }finally{game.destroy(true);}
}
