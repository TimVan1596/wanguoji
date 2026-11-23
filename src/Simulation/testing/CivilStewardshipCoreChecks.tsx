import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import Civil from '../../Politics/CivilAdministration';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {civilPromotionEvidence} from '../../Politics/CivilPromotion';
import {civilRetirementEvidence} from '../../Politics/CivilCareerRules';
import {residentNaturalDeathMonth} from '../ResidentLife';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import {GovernorDetail} from '../../UI/Components/CivilAdministration/CivilGovernancePanel';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Directed production transactions over real residents, never natural-frequency evidence. */
export async function checkCivilStewardship(core:any,input:WorldSaveV1,personId:string,cityId:string,factionId:string,check:(v:unknown,label:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),team=()=>core.teams.find((t:any)=>t.name===factionId),city=()=>core.allCities.find((c:any)=>c.id===cityId),snapshot=()=>exportWorldSave(core);
 const setup=(id=personId)=>{hydrateWorldSave(core,structuredClone(input));Civil.setPolicyForSimulation('BASELINE');Civil.setCareerPolicyForSimulation('LOW');const dy=Dynasty.get(factionId)!;
  const pool=importCandidates(input.world.worldMonth);const chosen=pool.find(c=>c.personId===id)!;check(chosen,'actual eligible resident exists for the controlled peaceful city');city().loyalty=80;city().devastation=0;team().getUserById(chosen.sourceUserId).loyalty=100;return Civil.appoint(input.world.worldMonth,team(),city(),chosen,dy);};
 function importCandidates(month:number){const dy=Dynasty.get(factionId)!,epoch=dy.houseEpochs!.find(e=>e.endMonth===undefined)!;return civilCandidates(month,team(),Military.getPeople(),Civil.getTerms(),epoch.foundingRulerId,(id,born)=>Military.getFamilyMember(id,born),Military.getFormations(),Dynasty.getAll());}
 const observe=(m:number)=>{clock(m);(Civil as any).applyGovernance(m,core.teams);(Civil as any).observeStewardship(m,core.teams);};
 try{
  const term=setup(),start=term.startMonth;
  for(let m=start+1;m<start+36;m++)observe(m);
  clock(start+36);const before=snapshot(),write=History.addEvent;let failed=false;History.addEvent=function(e){const id=write.call(this,e);if(e.type==='civil-stewardship-assessed'){random.next();throw Error('injected appraisal write');}return id;};
  try{observe(start+36);}catch{failed=true;}finally{History.addEvent=write;}
  check(failed&&diffCanonicalWorldSave(before,snapshot()).matched,'failed peaceful assessment restores observation window, event source, person, population and world RNG');
  observe(start+36);const once=snapshot();observe(start+36);check(diffCanonicalWorldSave(once,snapshot()).matched,'repeating the successful assessment month neither repeats credit nor starts an overlapping window');
  for(let m=start+37;m<=start+72;m++)observe(m);
  let current=Civil.getByPerson(term.personId)[0];check(current.stewardshipAssessments?.length===2&&current.receipts?.length===0&&current.loyaltyRecovered===0&&current.devastationRecovered===0&&city().loyalty===80&&city().devastation===0,'two real three-year peaceful assessments give no fictional loyalty or devastation recovery');
  check(civilPromotionEvidence(current,start+72,100,team().cities.length,Civil.getTerms()),'a high-ability official in a peaceful city earns actual bounded promotion eligibility rather than lifelong recovery starvation');
  const steady=snapshot();check(validateWorldSave(steady).valid,'peaceful observations and appraisals pass strict native save validation');
  for(const mutate of [(a:any)=>a.contribution=99,(a:any)=>a.samples[12].month++,(a:any)=>a.samples[12].loyalty=20,(a:any)=>a.samples[0].historyIndex=999999]){const bad=structuredClone(steady),t=bad.registries.civilAdministration.terms[0],a=t.stewardshipAssessments![0];mutate(a);const e=(bad.worldHistory.events as any[]).find(e=>e.id===a.eventId);e.metadata.assessment=JSON.stringify(a);check(!validateWorldSave(bad).valid,'strict read rejects jointly forged appraisal values and matching raw assessment payload');}
  {const host=document.createElement('div'),root=createRoot(host);document.body.append(host);try{flushSync(()=>root.render(<Provider store={store}><GovernorDetail term={current} month={start+72}/></Provider>));check(host.textContent?.includes('人物列传')&&host.textContent.includes('行迹年表')&&host.textContent.includes('历事君主')&&host.textContent.includes('史评'),'ordinary civil archive uses the common biography, timeline, sovereign service and factual assessment structure');check(!host.textContent?.includes('相关变化与原始史事')&&!host.textContent?.includes('任职史料依据')&&!host.textContent?.includes('原始顺序'),'public biography contains no per-row technical evidence blocks');const evidence=Array.from(host.querySelectorAll('summary')).find(s=>s.textContent==='史料与考证')?.parentElement as HTMLDetailsElement;check(evidence&&!evidence.open,'all raw person sources have one closed evidence entrance');flushSync(()=>evidence.querySelector('summary')!.click());await new Promise(resolve=>setTimeout(resolve,20));flushSync(()=>{});check(host.textContent?.includes('单项史事与来源'),'real evidence interaction opens the retained raw person records');check(diffCanonicalWorldSave(steady,snapshot()).matched,'opening the shared peaceful biography and evidence leaves all authoritative facts and RNG unchanged');}finally{flushSync(()=>root.unmount());host.remove();}}
  Civil.promote(start+72,current,team(),Dynasty.get(factionId)!);const promoted=snapshot();hydrateWorldSave(core,structuredClone(promoted));check(diffCanonicalWorldSave(promoted,snapshot()).matched,'peaceful promotion strictly reads with distinct appraisal sources and unchanged permanent population identity');
  setup();for(let m=start+1;m<=start+35;m++)observe(m);city().loyalty=50;observe(start+36);city().loyalty=80;observe(start+37);check(!Civil.getByPerson(term.personId)[0].stewardshipAssessments?.length&&Civil.getByPerson(term.personId)[0].stewardshipWindow?.samples.length===1,'an actual unstable month resets the continuous assessment rather than hiding a failed year');observe(start+50);check(Civil.getByPerson(term.personId)[0].stewardshipWindow?.samples.length===1,'skipped months are not backfilled as peaceful observations');
  hydrateWorldSave(core,structuredClone(input));Civil.setPolicyForSimulation('BASELINE');Civil.setCareerPolicyForSimulation('LOW');
  const candidates=importCandidates(input.world.worldMonth);let retirement:{id:string;month:number}|undefined;
  for(const c of candidates.filter(c=>c.identitySource==='ORDINARY_RESIDENT')){const first=Math.ceil(Math.max(input.world.worldMonth+60,c.bornMonth+65*12)/12)*12;for(let m=first;m<residentNaturalDeathMonth(c.sourceUserId,c.bornMonth)-24;m+=12){const proof=civilRetirementEvidence({...term,personId:c.personId,sourceUserId:c.sourceUserId,bornMonth:c.bornMonth},m,input.worldRandom.seed,'LOW');if(proof&&proof.roll<proof.chance){retirement={id:c.personId,month:m};break;}}if(retirement)break;}
  check(retirement,'fixed real residents and their existing lifespans provide a lawful old-age retirement case');
  const old=setup(retirement!.id),due=retirement!.month;clock(due);const live=team().getUserById(old.sourceUserId),beforeRetire=snapshot(),military=Military.exportState(),writer=History.addEvent;let failedRetire=false;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='civil-governor-ended'&&e.metadata?.endReason==='RETIREMENT'){random.next();throw Error('injected retirement source');}return id;};try{(Civil as any).retireCandidates(due,team());}catch{failedRetire=true;}finally{History.addEvent=writer;}
  check(failedRetire&&diffCanonicalWorldSave(beforeRetire,snapshot()).matched,'failed retirement restores office, frozen decision, raw history, real population and RNG');
  (Civil as any).retireCandidates(due,team());const ended=Civil.getByPerson(old.personId)[0];check(ended.endReason==='RETIREMENT'&&ended.endMonth===due&&!live.isDestroyed&&team().getUserById(old.sourceUserId)===live,'actual retirement vacates the office while keeping its original living resident');check(JSON.stringify(military)===JSON.stringify(Military.exportState()),'retirement changes neither lifespan, ability, military identity, family nor title records');check(!importCandidates(due).some(c=>c.personId===old.personId),'a retired official cannot immediately recycle into the same yearly appointment');const retired=snapshot();hydrateWorldSave(core,structuredClone(retired));check(diffCanonicalWorldSave(retired,snapshot()).matched,'real retirement and retained identity strictly read again');
  const resume=()=>{hydrateWorldSave(core,structuredClone(retired));core.setWorldRunning(true);for(let i=0;i<360;i++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.setWorldRunning(false);return snapshot();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'career rules continue twelve real Core months deterministically after retirement');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,snapshot()).matched,'second read preserves civil appraisals, retirement, identity and historical source order');
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
import {civilGovernorCandidates as civilCandidates} from '../../Politics/CivilAdministration';
