import {militaryPromotionDiagnostics} from "./MilitaryPromotionDiagnostics";
import {militaryNobilityDiagnostics} from "./MilitaryNobilityDiagnostics";
import ArchivedCities from "../ArchivedCities";
import {genealogyArchiveMetrics} from "./GenealogyArchiveMetrics";
import Dynasty from "../../Politics/Dynasty";
import {getRecordedKinRelation} from "../../Politics/DynasticCandidateRules";
import {siegeParticipants} from "../SiegeParticipants";
import {assessPopularSupport,hasPopularPoliticalCrisis} from "../PopularRebellionSupport";
import {createNaturalCore} from "./NaturalCoreHarness";
import Military,{MAX_FORMATION_UNITS} from "../../Politics/MilitaryCommandRegistry";
import {readMilitaryParticipation} from "../../Politics/MilitaryPoliticalInfluence";
import City from "../../Components/City";
import Diplomacy from "../../Politics/Diplomacy";
import WorldHistory from "../../History/WorldHistory";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {canonicalWorldSaveProjection} from "../../Persistence/WorldSaveSchema";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";

/** Stable full-world fingerprint, excluding only version label and creation timestamp.
 * Measurement is test-session only and consumes no production randomness. */
async function fingerprint(snapshot: ReturnType<typeof exportWorldSave>,baseFacts=false) {
  const {appVersion: _version, ...canonical} = canonicalWorldSaveProjection(snapshot);
  if(baseFacts){
    canonical.worldHistory=structuredClone(canonical.worldHistory);
    for(const e of canonical.worldHistory.events as any[]){
      if(e.type==="military-office-granted"){delete e.rulerId;if(e.metadata)delete e.metadata.authorizingRulerTitle;}
      if(["city-captured","city-recovered","capital-fallen"].includes(e.type)&&e.metadata){delete e.metadata.commanderOffice;delete e.metadata.attackerNameAtEvent;delete e.metadata.defenderNameAtEvent;if(e.type==="city-recovered")delete e.metadata.founderCapital;}
    }
  }
  const ordered = (value: any): any => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, ordered(value[k])])) : value;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(ordered(canonical))));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}

/** Instrument the real City transaction, never substitute combat or its RNG. Test-session aggregates only. */
export async function runMilitaryBalance(seed:string,years=100,includeSnapshot=false){
  const royalOffers=new Map<string,number>(),readRoyal=(Dynasty as any).getRoyalMilitaryCandidates;
  if(readRoyal)(Dynasty as any).getRoyalMilitaryCandidates=function(...args:any[]){const rows=readRoyal.apply(this,args);for(const r of rows)if(!royalOffers.has(r.rulerId))royalOffers.set(r.rulerId,args[1]);return rows;};
  const {core,game}=await createNaturalCore(seed),started=performance.now();
  const original=(City.prototype as any).updateSiege,advanceOffices=(Military as any).advanceOffices;
  let reinforcementTransactions=0,reinforcedUnits=0;
  (Military as any).advanceOffices=function(...args:any[]){const before=new Map(Military.getFormations().map(f=>[f.commandId,new Set(f.memberUnitIds)])),result=advanceOffices.apply(this,args);
    for(const f of Military.getFormations()){const prior=before.get(f.commandId);if(!prior)continue;const added=f.memberUnitIds.filter(id=>!prior.has(id)).length;if(added){reinforcementTransactions++;reinforcedUnits+=added;}}
    return result;
  };
  let siegeCityMonths=0,contactMonth=-1;
  const forceSamples:Record<string,number>={};let localSiegeDeaths=0;
  const episodes:any[]=[],open=new Map<string,any>(),annual:any[]=[];
  const rawContact=City.prototype.registerSiegeContact;
  let contactCalls=0;
  City.prototype.registerSiegeContact=function(...args:Parameters<typeof rawContact>){contactCalls++;return rawContact.apply(this,args);};
  const seen=new Set<string>(),sizeSamples:Record<string,number>={},factionCommandSamples:Record<string,number>={};
  let politicalCandidateChecks=0,activeFormationSamples=0,totalFormationMembers=0,activeStateMonthSum=0;
  (City.prototype as any).updateSiege=function(month:number,...args:unknown[]){
    if(contactMonth!==month){seen.clear();contactMonth=month;}
    if(this.ownerTeam&&[...this.siegeContacts.values()].some((c:any)=>month-c.year<=1&&Diplomacy.canAttack(c.team.name,this.ownerTeam.name,month))&&!seen.has(this.id)){
      seen.add(this.id);siegeCityMonths++;
    }
    const owner=this.ownerFactionId,before=this.defense;
    const contactRows=[...this.siegeContacts.values()] as any[];
    const localDefenders=this.ownerTeam?siegeParticipants(this,this.ownerTeam,core,32,false).length:0;
    const populationBefore=core.teams.reduce((n,t)=>n+t.users.size,0);
    for(const c of contactRows){const attackers=siegeParticipants(this,c.team,core,32,true).length;const key=`${attackers}:${localDefenders}:${this.defense}:${this.maxDefense}`;forceSamples[key]=(forceSamples[key]??0)+1;}
    const result=original.call(this,month,...args);
    localSiegeDeaths+=Math.max(0,populationBefore-core.teams.reduce((n,t)=>n+t.users.size,0));
    let e=open.get(this.id);
    if(this.underSiege&&!e){e={cityId:this.id,owner,startMonth:month,capital:this.isCapital,contactCalls:0,damage:0};open.set(this.id,e);}
    if(e){e.contactCalls+=contactRows.reduce((n,c)=>n+c.count,0);e.damage+=Math.max(0,before-this.defense);
      if(this.ownerFactionId!==owner||!this.underSiege||this.destroyed){episodes.push({...e,endMonth:month,durationMonths:month-e.startMonth+1,result:this.ownerFactionId!==owner?'CAPTURED':this.destroyed?'DESTROYED':'CONTACT_ENDED'});open.delete(this.id);}}
    return result;
  };
  const royalCandidates=new Set<string>();
  const checkpoints:any[]=[],monthlyExposure={cityMonths:0,politicalCityMonths:0,supporters:0,identityBlocked:0,geographyBlocked:0,discontentBlocked:0};
  try{
    for(let m=1;m<=years*12;m++){
      for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);
      core.scene.sys.events.emit("postupdate");
      for(const city of core.allCities){
        if(city.destroyed)continue;monthlyExposure.cityMonths++;
        if(hasPopularPoliticalCrisis(city,m,core.totalCells)){const p=assessPopularSupport(city,m);monthlyExposure.politicalCityMonths++;monthlyExposure.supporters+=p.users.length;monthlyExposure.identityBlocked+=p.identityBlocked;monthlyExposure.geographyBlocked+=p.outsideArea;monthlyExposure.discontentBlocked+=p.discontentBlocked;}
      }
      if(m%12===0) for(const t of core.teams.filter(t=>t.status==="ACTIVE"&&t.identityStage==="STATE")){
        const d=Dynasty.get(t.name),current=Dynasty.getCurrentRuler(t.name);
        if(d&&current) for(const r of d.rulers)if(r.reignOrdinal===undefined&&(r.status==="heir"||r.status==="kin")&&m-r.bornYear>=216&&m-r.bornYear<65*12&&(r.naturalDeathYear??0)>m&&getRecordedKinRelation(r,current,d.rulers))royalCandidates.add(r.id);
      }
      if(m%12===0)annual.push({month:m,maxTerritoryShare:Math.max(0,...core.teams.map(t=>t.blocks.getLength()/core.totalCells)),activeStates:core.teams.filter(t=>t.status==="ACTIVE").length});
      activeStateMonthSum+=core.teams.filter(t=>t.status==="ACTIVE").length;
      const formations=Military.getFormations().filter(f=>f.status==="ACTIVE");
      const ids=formations.flatMap(f=>f.memberUnitIds);
      if(new Set(ids).size!==ids.length)throw Error('Duplicate active military member');
      for(const f of formations){const p=Military.getPerson(f.commanderPersonId)!,office=p.appointments.find(a=>a.commandId===f.commandId)?.officeHistory?.at(-1)?.office;
        const cap=MAX_FORMATION_UNITS===4?(office==='SHANGJIANGJUN'?4:office==='JIANGJUN'?3:office==='PIJIANG'?2:1):MAX_FORMATION_UNITS;
        if(f.memberUnitIds.length<1||f.memberUnitIds.length>cap)throw Error('Formation exceeds actual office capacity');
      }
      for(const f of formations){sizeSamples[f.memberUnitIds.length]=(sizeSamples[f.memberUnitIds.length]??0)+1;activeFormationSamples++;totalFormationMembers+=f.memberUnitIds.length;}
      for(const t of core.teams.filter(t=>t.status==="ACTIVE")){
        const count=formations.filter(f=>f.factionId===t.name).length;factionCommandSamples[count]=(factionCommandSamples[count]??0)+1;
        if(m%12===0)politicalCandidateChecks+=Military.getPoliticalInfluence(t,m,core.logicalUnitRegistry).candidates.length;
      }
      if(m%1200===0||m===years*12){
        const events=WorldHistory.getEvents(),people=Military.getPeople();
        const captures=events.filter(e=>["city-captured","city-recovered","capital-fallen"].includes(e.type));
        const battles=[...new Map(captures.map(e=>[`${e.monthIndex??e.year}:${e.cityId}:${e.actorFactionId}`,e])).values()];
        const promotions=people.flatMap(p=>p.appointments.flatMap(a=>(a.officeHistory??[]).filter(g=>g.office!=="XIAOWEI").map(g=>({office:g.office,waitMonths:g.month-a.startMonth}))));
        const ended=people.flatMap(p=>p.appointments.filter(a=>a.endMonth!==undefined));
        const matureEnded=ended.filter(a=>a.endMonth!-a.startMonth>=60);
        const p=core.getPopulationSummary();
        core.setWorldRunning(false);
        const snapshot=(()=>{try{return exportWorldSave(core);}catch(error){throw Error(JSON.stringify({seed,month:m,error:String(error),popularFoundings:WorldHistory.getEvents().filter(e=>e.metadata?.popularCrisisFacts).map(e=>({event:e,transfers:WorldHistory.getEvents().filter(x=>x.cityId===e.cityId).map(x=>({id:x.id,type:x.type,month:x.monthIndex??x.year,actor:x.actorFactionId,target:x.targetFactionId})),city:core.allCities.find(c=>c.id===e.cityId)?.history})),royalLinks:Military.getPeople().filter(p=>p.royalIdentity).map(p=>({person:structuredClone(p),formations:Military.getFormations().filter(f=>f.commanderPersonId===p.personId),bindings:core.teams.flatMap(t=>[...t.users]).filter(u=>u.militaryPersonId===p.personId||u.historicalPersonId===p.personId).map(u=>({userId:u.id,factionId:u.team.name,role:u.role,rulerId:u.rulerId,bornMonth:u.bornMonth,unitId:u.player.logicalUnitId})),owners:Dynasty.getAll().flatMap(d=>d.rulers.filter(r=>r.militaryIdentity?.personId===p.personId).map(r=>({factionId:d.factionId,ruler:structuredClone(r)})))}))}));}})(),validation=validateWorldSave(snapshot);
        const canonicalSha256 = await fingerprint(snapshot),baseFactsSha256=await fingerprint(snapshot,true);
        core.setWorldRunning(true);
        if(!validation.valid)throw new Error(`Invalid natural snapshot: ${validation.errors.join("; ")}`);
        if(p?.unexplainedWorldDifference!==0)throw new Error("Unexplained population difference");
        const count=(type:string)=>events.filter(e=>e.type===type).length;
        const royalPeople=people.filter(p=>p.royalIdentity),royals=Dynasty.getAll().flatMap(d=>d.rulers).filter(r=>r.militaryIdentity);
        const ordinary=core.teams.flatMap(t=>[...t.users]).filter(u=>u.role==="NORMAL"&&!u.militaryPersonId&&!u.historicalPersonId),ages=ordinary.map(u=>Math.floor((m-u.bornMonth)/12));
        const normalRoyalSuccessions=Dynasty.getAll().flatMap(d=>d.rulers.filter(r=>{
          const prior=d.rulers.find(p=>p.id===r.predecessorId);
          return r.accessionYear!==undefined&&r.accessionCause!=="DEPOSITION"&&!!prior&&r.houseName===prior.houseName&&!!getRecordedKinRelation(r,prior,d.rulers);
        }));
        checkpoints.push({militaryAppointmentDiagnostics:Military.getDiagnostics(),nobilityDiagnostics:militaryNobilityDiagnostics(people,Military.getFormations(),events,m),promotionDiagnostics:militaryPromotionDiagnostics(people,Military.getFormations(),events,m),singleCommanderBattles:events.filter(e=>e.type==="siege-started"&&e.metadata?.attackers===1&&typeof e.metadata.commandId==="string").length,singleCommanderCaptures:events.filter(e=>e.type==="siege-ended"&&e.metadata?.reason==="CAPTURED"&&e.metadata.attackers===1&&typeof e.metadata.commandId==="string").length,genealogyArchive:genealogyArchiveMetrics(),normalRoyalSuccessions:normalRoyalSuccessions.length,depositionDiagnostics:Dynasty.getInReignDepositionDiagnostics(m),royalMilitary:{normalAccessions:normalRoyalSuccessions.filter(r=>r.militaryIdentity).length,candidatePeople:[...royalOffers.values()].filter(at=>at<=m).length,adultKinObserved:royalCandidates.size,enlisted:royalPeople.length,victories:royalPeople.reduce((n,p)=>n+p.capturedEventIds.length,0),promotions:royalPeople.flatMap(p=>p.appointments.flatMap(a=>(a.officeHistory??[]).filter(g=>g.office!=="XIAOWEI"))).length,
          battleDeaths:royalPeople.filter(p=>["BATTLE_DEATH","SIEGE_LOSS"].includes(p.deathCause??"")).length,naturalDeaths:royalPeople.filter(p=>p.deathCause==="NATURAL_DEATH").length,accessions:royals.filter(r=>r.reignOrdinal!==undefined).length,
          identityConflicts:royalPeople.filter(p=>{const r=royals.find(r=>r.id===p.royalIdentity!.rulerId);return !r||r.militaryIdentity?.personId!==p.personId||r.deathMonth!==p.deathMonth||r.naturalDeathYear!==p.royalIdentity!.naturalDeathMonth;}).length,
          duplicateActiveMembers:formations.flatMap(f=>f.memberUnitIds).length-new Set(formations.flatMap(f=>f.memberUnitIds)).size},
          ordinaryResidentAges:{population:ages.length,mean:ages.length?ages.reduce((n,a)=>n+a,0)/ages.length:0,over70:ages.filter(a=>a>=70).length,over90:ages.filter(a=>a>=90).length,over100:ages.filter(a=>a>=100).length,over120:ages.filter(a=>a>=120).length,over150:ages.filter(a=>a>=150).length,max:Math.max(0,...ages)},
          month:m,worldPopulation:p?.closingWorldPopulation,populationUnexplained:p?.unexplainedWorldDifference,
          naturalGrowth:p?.totals.naturalGrowth,warDeaths:p?.totals.warDeaths,activeStates:core.teams.filter(t=>t.status==="ACTIVE").length,historicalStates:core.teams.length,cities:core.allCities.length,
          captures:battles.length,recoveries:count("city-recovered"),siegeCityMonths,capturesPer100SiegeCityMonths:siegeCityMonths?battles.length/siegeCityMonths*100:0,
          formationSizeSamples:{...sizeSamples},factionCommandSamples:{...factionCommandSamples},meanFormationSize:activeFormationSamples?totalFormationMembers/activeFormationSamples:0,
          siegeResults:(()=>{const ended=events.filter(e=>e.type==="siege-ended"),started=events.filter(e=>e.type==="siege-started");
            const durations=ended.map(e=>(e.monthIndex??e.year)-Number(e.metadata?.startMonth)+1);
            const capital=ended.filter(e=>e.metadata?.wasCapital===1),ordinary=ended.filter(e=>e.metadata?.wasCapital===0);
            const counts=(xs:typeof ended)=>({ended:xs.length,captured:xs.filter(e=>e.metadata?.reason==="CAPTURED").length,failed:xs.filter(e=>e.metadata?.reason==="REPULSED").length,withdrawn:xs.filter(e=>e.metadata?.reason!=="CAPTURED"&&e.metadata?.reason!=="REPULSED").length});
            const credited=people.flatMap(p=>p.capturedEventIds.map(id=>({person:p.personId,id}))),duplicateCredit=credited.length-new Set(credited.map(c=>c.id)).size;
            const transferKeys=new Set([...core.allCities,...ArchivedCities.list()].flatMap(c=>c.history.filter(h=>h.type==="captured"||h.type==="recovered").map(h=>`${h.year}:${c.id}:${h.newOwnerFactionId}`)));
            const noTransfer=battles.filter(e=>!transferKeys.has(`${e.monthIndex??e.year}:${e.cityId}:${e.actorFactionId}`)).length;
            return {started:started.length,...counts(ended),meanDurationMonths:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0,capital:counts(capital),ordinary:counts(ordinary),defended:events.filter(e=>e.type==="siege-defended").length,duplicateCredit,unattributedOwnershipChanges:noTransfer,capturesPerActiveStateYear:battles.length/(activeStateMonthSum/12),militaryDeaths:people.filter(p=>p.status==="DEAD").length,retirements:Military.getOfficeSummary(m).ageRetirements};})(),
          reinforcementTransactions,reinforcedUnits,initialFormationSizes:events.filter(e=>e.type==="military-appointment").map(e=>e.metadata?.unitCount),maximumFormationSize:Math.max(0,...Object.keys(sizeSamples).map(Number)),
          appointments:Military.getDiagnostics().appointments,offices:Military.getOfficeSummary(m),promotions,
          meanServiceMonths:Military.getOfficeSummary(m).meanServiceMonths,matureEnded:matureEnded.length,matureEndedNeverPromoted:matureEnded.filter(a=>(a.officeHistory?.length??0)<2).length,
          politicalCandidateChecks,militaryPoliticalEvents:events.filter(e=>readMilitaryParticipation(e)).length,depositions:count("ruler-deposed"),usurpations:count("dynasty-usurped"),
          extinctions:count("faction-extinct"),unifications:count("world-unification"),splits:count("empire-split"),restorations:count("faction-restored"),rebellions:count("rebel-faction-founded")+count("frontier-faction-founded"),classicRebellions:count("rebel-faction-founded"),frontierRebellions:count("frontier-faction-founded"),
          ...(includeSnapshot?{snapshot}:{}),canonicalSha256,baseFactsSha256,monthlyExposure:{...monthlyExposure},issuingRulerGrants:events.filter(e=>e.type==="military-office-granted"&&e.rulerId&&e.metadata?.authorizingRulerTitle).length, worldRandomPosition:snapshot.worldRandom.position,
          regional:(core.simulator as any).events.getRegionalRebellionSnapshot(),
          militaryRoyalOverlap:snapshot.users.filter(u=>u.militaryPersonId&&(u.role==="RULER"||u.rulerId)&&snapshot.registries.militaryCommandRegistry.people.find(p=>p.personId===u.militaryPersonId)?.politicalRulerId!==u.rulerId).length,
          politicalMilitaryBindings:snapshot.users.filter(u=>u.militaryPersonId&&u.historicalPersonId===u.militaryPersonId).length,
          duplicatePopulationIds:snapshot.users.length-new Set(snapshot.users.map(u=>u.userId)).size,
          currentMilitaryByRegime:core.teams.filter(t=>t.status==="ACTIVE").map(t=>({factionId:t.name,factionType:t.factionType,stage:t.identityStage,rank:t.sovereigntyRank,
            population:t.users.size,commands:formations.filter(f=>f.factionId===t.name).length})),
          meanActiveStates:activeStateMonthSum/m,
          meanEndedStateLifetimeMonths:(()=>{const ts=core.teams.filter(t=>t.status==="EXTINCT");return ts.length?ts.reduce((sum,t)=>sum+Math.max(0,(t.extinctionYear??m)-t.firstFoundedYear),0)/ts.length:0;})(),
          militarySplits:events.filter(e=>e.type==="empire-split"&&e.metadata?.splitSource==="MILITARY").length,
          formationOwnershipConflicts:formations.filter(f=>f.memberUnitIds.some(id=>!core.teams.find(t=>t.name===f.factionId)?.users.has(core.teams.flatMap(t=>[...t.users]).find(u=>u.player.logicalUnitId===id)!))).length,
          residentFounders:snapshot.dynasties.flatMap(d=>(d.rulers as any[]).filter(r=>r.residentIdentity)).length,
          residentLiveBindings:snapshot.users.filter(u=>u.historicalPersonId).length,
          residentIdentityConflicts:(()=>{const rs=snapshot.dynasties.flatMap(d=>(d.rulers as any[]).filter(r=>r.residentIdentity));const ids=rs.map(r=>r.residentIdentity.personId);return ids.length-new Set(ids).size+snapshot.users.filter(u=>u.historicalPersonId&&!royals.some(r=>r.militaryIdentity?.personId===u.historicalPersonId)&&!rs.some(r=>r.residentIdentity.personId===u.historicalPersonId&&r.residentIdentity.sourceUserId===u.userId&&r.bornMonth===u.bornMonth&&r.deathMonth===undefined)).length;})(),
          strictSaveValid:true,elapsedMs:performance.now()-started,heapBytes:(performance as any).memory?.usedJSHeapSize});
      }
      if(m%120===0)await new Promise(r=>setTimeout(r,0));
    }
    return {seed,years,contactCalls,forceSamples,localSiegeDeaths,depositionRelations:WorldHistory.getEvents().filter(e=>e.type==="ruler-deposed").map(e=>({month:e.monthIndex??e.year,metadata:e.metadata})),episodes,ongoingEpisodes:[...open.values()],annual,unificationMonths:WorldHistory.getEvents().filter(e=>e.type==="world-unification").map(e=>e.monthIndex??e.year),mode:"real Arcade Core / default warring states",denominator:"hostile-contact city-months entering real City.updateSiege; capture frequency, not battle win probability",checkpoints};
  }finally{if(readRoyal)(Dynasty as any).getRoyalMilitaryCandidates=readRoyal;(Military as any).advanceOffices=advanceOffices;City.prototype.registerSiegeContact=rawContact;(City.prototype as any).updateSiege=original;game.destroy(true);}
}
