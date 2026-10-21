import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Dynasty from "../../Politics/Dynasty";
import History from "../../History/WorldHistory";
import Diplomacy from "../../Politics/Diplomacy";
import {getFactionStability} from "../../Components/City";
import {selectDepositionCandidates,evaluateDepositionOpportunity} from "../../Politics/InReignDeposition";
import worldRandom from "../WorldRandom";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";
import {formatRulerLifeAge} from "../../UI/Components/FactionDetails/RoyalPresentation";

/** Controlled success/failure on a natural real dynasty after an actual City.capture.
 * Never a natural coup frequency estimate; no kin or historical crisis is fabricated. */
export async function runDepositionCore(seed="deposition-z8"){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(ok:unknown,label:string)=>{if(!ok)throw new Error(label);checks.push(label);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);if(!v.valid)throw new Error(v.errors.join("; "));return s;};
 try{
  let team:typeof core.teams[number]|undefined,enemy:typeof core.teams[number]|undefined;
  for(let m=0;m<=2400&&!team;m++){
   if(m)step();if(core.simulator!.year%12)continue;
   team=core.teams.find(t=>{const d=Dynasty.get(t.name),r=Dynasty.getCurrentRuler(t.name);
    if(t.status!=="ACTIVE"||t.identityStage!=="STATE"||t.cities.length<2||!d||!r||d.lastDepositionAttemptMonth!==undefined&&core.simulator!.year-d.lastDepositionAttemptMonth<60||!selectDepositionCandidates({currentRuler:r,rulers:d.rulers,houseName:d.houseName,worldMonth:core.simulator!.year}).length)return false;
    enemy=core.teams.find(e=>e!==t&&e.status==="ACTIVE"&&Diplomacy.canAttack(e.name,t.name,core.simulator!.year));return Boolean(enemy);
   });
   if(m%120===0)await new Promise(r=>setTimeout(r,0));
  }
  check(team&&enemy,"natural live royal kin and an existing hostile faction are available");
  const t=team!,d=Dynasty.get(t.name)!,old=Dynasty.getCurrentRuler(t.name)!,month=core.simulator!.year;
  core.setWorldRunning(false);
  const capital=t.capitalCity!;capital.capture(enemy!,month);
  check(capital.ownerTeam===enemy&&t.cities.length>0,"real capital capture creates the crisis without ending the dynasty");
  for(const city of t.cities)city.loyalty=20;
  const e=evaluateDepositionOpportunity({factionId:t.name,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:getFactionStability(t),currentRuler:old,rulers:d.rulers,houseName:d.houseName,worldMonth:month,events:History.getEvents()});
  check(e.eligible,"actual political crisis and existing kin qualify");
  const base=strict(),original=History.addRulerDeposed;
  const next=worldRandom.next.bind(worldRandom),originalNext=worldRandom.next;
  worldRandom.next=()=>{next();return 0;};
  History.addRulerDeposed=function(...args:Parameters<typeof original>){original.apply(this,args);throw new Error("controlled after-write failure");};
  try{(Dynasty as any).evaluateInReignDeposition(t,d,old,month);}finally{History.addRulerDeposed=original;worldRandom.next=originalNext;}
  const afterFailure=strict(),expected=structuredClone(base);
  expected.dynasties.find(x=>x.factionId===t.name)!.lastDepositionAttemptMonth=month;
  afterFailure.worldRandom=expected.worldRandom; // Failed qualified attempts intentionally consume their original roll.
  const rollback=diffCanonicalWorldSave(expected,afterFailure);
  if(!rollback.matched)console.info("[CoreTest] rollback differences "+JSON.stringify(rollback));
  check(rollback.matched,"failed final history writer restores full canonical state except attempted roll and cooldown");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(base)));
  const restored=core.teams.find(x=>x.name===t.name)!,dynasty=Dynasty.get(t.name)!,predecessor=Dynasty.getCurrentRuler(t.name)!;
  const before=worldRandom.exportState().position,draw=worldRandom.next.bind(worldRandom),savedNext=worldRandom.next;
  let forcedPoliticalRoll=false;
  worldRandom.next=()=>{const actual=draw();if(!forcedPoliticalRoll){forcedPoliticalRoll=true;return e.probability*.75;}return actual;};
  try{(Dynasty as any).evaluateInReignDeposition(restored,dynasty,predecessor,month);}finally{worldRandom.next=savedNext;}
  const runtimeInitializationDraws=worldRandom.exportState().position-before-1;
  const successor=Dynasty.getCurrentRuler(t.name)!,event=History.getEvents().find(x=>x.type==="ruler-deposed"&&x.actorFactionId===t.name&&(x.monthIndex??x.year)===month)!;
  check(predecessor.status==="deposed"&&predecessor.deathMonth===undefined&&successor.id!==predecessor.id,"political deposition preserves the predecessor's real life");
  check(typeof event?.metadata?.depositionSelection==="string","selected real claimant and frozen explanation are saved in the one authoritative event");
  const selection=JSON.parse(String(event.metadata?.depositionSelection));
  check(selection.roll===e.probability*.75&&selection.conditionalRoll===selection.roll/selection.probability,"claimant selection reuses the original political roll; separate runtime unit initialization draws are reported");
  const save=strict(),age=formatRulerLifeAge(predecessor,month);
  const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,"twelve real months after strict hydration are deterministic");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(a)));const reloadDiff=diffCanonicalWorldSave(a,strict());if(!reloadDiff.matched)console.info("[CoreTest] resave differences "+JSON.stringify(reloadDiff));check(reloadDiff.matched,"the second save loads with one royal identity and office chain");
  return {seed,scope:"controlled real Core/Phaser deposition after actual capital capture, not natural frequency",month,checks,previousId:predecessor.id,nextId:successor.id,relation:event.metadata?.relation,selection:JSON.parse(String(event.metadata?.depositionSelection)),ageAtDeposition:age,runtimeInitializationDraws,saveSchemaVersion:save.saveSchemaVersion};
 }finally{game.destroy(true);}
}
