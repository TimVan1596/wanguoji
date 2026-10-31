import { describe, expect, it } from "vitest";
import { DiplomacyRegistry, DiplomacySystem, type DiplomacyEmission } from "./Diplomacy";
import { evaluateCommonThreatCredibility, getDiplomaticDuration, getDiplomaticCooldown, type CommonThreatFacts } from "./DiplomaticRules";
import worldRandom from "../Simulation/WorldRandom";
import { DiplomacyObservations } from "./DiplomacyObservations";
function team(name: string, xs: number[], loyalty=60) {
  return {name,status:"ACTIVE",isDie:false,blocks:{children:{size:xs.length,entries:xs.map(x=>({x,y:0}))}},cities:[{loyalty}]} as never;
}
const a=team("a",[0]), b=team("b",[4]);
const threat=team("threat",[1,3,...Array.from({length:38},(_,i)=>100+i)]);
const distant=team("threat",Array.from({length:40},(_,i)=>100+i));
const severeTeams=[a,b,threat];
const facts: CommonThreatFacts={territoryShareA:10,territoryShareB:10,threatTerritoryShare:40,directA:false,directB:false,adjacentPair:false,priorRelationMonths:0,capturedA:false,capturedB:false,capitalFall:false};
const nap = {factionAId:"a",factionBId:"b",status:"NON_AGGRESSION" as const,startedMonth:0,expiresMonth:96,reason:"COMMON_THREAT_NON_AGGRESSION" as const,commonThreatFactionId:"threat"};
const alliance = {...nap,status:"ALLIANCE" as const,reason:"COMMON_THREAT_ALLIANCE" as const,preconditionStatus:"NON_AGGRESSION" as const,preconditionDurationMonths:24,expiresMonth:72};
function system(debug=true) {
  const registry=new DiplomacyRegistry(debug),events:DiplomacyEmission[]=[];
  return {registry,events,system:new DiplomacySystem(registry,()=>[],e=>events.push(e),1)};
}
describe("Diplomacy II factual rules",()=>{
  it("distant size alone is WEAK and never forms NAP",()=>{
    expect(evaluateCommonThreatCredibility(facts)).toBe("WEAK");
    const s=system(); s.system.update(12,[a,b,distant],100,[]); expect(s.registry.list()).toEqual([]);
    expect(s.registry.getDiagnostics(12).diplomacyII?.sessionCumulative.noStrategicContactBlocked).toBeGreaterThan(0);
  });
  it("one exposed partner needs a real corridor or aged relation to be credible",()=>{
    const f={...facts,directA:true};
    expect(evaluateCommonThreatCredibility(f)).toBe("WEAK");
    expect(evaluateCommonThreatCredibility({...f,adjacentPair:true})).toBe("CREDIBLE");
    expect(evaluateCommonThreatCredibility({...f,priorRelationMonths:24})).toBe("CREDIBLE");
    const s=system(); s.system.update(12,[team("a",[0]),team("b",[-1]),threat],100,[]);
    expect(s.registry.get("a","b")?.status).toBe("NON_AGGRESSION");
  });
  it("both strategic contacts are severe and support an aged NAP upgrade",()=>{
    expect(evaluateCommonThreatCredibility({...facts,directA:true,directB:true})).toBe("SEVERE");
    const s=system();s.registry.setRelation(nap);s.system.update(24,severeTeams,100,[]);
    expect(s.registry.get("a","b")).toMatchObject({status:"ALLIANCE",startedMonth:24,originalStartedMonth:0});
  });
  it("credible alone requires 72 months of NAP before alliance",()=>{
    const teams=[team("a",[0]),team("b",[-1]),threat];
    const s=system();s.registry.setRelation(nap);s.system.update(24,teams,100,[]);
    expect(s.registry.get("a","b")?.status).toBe("NON_AGGRESSION");s.system.update(72,teams,100,[]);
    expect(s.registry.get("a","b")?.status).toBe("ALLIANCE");
  });
  it("recent factual captures supply direct exposure without adjacency",()=>{
    const s=system();s.system.update(12,[a,b,distant],100,[{type:"city-captured",actorFactionId:"threat",targetFactionId:"a"},{type:"capital-fallen",actorFactionId:"threat",targetFactionId:"b"}] as never);
    expect(s.registry.get("a","b")?.status).toBe("NON_AGGRESSION");
    expect(s.events[0].triggerContext?.reason).toBe("COMMON_THREAT_NON_AGGRESSION");
    expect((s.events[0].triggerContext as any).priorStatus).toBeUndefined();
    expect(s.events[0].triggerContext).toMatchObject({directA:true,directB:true,capitalFall:true});
  });
  it.each(["TRUCE","NON_AGGRESSION","ALLIANCE"] as const)("%s has deterministic, whole-year, bounded varied duration",status=>{
    const bounds=status==="TRUCE"?[24,60]:status==="NON_AGGRESSION"?[72,144]:[96,180];const results=new Set<number>();
    for(let captures=0;captures<8;captures++) for(const credibility of ["WEAK","CREDIBLE","SEVERE"] as const) for(const loyalty of [20,40,80]) {
      const f={credibility,recentBilateralCaptureCount:captures,stabilityA:loyalty,stabilityB:loyalty,capitalFall:captures>3,directA:captures>2,directB:captures>2,priorDurationMonths:captures*24,threatTerritoryShare:captures*10,territoryShareA:10,territoryShareB:10};
      const duration=getDiplomaticDuration(status,f);results.add(duration);expect(duration).toBe(getDiplomaticDuration(status,f));expect(duration%12).toBe(0);expect(duration).toBeGreaterThanOrEqual(bounds[0]);expect(duration).toBeLessThanOrEqual(bounds[1]);
    }
    expect(results.size).toBeGreaterThan(1);
  });
  it("pure rules and diagnostic reads consume no RNG",()=>{
    const before=worldRandom.exportState();const s=system();
    for(let i=0;i<20;i++){evaluateCommonThreatCredibility(facts);getDiplomaticDuration("ALLIANCE",facts);s.registry.getDiagnostics(i);}
    expect(worldRandom.exportState()).toEqual(before);
  });
});
describe("Diplomacy II durable lifecycle",()=>{
  it("renews an alliance in place without resetting either start; repeated evaluation is idempotent",()=>{
    const s=system();s.registry.setRelation(alliance);const before=worldRandom.exportState();
    s.system.update(60,severeTeams,100,[]);s.system.update(60,severeTeams,100,[]);
    expect(s.registry.list()).toHaveLength(1);expect(s.registry.get("b","a")).toMatchObject({status:"ALLIANCE",startedMonth:0,originalStartedMonth:0,lastRenewedMonth:60,renewalCount:1});
    expect(s.registry.get("a","b")!.expiresMonth).toBeGreaterThan(72);expect(s.events.filter(e=>e.type==="relation-renewed")).toHaveLength(1);
    expect(s.events[0].triggerContext).toMatchObject({previousExpiresMonth:72,renewalDuration:168,credibility:"SEVERE"});
    expect(s.registry.canAttack("a","b",100)).toBe(false);expect(worldRandom.exportState()).toEqual(before);
  });
  it("TRUCE→NAP→Alliance upgrades retain the whole chain start and do not produce redundant same-boundary renewal",()=>{
    const s=system();s.registry.setRelation({...nap,status:"TRUCE",reason:"WAR_EXHAUSTION_TRUCE",expiresMonth:36});
    s.system.update(24,severeTeams,100,[]);expect(s.registry.get("a","b")).toMatchObject({status:"NON_AGGRESSION",startedMonth:24,originalStartedMonth:0});
    expect(s.events.some(e=>e.type==="relation-renewed")).toBe(false);
    s.system.update(48,severeTeams,100,[]);expect(s.registry.get("a","b")).toMatchObject({status:"ALLIANCE",startedMonth:48,originalStartedMonth:0});
  });
  it("NAP renews with credible exposure even when too short to upgrade",()=>{
    const s=system();s.registry.setRelation({...nap,startedMonth:48,expiresMonth:72});
    s.system.update(60,severeTeams,100,[]);expect(s.registry.get("a","b")).toMatchObject({status:"NON_AGGRESSION",startedMonth:48,renewalCount:1});
  });
  it.each(["NON_AGGRESSION","ALLIANCE"] as const)("%s does not renew after strategic pressure disappears",status=>{
    const s=system();s.registry.setRelation({...alliance,status,reason:status==="ALLIANCE"?"COMMON_THREAT_ALLIANCE":"COMMON_THREAT_NON_AGGRESSION"});s.system.update(60,[a,b,distant],100,[]);
    expect(s.events.some(e=>e.type==="relation-renewed")).toBe(false);s.system.update(72,[a,b,distant],100,[]);expect(s.registry.get("a","b")).toBeUndefined();expect(s.registry.memory("a","b")?.endedMonth).toBe(72);
  });
  it("TRUCE cannot renew without remaining real war-recovery evidence",()=>{
    const s=system();s.registry.setRelation({...nap,status:"TRUCE",reason:"WAR_EXHAUSTION_TRUCE",expiresMonth:36});s.system.update(24,[a,b],100,[]);
    expect(s.registry.get("a","b")?.expiresMonth).toBe(36);s.system.update(36,[a,b],100,[]);expect(s.registry.get("a","b")).toBeUndefined();
  });
  it("TRUCE can renew while captures and low stability still support recovery",()=>{
    const s=system();s.registry.setRelation({...nap,status:"TRUCE",reason:"WAR_EXHAUSTION_TRUCE",expiresMonth:36});s.system.update(24,[team("a",[0],30),b],100,[{type:"city-captured",actorFactionId:"a",targetFactionId:"b"}] as never);
    expect(s.registry.get("a","b")).toMatchObject({startedMonth:0,lastRenewedMonth:24,renewalCount:1});
  });
  it("expiry creates one pair memory; cooldown blocks immediate reformation then permits real cooperation",()=>{
    const s=system();s.registry.setRelation({...nap,expiresMonth:24});s.system.update(24,severeTeams,100,[]);
    expect(s.registry.get("a","b")).toBeUndefined();expect(s.registry.exportState().pairMemories).toHaveLength(1);
    s.system.update(36,severeTeams,100,[]);expect(s.registry.get("a","b")).toBeUndefined();
    s.system.update(48,severeTeams,100,[]);expect(s.registry.get("a","b")?.startedMonth).toBe(48);
    expect(s.registry.getDiagnostics(48).diplomacyII?.sessionCumulative.reformedAfterCooldown).toBe(1);
  });
  it("canonical continuity and pair memory JSON round-trip; debug data never enter state",()=>{
    const s=system();s.registry.setRelation(alliance);s.system.update(60,severeTeams,100,[]);
    s.registry.setRelation({...nap,factionAId:"c",factionBId:"d",expiresMonth:60});s.system.update(61,severeTeams,100,[]);
    const dto=JSON.parse(JSON.stringify(s.registry.exportState()));const restored=new DiplomacyRegistry();restored.importState(dto);expect(restored.exportState()).toEqual(dto);
    expect(dto).not.toHaveProperty("observations");expect(dto.pairMemories).toHaveLength(1);
  });
  it("renewal does not consume either of the two new relation slots",()=>{
    const s=system();s.registry.setRelation(alliance);
    const e=team("e",[0]),f=team("f",[4]),g=team("g",[0]),h=team("h",[4]);
    s.system.update(60,[...severeTeams,e,f,g,h],100,[]);
    expect(s.events.filter(e=>e.type==="relation-renewed")).toHaveLength(1);
    expect(s.events.filter(e=>e.type==="non-aggression-signed")).toHaveLength(2);
  });
  it("caps remain two relations and one alliance per faction",()=>{
    const s=system();s.registry.setRelation(alliance);s.registry.setRelation({...nap,factionBId:"c"});s.registry.setRelation({...nap,factionAId:"b",factionBId:"d"});
    const teams=[...severeTeams,team("c",[4]),team("d",[0]),team("e",[4])];s.system.update(24,teams,100,[]);
    for(const t of teams){const rs=s.registry.list().filter(r=>r.factionAId===(t as any).name||r.factionBId===(t as any).name);expect(rs.length).toBeLessThanOrEqual(2);expect(rs.filter(r=>r.status==="ALLIANCE").length).toBeLessThanOrEqual(1);}
  });
  it("debug on/off yields identical seeded canonical lifecycle and RNG position",()=>{
    const run=(debug:boolean)=>{worldRandom.initialize("diplomacy-ii");const s=system(debug);for(let month=12;month<=1200;month+=12){s.system.update(month,severeTeams,100,[]);s.registry.getDiagnostics(month);}return {state:s.registry.exportState(),rng:worldRandom.exportState()};};
    expect(run(true)).toEqual(run(false));
  });
  it("memory is bounded to one latest record per pair and terminal cleanup releases it",()=>{
    const s=system();for(let i=0;i<100;i++){s.registry.setRelation({...nap,startedMonth:i*100,expiresMonth:i*100+24});s.registry.expire(s.registry.get("a","b")!,i*100+24);}expect(s.registry.exportState().pairMemories).toHaveLength(1);s.registry.removeFaction("a");expect(s.registry.exportState().pairMemories).toEqual([]);
  });
  it("cooldown durations stay bounded and deterministic",()=>{for(const status of ["TRUCE","NON_AGGRESSION","ALLIANCE"] as const)for(const duration of [24,60,120,180,900])expect(getDiplomaticCooldown(status,duration)).toBe(getDiplomaticCooldown(status,duration));});
  it("density derives from current authoritative faction IDs even immediately after load",()=>{
    const s=system();s.registry.setRelation(nap);const restored=new DiplomacyRegistry();restored.importState(s.registry.exportState());
    expect(restored.getDiagnostics(12,["a","b"])).toMatchObject({activeRelationCount:1,activeRelationDensity:1,factionsWith1Relation:2});
  });
  it("session diagnostics are cumulative; recent window and buffers are bounded",()=>{
    const o=new DiplomacyObservations();for(let month=0;month<=2400;month+=12){o.record({month,kind:"formation",duration:72});o.record({month,kind:"blocker",reason:"COOLDOWN"});}
    const d=o.snapshot(2400);expect(d.sessionCumulative.formation).toBe(201);expect(d.recent100Years.formation).toBe(101);expect(d.sessionCumulative.meanInitialDuration).toBe(72);expect(d.sessionCumulative.medianInitialDuration).toBe(72);expect(d.recentLifecycle).toHaveLength(10);expect(d.recentCandidateBlockers).toHaveLength(10);
  });
});
