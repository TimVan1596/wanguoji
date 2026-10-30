import Diplomacy from "../../Politics/Diplomacy";
import {nextMilitaryHonors} from '../../Politics/MilitaryHonors';
import {currentNobleGrant} from '../../Politics/MilitaryNobility';
import {militaryIdentityLabels} from "../../Politics/RoyalArchiveIdentity";
import {CURRENT_SAVE_SCHEMA_VERSION} from "../../Persistence/WorldSaveSchema";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Military from "../../Politics/MilitaryCommandRegistry";
import Dynasty from "../../Politics/Dynasty";
import History from "../../History/WorldHistory";
import worldRandom from "../WorldRandom";
import Factions from "../FactionRegistry";
import {assessMilitarySecession} from "../MilitarySecession";
import {deriveMilitaryLifeSchedule} from "../../Politics/MilitaryLifeRules";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {diffCanonicalWorldSave,canonicalWorldSaveProjection} from "../../Persistence/WorldSaveSchema";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import PersonChronicleLayout from "../../UI/Components/FactionDetails/PersonChronicleLayout";
import {formatHistoryEventTitle} from "../../History/HistoryRenderRules";
import {checkPersonArchiveInteraction} from "./PersonArchiveInteractionHarness";

/** Controlled crisis after a real naturally appointed military career; never a natural frequency claim. */
export async function runMilitarySecessionCore(seed="military-secession-z7",local=false,siege=false){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(yes:unknown,label:string)=>{if(!yes)throw new Error(label);checks.push(label);if(checks.length%5===0)console.info(`[CoreTest] ${checks.length}: ${label}`);};
 const step=()=>{const before=core.simulator!.year;for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");if(core.simulator!.year===before)throw new Error(`Core clock stopped at ${before}; last check: ${checks[checks.length-1]}`);};
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);if(!v.valid)throw new Error(v.errors.join("; "));return s;};
 try{
  let chosen:ReturnType<typeof Military.getPoliticalInfluence>["candidates"][number]|undefined,parent:typeof core.teams[number]|undefined;
  for(let month=0;month<600&&!chosen;month++){step();for(const t of core.teams.filter(t=>t.cities.length>=2&&t.cities.some(c=>!c.isCapital&&!c.isInCaptureGrace(core.simulator!.year)))){const p=Military.getPoliticalInfluence(t,core.simulator!.year,core.logicalUnitRegistry).candidates.find(c=>c.unitCount>=2&&c.serviceMonths>=60&&core.simulator!.year%12===0&&(Dynasty.getCurrentRuler(t.name)?.naturalDeathYear??0)>core.simulator!.year+24&&deriveMilitaryLifeSchedule(Military.getPerson(c.personId)!).retirementMonth>core.simulator!.year+24);if(p){chosen=p;parent=t;break;}}}
  check(chosen&&parent,"natural Core appointments and real service produce an existing military political candidate");if(!chosen||!parent)throw new Error("No military candidate");
  core.setWorldRunning(false);let month=core.simulator!.year;const personId=chosen.personId,commandId=chosen.commandId;
  const commander=[...parent.users].find(u=>u.militaryPersonId===personId)!;
  const victoryCities=core.allCities.filter(c=>c.ownerTeam&&c.ownerTeam!==parent).slice(0,2);
  for(const c of victoryCities){commander.player.setPosition(c.block.x,c.block.y);(commander.player.body as Phaser.Physics.Arcade.Body).reset(c.block.x,c.block.y);c.capture(parent,month,undefined,commandId,personId);}
  Military.updateNobility(month,core.teams,Dynasty.getAll());
  Military.updateAppanages(month,core.teams,Dynasty.getAll(),core.allCities);
  const oldEstate=Military.getPerson(personId)?.appanageHistory?.at(-1);check(oldEstate,'real future secessionist initially holds an evidence-backed old-country estate');
  const oldTitle=currentNobleGrant(Military.getPerson(personId)!,parent.name,month);check(oldTitle,'actual serving general has a real sovereign grant before rebellion');
  month+=12;(core.simulator as any).clock.importState({worldMonth:month,elapsedMs:0,running:false});
  while(parent.cities.length<4){const site=core.map!.blocks.flat().find(b=>(b.team===parent||!b.team)&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>160));if(!site)throw new Error("No free city site");Factions.foundCity(parent,site,undefined,month);}
  const city=parent.cities.find(c=>!c.isCapital&&!c.isInCaptureGrace(month))!,secondCity=parent.cities.find(c=>c!==city&&!c.isCapital)!;
  if(local){
   for(const u of parent.users)if(u.role==='NORMAL'&&!u.militaryPersonId&&!u.historicalPersonId&&!Military.isAssigned(u.player.logicalUnitId!)){
    u.player.setPosition(commander.player.x+8,commander.player.y+8);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);
   }
   (Military as any).advanceOffices(month,core.teams);
   chosen=Military.getPoliticalInfluence(parent,month,core.logicalUnitRegistry).candidates.find(c=>c.personId===personId)!;
   check(chosen&&chosen.unitCount>=3,'real earned promotion recruits existing nearby residents into a three-body command for partial-following verification');
  }
  const originalIds=[...chosen.memberUnitIds],members=[...parent.users].filter(u=>originalIds.includes(u.player.logicalUnitId!));
  for(const c of parent.cities)c.loyalty=20;city.loyalty=0;city.devastation=100;
  for(const u of parent.users)u.loyalty=99;
  const loyalist=members.length>2?members.find(u=>u!==commander):undefined;
  for(const u of members){if(u!==loyalist)u.loyalty=20;u.player.setPosition(city.block.x+4,city.block.y+4);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);}
  if(loyalist){loyalist.player.setPosition(secondCity.block.x+4,secondCity.block.y+4);(loyalist.player.body as Phaser.Physics.Arcade.Body).reset(loyalist.player.x,loyalist.player.y);}
  const popular=[...parent.users].find(u=>u.role==='NORMAL'&&!u.militaryPersonId&&!u.historicalPersonId&&!Military.isAssigned(u.player.logicalUnitId!))!;check(popular,'existing local political split still requires a real ordinary supporter');popular.loyalty=20;popular.player.setPosition(city.block.x+8,city.block.y+8);(popular.player.body as Phaser.Physics.Arcade.Body).reset(popular.player.x,popular.player.y);
  let candidate=assessMilitarySecession(city,month);check(candidate?.users[0]===commander,"political crisis, current office and actual local commander qualify together");if(!candidate)throw new Error("No local military party");
  check((!loyalist||!candidate.users.includes(loyalist))&&candidate.users.length<=originalIds.length,"only a verified willing part of the old formation follows");
  if(local)check(Boolean(loyalist)&&!candidate.users.includes(loyalist!),'a member of the same command remains in another lawful district while the actual local member follows');
  const follow=candidate.users.filter(u=>u!==commander),sourceName=Military.getPerson(personId)!.personalName,deathSchedule=deriveMilitaryLifeSchedule(Military.getPerson(personId)!).naturalDeathMonth;
  const positions=new Map(members.map(u=>[u,{x:u.player.x,y:u.player.y}]));
  for(const u of members)if(u!==commander){u.player.setPosition(secondCity.block.x+4,secondCity.block.y+4);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);}
  check(!assessMilitarySecession(city,month),"no actual local followers means no military secession");
  for(const [u,p]of positions){u.player.setPosition(p.x,p.y);(u.player.body as Phaser.Physics.Arcade.Body).reset(p.x,p.y);}
  const entry=core.logicalUnitRegistry.getEntry(commander.player.logicalUnitId!)!;
  core.logicalGameplayAuthority=true;entry.state.logicalX=-9999;entry.state.logicalY=-9999;
  check(!assessMilitarySecession(city,month),"logical mode rejects a valid-looking Player whose authoritative location is illegal");
  for(const u of members){const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state;s.logicalX=u.player.x;s.logicalY=u.player.y;}
  check(Boolean(assessMilitarySecession(city,month)),"logical mode accepts authoritative controlled district positions");
  core.logicalGameplayAuthority=false;entry.state.logicalX=-9999;entry.state.logicalY=-9999;
  check(Boolean(assessMilitarySecession(city,month)),"Arcade uses live Player positions instead of stale registered coordinates");
  city.loyalty=100;check(!Factions.createSplitFaction(parent,[city],month,100),"stable core city cannot create a military polity");city.loyalty=0;
  const projection=(s:ReturnType<typeof strict>)=>{const c=canonicalWorldSaveProjection(s);return {...c,worldRandom:undefined};};
  if(local){
   for(const c of parent.cities)c.loyalty=c===city?0:100;
   check(!Factions.createSplitFaction(parent,[city],month,0),'local crisis alone cannot bypass the old imperial strain gate');
   const opportunity={chance:.09,roll:.01};
   const political=(core.simulator as any).events,beforePolitical=political.exportState(),savedLoyalty=new Map(core.allCities.map(c=>[c,c.loyalty]));
   for(const c of core.allCities)c.loyalty=c===city?0:100;
   const produce=Factions.createSplitFaction,popularProducer=Factions.createRebelFaction,next=worldRandom.next;let draws=0,attempts=0;
   Factions.createSplitFaction=function(...args:Parameters<typeof produce>){attempts++;check(args[0]===parent&&args[1][0]===city&&args[4]?.roll===0&&args[4].chance>0,'the real annual city path passes its one original draw and exact local target');return undefined;};
   Factions.createRebelFaction=()=>{throw Error('Military opportunity fell through to ordinary founding');};worldRandom.next=()=>{draws++;return 0;};
   try{political.checkRestorations(month,core.teams);}finally{Factions.createSplitFaction=produce;Factions.createRebelFaction=popularProducer;worldRandom.next=next;political.importState(beforePolitical);for(const [c,l]of savedLoyalty)c.loyalty=l;}
   check(attempts===1&&draws===1,'one annual political opportunity gets one shared draw and no second founding attempt after failure');
   city.loyalty=100;check(!Factions.createSplitFaction(parent,[city],month,0,opportunity),'local army and estate cannot create a crisis in a quiet city');city.loyalty=0;
   check(!Factions.createSplitFaction(parent,[city],month,0,{chance:.09,roll:.5}),'a missed original city draw cannot create a military state');
   check(!Factions.createSplitFaction(parent,[city],month,0,{...opportunity,lastRebellionMonth:month-1}),'the original city cooldown blocks military founding too');
   popular.loyalty=99;check(Boolean(assessMilitarySecession(city,month)),'a real local ordinary formation member can supply military support without an unrelated civilian');
  }
  if(siege){
   const enemy=core.teams.find(t=>t!==parent&&t.status==='ACTIVE'&&Diplomacy.canAttack(t.name,parent!.name,month)&&t.users.size>=8)!;
   check(enemy,'a real hostile state with actual population exists for the siege crisis gate');
   for(const u of enemy.users){u.player.setPosition(city.block.x+8,city.block.y+8);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);}
   city.defense=city.maxDefense;city.loyalty=75;(city as any).updateSiege(month);
   check(city.ownerTeam===parent&&city.underSiege&&city.lastSiegeDamageMonth===month&&Boolean(city.siegeBattle),'real local hostile bodies create a currently damaged production siege without taking the city');
   check(Boolean(assessMilitarySecession(city,month)),'the real serving local military party remains valid during the actual siege');
  }
  const create=(cities=[city])=>Factions.createSplitFaction(parent!,cities,month,local?0:100,local?{chance:siege?.06:.09,roll:.01}:undefined);
  const before=strict(),baseline=JSON.stringify(projection(before)),oldTeams=core.teams.length;
  const verifyRollback=()=>{const actual=projection(strict()),diff=diffCanonicalWorldSave(JSON.parse(baseline),actual as any);if(!diff.matched)console.error("Error Rollback diff",JSON.stringify(diff));check(diff.matched,"failed transaction restores complete canonical world except attempted RNG draws");check(Military.getPerson(personId)!.status==="ACTIVE"&&Military.getFormation(commandId)!.status==="ACTIVE"&&commander.team===parent&&commander.role==="NORMAL"&&!commander.historicalPersonId&&core.teams.length===oldTeams,"rollback restores command, people, faction registration and live roles");};
  const initialize=Dynasty.initializeFaction;
  Dynasty.initializeFaction=function(...args:Parameters<typeof initialize>){if(args[3]?.origin.military)throw new Error("injected military ruler initialization failure");return initialize.apply(this,args);};
  try{check(!create(),"royal initialization failure aborts military split");}finally{Dynasty.initializeFaction=initialize;}verifyRollback();
  const register=core.addRuntimeTeam;core.addRuntimeTeam=function(t){register.call(this,t);throw new Error("injected post-registration failure");};
  try{check(!create(),"registered faction failure aborts military split");}finally{core.addRuntimeTeam=register;}verifyRollback();
  const revolt=secondCity.revoltTo;
  secondCity.revoltTo=()=>false;
  try{check(!create([city,secondCity]),"second-city refusal rolls back the whole military transaction");}finally{secondCity.revoltTo=revolt;}verifyRollback();
  secondCity.revoltTo=function(...args:Parameters<typeof revolt>){const result=revolt.apply(this,args);if(result)throw new Error("injected second-city post-mutation failure");return result;};
  try{check(!create([city,secondCity]),"failure after a second city changes owner rolls back both cities");}finally{secondCity.revoltTo=revolt;}verifyRollback();
  const writer=History.addEmpireSplit;History.addEmpireSplit=()=>{throw new Error("injected final history writer failure");};
  try{check(!create(),"failure at final split event rolls back the prepared country and territory");}finally{History.addEmpireSplit=writer;}verifyRollback();
  const total=core.teams.reduce((n,t)=>n+t.users.size,0),split=create();check(split,"real split production transaction succeeds");if(!split)throw new Error("Split failed");
  const ruler=Dynasty.getCurrentRuler(split.team.name)!,person=Military.getPerson(personId)!;
  check(split.team.rulerUser===commander&&commander.militaryPersonId===personId&&commander.historicalPersonId===personId&&person.politicalRulerId===ruler.id,"one real User and permanent military ID become the political leader");
  check(Dynasty.getRulerDisplay(split.team.name)===sourceName&&ruler.bornYear===person.bornMonth&&ruler.naturalDeathYear===deathSchedule,"established personal name, birth and original military lifespan remain unchanged");
  check(person.status==="RETIRED"&&Military.getFormation(commandId)!.status==="DISBANDED"&&person.appointments.at(-1)?.endReason==="TRANSFERRED","old office and command end before new political authority");
  check(core.teams.reduce((n,t)=>n+t.users.size,0)===total&&follow.every(u=>u.team===split.team)&&(!loyalist||loyalist.team===parent),"actual followers transfer once, nonfollowers stay, world population is conserved");
  const founding=History.getEventsForFaction(split.team.name).filter(e=>e.type==="empire-split");
  check(founding.length===1&&founding[0].metadata?.splitSource==="MILITARY","one existing split event records its military source");
  const text=formatHistoryEventTitle(founding[0],new Map(core.teams.map(t=>[t.name,t])));
  check(text.includes(sourceName)&&text.includes(`${follow.length}名旧部`)&&text.includes("首任首领")&&!text.includes("首任君主"),"history reads actual old office, followers, polity and political leadership");
  check(Military.getChronicle(person,month,parent.name).some(e=>e.eventId===founding[0].id&&!e.victory),"old-country military biography records secession without inventing a capture");
  await checkPersonArchiveInteraction(core,split.team.name,personId,check);
  check(militaryIdentityLabels(Military.getPerson(personId)!,Dynasty.getAll(),History.getEvents(),month).includes("义军创立者"),"real founding transaction supplies composite military founder identity");
  check(nextMilitaryHonors({...person,nobilityHistory:[]},Military.getFormations(),History.getEvents(),month,core.teams,Dynasty.getAll()).length===0,'verified rebellion without an original grant cannot cause a fabricated revocation');
  const titleBefore=strict(),writeHonor=History.addEvent;History.addEvent=function(e){const id=writeHonor.call(this,e);if(e.type==='military-title-revoked')throw Error('injected revocation failure');return id;};
  try{Military.updateHonors(month,core.teams,Dynasty.getAll());}finally{History.addEvent=writeHonor;}
  check(diffCanonicalWorldSave(titleBefore,strict()).matched&&person.politicalRulerId===ruler.id,'revocation failure rolls back only its own act, never half-reverts a committed rebellion');
  const honorRng=JSON.stringify(worldRandom.exportState());Military.updateHonors(month,core.teams,Dynasty.getAll());Military.updateHonors(month,core.teams,Dynasty.getAll());
  check(person.honorHistory?.filter(h=>h.kind==='REVOKED').length===1&&!currentNobleGrant(person,parent.name,month)&&person.nobilityHistory?.some(g=>g.eventId===oldTitle!.eventId),'real source sovereign revokes once after actual rebellion, retaining all original grants');
  check(JSON.stringify(worldRandom.exportState())===honorRng&&core.teams.reduce((n,t)=>n+t.users.size,0)===total,'revocation changes no military bodies, sovereign, population or random draws');
  Military.updateAppanages(month,core.teams,Dynasty.getAll(),core.allCities);check(person.appanageHistory?.at(-1)?.kind==='ENDED'&&person.appanageHistory.some(a=>a.eventId===oldEstate!.eventId),'actual secession and old-title revocation end the estate without deleting its original grant or creating foreign ownership');
  const save=strict();
  if(siege)check(ruler.residentIdentity!.military!.localCrisis?.reason==='MILITARY_SIEGE_CRISIS','active siege founding retains its pre-transaction source even after the transfer closes the battle');
  check(ruler.residentIdentity!.military!.entryKind===(local?'LOCAL_CRISIS':'EMPIRE_SPLIT'),'founding retains its actual political entry, separate from the military source');
  if(local)for(const mutate of [(e:any)=>e.localCrisis.facts.underSiege='fake',(e:any)=>delete e.localCareerEventIds,(e:any)=>e.localCrisis.roll=.99,(e:any)=>e.localCrisis.facts.loyalty=100,(e:any)=>e.localCrisis.supporter.unitId=e.originalMemberUnitIds[0],(e:any)=>delete e.localCrisis]){
   const bad=structuredClone(save),r=bad.dynasties.flatMap(d=>d.rulers).find((r:any)=>r.rulerId===ruler.id)! as any;mutate(r.residentIdentity.military);check(!validateWorldSave(bad).valid,'strict V32 refuses forged local crisis, draw or supporter evidence');
  }

  for(const mutate of [(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===personId).politicalRulerId="wrong",(s:any)=>{const r=s.dynasties.find((d:any)=>d.factionId===split.team.name).rulers.find((r:any)=>r.residentIdentity?.personId===personId);r.naturalDeathMonth++;},(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===personId).status="ACTIVE"]){const bad=structuredClone(save);mutate(bad);check(!validateWorldSave(bad).valid,"V21 refuses incompatible political/military life or simultaneous military authority");}
  const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
  const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,"V21 source military and royal identity resume deterministically for twelve real months");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));check(diffCanonicalWorldSave(first,strict()).matched,"resaved V21 snapshot reads again without duplicating the leader");
  core.setWorldRunning(true);while(Military.getPerson(personId)?.status!=="DEAD"&&core.simulator!.year<=deathSchedule+12)step();core.setWorldRunning(false);
  const final=Military.getPerson(personId)!,royal=Dynasty.findResidentPerson(personId)!;
  check(!final.honorHistory?.some(h=>h.kind==='POSTHUMOUS'),'later sovereign retains only its independent monarch posthumous system');
  check(final.status==="DEAD"&&final.deathMonth===royal.deathMonth,"actual subsequent royal death closes the same military person's life");
  check(History.getEvents().filter(e=>e.type==="military-person-died"&&e.metadata?.personId===personId).length===1&&!core.teams.some(t=>[...t.users].some(u=>u.militaryPersonId===personId)),"one death record and no live body or command survive the linked person's death");strict();
  // Real DOM interaction is structural only, never visual acceptance or a fabricated world history.
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
  const rows=Array.from({length:21},(_,i)=>({id:`fixture-${i}`,content:<p>可读纪事{i}</p>}));let calls=0;
  const rng=JSON.stringify(worldRandom.exportState()),history=History.getEvents().length;
  const render=(n:number)=>flushSync(()=>root.render(<PersonChronicleLayout personKey={`person-${n}`} title="交互结构测试" biographyTitle="生平" biography={[]} milestoneTitle="重大纪年" milestoneTotal={n} milestones={rows.slice(0,Math.min(8,n))} allMilestones={()=>{calls++;return rows.slice(0,n);}} assessment={[]} evidence={<p>审计数据</p>}/>));
  render(21);check(host.querySelectorAll("section p").length===8&&calls===0&&!host.textContent!.includes("审计数据"),"collapsed public summary mounts eight rows and no hidden full/audit DOM");
  flushSync(()=>host.querySelector("button")!.click());check(host.querySelectorAll("section p").length===21&&host.textContent!.includes("收起至精选8条"),"one click expands all readable records in place");
  flushSync(()=>host.querySelector("button")!.click());check(host.querySelectorAll("section p").length===8,"one click collapses and unmounts omitted rows");
  render(6);check(host.querySelectorAll("section p").length===6&&!host.querySelector("button"),"six readable records show completely with no unnecessary expansion button");
  check(JSON.stringify(worldRandom.exportState())===rng&&History.getEvents().length===history,"reading expansion consumes no RNG and creates no history");root.unmount();host.remove();
  return {seed,checks,naturalCareerMonth:month,personId,rulerId:ruler.id,oldOffice:ruler.residentIdentity!.military!.office,followingUnits:follow.length,originalUnits:originalIds.length,worldPopulationBefore:total,worldPopulationAfter:total,saveSchemaVersion:CURRENT_SAVE_SCHEMA_VERSION};
 }finally{game.destroy(true);}
}
