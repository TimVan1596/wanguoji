import {createNaturalCore} from './NaturalCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {militaryMilestones} from '../../Politics/MilitaryChroniclePresentation';
/** Real monthly city, office, recruitment, political qualification and save paths. */
export async function runMilitaryPromotionCore(seed:string){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!;e.state.logicalX=x;e.state.logicalY=y;};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  clock(36);core.setWorldRunning(false);const home=core.teams.find(t=>[...t.users].some(u=>(Military as any).isEligible(u,36)))!,body=[...home.users].find(u=>(Military as any).isEligible(u,36))!;
  for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);place(body,home.capitalCity!.block.x,home.capitalCity!.block.y);
  check((Military as any).appoint(body,home.name,36,[body.player.logicalUnitId!]),'real User starts one legal colonel appointment');
  (Military as any).refreshOrders(36,core.teams,core.allCities);
  const id=body.militaryPersonId!,command=Military.getPerson(id)!.appointments[0].commandId,base=exportWorldSave(core);
  for(const logical of [false,true]){
   hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
   const p=Military.getPerson(id)!,f=Military.getFormation(command)!,team=core.teams.find(t=>t.name===p.factionId)!,user=team.getUserById(p.sourceUserId)!,city=core.allCities.find(c=>c.id===f.targetCityId)!;
   check(city,'production hostile order has a real city target');place(user,city.block.x,city.block.y);
   for(let m=48;m<=54;m++){clock(m);city.updateDefense(m);}place(user,-2048,-2048);clock(55);city.updateDefense(55);
   const experience=Military.getCareer(p,55).activities.filter(e=>e.kind==='SIEGE');check(experience.length===1,'continuous real siege produces one activity, never seven monthly merits');
   check(p.capturedEventIds.length===0,'an interrupted siege never invents a capture');clock(72);(Military as any).advanceOffices(72,core.teams);
   const grant=p.appointments[0].officeHistory!.at(-1)!;check(grant.office==='PIJIANG'&&grant.promotionBasis==='ACTIVITY'&&grant.activityEventIds?.[0]===experience[0].eventId,'three-year actual siege evidence promotes a legal colonel');
   check(f.memberUnitIds.length===1,'promotion without assembled reserves never creates soldiers');
   const saved=exportWorldSave(core),bad=structuredClone(saved);bad.worldHistory.events=(bad.worldHistory.events as any[]).filter((e:any)=>e.type!=='siege-started');check(!validateWorldSave(bad).valid,'removing original contact evidence invalidates the claimed activity promotion');
   hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'activity basis and original events survive strict hydration');
  }
  for(const reserve of [false,true]){
   hydrateWorldSave(core,structuredClone(base));const p=Military.getPerson(id)!,f=Military.getFormation(command)!,team=core.teams.find(t=>t.name===p.factionId)!,user=team.getUserById(p.sourceUserId)!;
   if(reserve){const recruit=[...team.users].find(u=>u!==user&&u.role==='NORMAL'&&!u.rulerId&&!Military.isAssigned(u.player.logicalUnitId!))!;check(recruit,'service promotion can recruit an existing actual resident');place(recruit,user.player.x+4,user.player.y);}
   clock(60);(Military as any).advanceOffices(60,core.teams);check(p.appointments[0].officeHistory!.length===1,'two-year new colonel never promotes merely on an order');
   const population=core.teams.reduce((n,t)=>n+t.users.size,0),rng=JSON.stringify(random.exportState());clock(96);(Military as any).advanceOffices(96,core.teams);
   const grant=p.appointments[0].officeHistory!.at(-1)!;check(grant.office==='PIJIANG'&&grant.promotionBasis==='SERVICE'&&grant.captureEventIds.length===0,'five-year continued legal service promotes without pretending to have war victories');
   check(f.memberUnitIds.length===(reserve?2:1),'service promotion fills only actual nearby available people');check(population===core.teams.reduce((n,t)=>n+t.users.size,0)&&rng===JSON.stringify(random.exportState()),'promotion and recruitment preserve population and RNG');
   const count=p.appointments[0].officeHistory!.length;(Military as any).advanceOffices(96,core.teams);check(p.appointments[0].officeHistory!.length===count,'same-month repeated office evaluation never duplicates the grant');
   check(!Military.getPoliticalInfluence(team,96,core.logicalUnitRegistry).candidates.some(c=>c.personId===id),'service-only promotion never manufactures military political qualification');
   const rows=militaryMilestones(p,Military.getChronicle(p,96),History.getEvents());check(rows.some(e=>e.eventId===grant.eventId&&e.text.includes('依服役资历')&&!e.text.includes('战功')),'public biography truthfully identifies service promotion');
   if(!reserve){
    const target=core.allCities.find(c=>c.id===f.targetCityId)!;check(target,'same-month evidence regression has an existing actual military target');place(user,target.block.x,target.block.y);target.capture(team,96,undefined,f.commandId,p.personId);
    const at=exportWorldSave(core);check(grant.promotionBasis==='SERVICE'&&validateWorldSave(at).valid,'a later same-month real capture cannot backfill an earlier service promotion with war merit');
   }
   const saved=exportWorldSave(core),resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return exportWorldSave(core);};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'same promotion save resumes twelve months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second read preserves the promotion evidence and actual members');
  }
  return {seed,checks,scope:'production city contact, office, recruits, politics and save; no new combat or political probabilities'};
 }finally{game.destroy(true);}
}
