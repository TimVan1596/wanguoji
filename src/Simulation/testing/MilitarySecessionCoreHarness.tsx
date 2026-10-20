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

/** Controlled crisis after a real naturally appointed military career; never a natural frequency claim. */
export async function runMilitarySecessionCore(seed="military-secession-z7"){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(yes:unknown,label:string)=>{if(!yes)throw new Error(label);checks.push(label);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);if(!v.valid)throw new Error(v.errors.join("; "));return s;};
 try{
  let chosen:ReturnType<typeof Military.getPoliticalInfluence>["candidates"][number]|undefined,parent:typeof core.teams[number]|undefined;
  for(let month=0;month<600&&!chosen;month++){step();for(const t of core.teams){const p=Military.getPoliticalInfluence(t,core.simulator!.year,core.logicalUnitRegistry).candidates.find(c=>c.unitCount>=4);if(p){chosen=p;parent=t;break;}}}
  check(chosen&&parent,"natural Core appointments and real service produce an existing military political candidate");if(!chosen||!parent)throw new Error("No military candidate");
  core.setWorldRunning(false);const month=core.simulator!.year,personId=chosen.personId,commandId=chosen.commandId;
  const commander=[...parent.users].find(u=>u.militaryPersonId===personId)!;
  while(parent.cities.length<4){const site=core.map!.blocks.flat().find(b=>!b.team&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>256));if(!site)throw new Error("No free city site");Factions.foundCity(parent,site,undefined,month);}
  const city=parent.cities.find(c=>!c.isCapital)!,secondCity=parent.cities.find(c=>c!==city&&!c.isCapital)!;
  const originalIds=[...chosen.memberUnitIds],members=[...parent.users].filter(u=>originalIds.includes(u.player.logicalUnitId!));
  for(const c of parent.cities)c.loyalty=20;city.loyalty=0;city.devastation=100;
  for(const u of parent.users)u.loyalty=99;
  const loyalist=members.find(u=>u!==commander)!;
  for(const u of members){if(u!==loyalist)u.loyalty=20;u.player.setPosition(city.block.x+4,city.block.y+4);(u.player.body as Phaser.Physics.Arcade.Body).reset(u.player.x,u.player.y);}
  let candidate=assessMilitarySecession(city,month);check(candidate?.users[0]===commander,"political crisis, current office and actual local commander qualify together");if(!candidate)throw new Error("No local military party");
  check(!candidate.users.includes(loyalist)&&candidate.users.length<originalIds.length,"only a verified willing part of the old formation follows");
  const follow=candidate.users.filter(u=>u!==commander),sourceName=Military.getPerson(personId)!.personalName,deathSchedule=deriveMilitaryLifeSchedule(Military.getPerson(personId)!).naturalDeathMonth;
  for(const u of follow)u.loyalty=99;check(!assessMilitarySecession(city,month),"no actual willing followers means no military secession");for(const u of follow)u.loyalty=20;
  const entry=core.logicalUnitRegistry.getEntry(commander.player.logicalUnitId!)!;
  core.logicalGameplayAuthority=true;entry.state.logicalX=-9999;entry.state.logicalY=-9999;
  check(!assessMilitarySecession(city,month),"logical mode rejects a valid-looking Player whose authoritative location is illegal");
  for(const u of members){const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state;s.logicalX=u.player.x;s.logicalY=u.player.y;}
  check(Boolean(assessMilitarySecession(city,month)),"logical mode accepts authoritative controlled district positions");
  core.logicalGameplayAuthority=false;entry.state.logicalX=-9999;entry.state.logicalY=-9999;
  check(Boolean(assessMilitarySecession(city,month)),"Arcade uses live Player positions instead of stale registered coordinates");
  city.loyalty=100;check(!Factions.createSplitFaction(parent,[city],month,100),"stable core city cannot create a military polity");city.loyalty=0;
  const projection=(s:ReturnType<typeof strict>)=>{const c=canonicalWorldSaveProjection(s);return {...c,worldRandom:undefined};};
  const before=strict(),baseline=JSON.stringify(projection(before)),oldTeams=core.teams.length;
  const create=(cities=[city])=>Factions.createSplitFaction(parent!,cities,month,100);
  const verifyRollback=()=>{check(JSON.stringify(projection(strict()))===baseline,"failed transaction restores complete canonical world except attempted RNG draws");check(Military.getPerson(personId)!.status==="ACTIVE"&&Military.getFormation(commandId)!.status==="ACTIVE"&&commander.team===parent&&commander.role==="NORMAL"&&!commander.historicalPersonId&&core.teams.length===oldTeams,"rollback restores command, people, faction registration and live roles");};
  const initialize=Dynasty.initializeFaction;
  Dynasty.initializeFaction=function(...args:Parameters<typeof initialize>){if(args[3]?.origin.military)throw new Error("injected military ruler initialization failure");return initialize.apply(this,args);};
  try{check(!create(),"royal initialization failure aborts military split");}finally{Dynasty.initializeFaction=initialize;}verifyRollback();
  const register=core.addRuntimeTeam;core.addRuntimeTeam=function(t){register.call(this,t);throw new Error("injected post-registration failure");};
  try{check(!create(),"registered faction failure aborts military split");}finally{core.addRuntimeTeam=register;}verifyRollback();
  const revolt=secondCity.revoltTo;secondCity.revoltTo=function(...args:Parameters<typeof revolt>){const result=revolt.apply(this,args);if(result)throw new Error("injected second-city post-mutation failure");return result;};
  try{check(!create([city,secondCity]),"failure after a second city changes owner rolls back both cities");}finally{secondCity.revoltTo=revolt;}verifyRollback();
  const writer=History.addEmpireSplit;History.addEmpireSplit=()=>{throw new Error("injected final history writer failure");};
  try{check(!create(),"failure at final split event rolls back the prepared country and territory");}finally{History.addEmpireSplit=writer;}verifyRollback();
  const total=core.teams.reduce((n,t)=>n+t.users.size,0),split=create();check(split,"real split production transaction succeeds");if(!split)throw new Error("Split failed");
  const ruler=Dynasty.getCurrentRuler(split.team.name)!,person=Military.getPerson(personId)!;
  check(split.team.rulerUser===commander&&commander.militaryPersonId===personId&&commander.historicalPersonId===personId&&person.politicalRulerId===ruler.id,"one real User and permanent military ID become the political leader");
  check(Dynasty.getRulerDisplay(split.team.name)===sourceName&&ruler.bornYear===person.bornMonth&&ruler.naturalDeathYear===deathSchedule,"established personal name, birth and original military lifespan remain unchanged");
  check(person.status==="RETIRED"&&Military.getFormation(commandId)!.status==="DISBANDED"&&person.appointments.at(-1)?.endReason==="TRANSFERRED","old office and command end before new political authority");
  check(core.teams.reduce((n,t)=>n+t.users.size,0)===total&&follow.every(u=>u.team===split.team)&&loyalist.team===parent,"actual followers transfer once, nonfollowers stay, world population is conserved");
  const founding=History.getEventsForFaction(split.team.name).filter(e=>e.type==="empire-split");
  check(founding.length===1&&founding[0].metadata?.splitSource==="MILITARY","one existing split event records its military source");
  const text=formatHistoryEventTitle(founding[0],new Map(core.teams.map(t=>[t.name,t])));
  check(text.includes(sourceName)&&text.includes(`${follow.length}名旧部`)&&text.includes("首任首领")&&!text.includes("首任君主"),"history reads actual old office, followers, polity and political leadership");
  check(Military.getChronicle(person,month,parent.name).some(e=>e.eventId===founding[0].id&&!e.victory),"old-country military biography records secession without inventing a capture");
  const save=strict();
  for(const mutate of [(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===personId).politicalRulerId="wrong",(s:any)=>{const r=s.dynasties.find((d:any)=>d.factionId===split.team.name).rulers.find((r:any)=>r.residentIdentity?.personId===personId);r.naturalDeathMonth++;},(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===personId).status="ACTIVE"]){const bad=structuredClone(save);mutate(bad);check(!validateWorldSave(bad).valid,"V20 refuses incompatible political/military life or simultaneous military authority");}
  const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
  const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,"V20 source military and royal identity resume deterministically for twelve real months");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));check(diffCanonicalWorldSave(first,strict()).matched,"resaved V20 snapshot reads again without duplicating the leader");
  core.setWorldRunning(true);while(Military.getPerson(personId)?.status!=="DEAD"&&core.simulator!.year<=deathSchedule+12)step();core.setWorldRunning(false);
  const final=Military.getPerson(personId)!,royal=Dynasty.findResidentPerson(personId)!;
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
  return {seed,checks,naturalCareerMonth:month,personId,rulerId:ruler.id,oldOffice:ruler.residentIdentity!.military!.office,followingUnits:follow.length,originalUnits:originalIds.length,worldPopulationBefore:total,worldPopulationAfter:total,saveSchemaVersion:20};
 }finally{game.destroy(true);}
}
