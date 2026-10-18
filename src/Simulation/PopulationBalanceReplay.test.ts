import { beforeAll, afterEach, afterAll, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import xBaseline from "./testing/PopulationXBaseline.json";
import { PopulationTransitionAudit } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";
const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core, BlockSize: 32 } }));
vi.mock("../Components/Farms", () => ({ default: class { init() {} setDie() {} } }));
vi.mock("../Components/Player", () => ({ default: class {
  active=true; logicalUnitId?:string; user:any; role="NORMAL";
  constructor(_scene:any, public x:number, public y:number, public team:any) {}
  setTeam(t:any){this.team=t;} setRole(r:string){this.role=r;} tp(){} destroyPlayerTree(){this.active=false;}
} }));
vi.mock("../Components/Slaves", () => ({ default: class { dispose(){} reset(){} children={each(){}}; } }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }), dispatch: vi.fn() } }));
vi.mock("../Politics/Dynasty", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
let Lifetime:any, Team:any, User:any, City:any, Population:any, History:any, Military:any, Effects:any, Diplomacy:any, Events:any, Factions:any, AutoSim:any, Submission:any;
beforeAll(async()=>{
  class Group { children={size:0,entries:[] as any[]}; add(v:any){this.children.entries.push(v);this.children.size++;} remove(v:any){this.children.entries=this.children.entries.filter(x=>x!==v);this.children.size=this.children.entries.length;} }
  vi.stubGlobal("Phaser",{GameObjects:{Rectangle:class{},Group},Math:{Clamp:(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))},Display:{Align:{In:{Center(){}}},Color:{HSLToColor:()=>({color:12345})}}});
  Lifetime=(await import("./FactionLifetimeRecord")).default;
  Team=(await import("../Components/Team")).default; User=(await import("../Components/User")).default;
  City=(await import("../Components/City")).default; Population=(await import("./PopulationSystem")).default;
  History=(await import("../History/WorldHistory")).default; Military=(await import("../Politics/MilitaryCommandRegistry")).default;
  Effects=(await import("./FactionEffects")).default; Diplomacy=(await import("../Politics/Diplomacy")).default;
  Events=(await import("./WorldEventSystem")).default;
  Factions=(await import("./FactionRegistry")).default; AutoSim=(await import("./AutoSimulator")).default;
  Submission=(await import("./PeacefulSubmissionExecution")).executePeacefulSubmission;
});
afterEach(()=>{vi.restoreAllMocks();}); afterAll(()=>{vi.unstubAllGlobals();});

function fixture(seed:number, population=10, cityCount=1) {
  Lifetime.reset(); History.reset(); Military.reset(); Effects.reset(); Diplomacy.reset(); Factions.reset();worldRandom.initialize(`population-replay-${seed}`);
  vi.spyOn(User.prototype,"load").mockImplementation(()=>{}); // renderer asset loading only
  core.scene={}; core.map={getBlock:()=>({x:0,y:0})}; core.recordUserDeathForDiagnostics=()=>{};
  core.handleRulerCombatDeath=()=>false;core.logicalGameplayAuthority=true;
  let sequence=1;const entries=new Map<string,any>();
  core.logicalUnitRegistry={registerPlayer(player:any,user:any){const unitId=`unit-${sequence++}`;player.logicalUnitId=unitId;entries.set(unitId,{player,user,state:{unitId,userId:user.id,factionId:user.team.name,alive:true,role:"NORMAL",logicalX:0,logicalY:0}});},
    getEntry:(id:string)=>entries.get(id),unregisterUser:(u:any)=>entries.delete(u.player.logicalUnitId),updateFaction:(id:string,t:any)=>{const e=entries.get(id);if(e)e.state.factionId=t.name;}};
  const make=(name:string)=>new Team({},name,1,0,0,[],undefined,name,"田氏",undefined,undefined,undefined,undefined,false);
  const team=make("守国"),enemy=make("敌国");core.teams=[team,enemy];
  core.addRuntimeTeam=(t:any)=>{core.teams.push(t);return true;};core.releaseTerminalTeamColliders=()=>{};
  const blocks=Array.from({length:16},(_,x)=>Array.from({length:16},(_,y)=>({scene:{renderer:{width:512,height:512}},x:x*32,y:y*32,team:x<8?team:enemy,city:undefined as any,
    updateCityDisplay(){},claimForTeam(t:any){if(this.team===t)return;this.team.blocks.remove(this);this.team=t;t.blocks.add(this);}})));
  for(const row of blocks)for(const block of row)block.team.blocks.add(block);
  core.map={blocks,getBlock:(x:number,y:number)=>blocks[x]?.[y]};
  team.cities=Array.from({length:cityCount},(_,i)=>{
    const block=blocks[i*2][0];
    const c=Object.assign(Object.create(City.prototype),{id:`city-${i}`,name:`城${i}`,ownerFactionId:team.name,founderFactionId:team.name,block,isCapital:i===0,
      foundedYear:0,history:[],captureCount:0,fortifiedCells:[block],defense:100000,maxDefense:100000,loyalty:85,devastation:0,lastCapturedYear:undefined,
      lastSiegeDamageYear:-1,lastSiegeDevastationYear:0,siegeDamageRemainder:0,siegeContacts:new Map(),refreshZoneVisual(){},rebuildFortifiedZone(){},
      claimFortifiedZone(owner:any){block.claimForTeam(owner);},setCapital(value:boolean){this.isCapital=value;},});
    block.city=c;return c;
  });
  const audit=new PopulationTransitionAudit(),populationSystem=new Population(),eventSystem=new Events();
  const totals:Record<string,number>={};
  core.simulator={year:0,recordPopulationMutation(t:any,b:number,a:number,m:any){totals[m.cause]=(totals[m.cause]??0)+(a-b);audit.record(t,b,a,m);},
    canApplyWartimePopulationLoss:(t:any,m:number)=>populationSystem.canApplyWartimeLoss?.(t,m)??true,
    recordWartimePopulationLoss:(t:any,m:number)=>populationSystem.recordWartimeLoss?.(t,m)};
  populationSystem.initialize([team],{[team.name]:population});audit.reset(0,core.teams);Object.keys(totals).forEach(k=>delete totals[k]);
  return {team,enemy,audit,populationSystem,eventSystem,totals,entries};
}

it("fixed-seed actual production demographic replay (controlled siege contacts, not a Core natural-world runner)",()=>{
  const rows:any[]=[];
  for(const scenario of ["peace","one-siege","three-sieges","small-immigration","rebellion","split","union","submission"]){
    for(let seed=0;seed<8;seed++){
      const f=fixture(seed,scenario==="small-immigration"?4:10,scenario==="split"?4:["three-sieges","rebellion"].includes(scenario)?3:1);
      const initialUsers=[...f.team.users] as any[];
      const initial=f.team.users.size;let zeros=0,maxMonthDelta=0,minWar=initial,last=initial;
      if(scenario==="small-immigration"){
        vi.spyOn(f.eventSystem,"pickRandomEventType").mockReturnValue("population-boom");
        vi.spyOn(f.eventSystem,"pickFaction").mockReturnValue(f.team);
        (f.eventSystem as any).triggerRandomEvent(0,[f.team],256);
        maxMonthDelta=f.team.users.size-last;last=f.team.users.size;
      }
      if(scenario==="rebellion"||scenario==="split") {
        for(const u of f.team.users)u.loyalty=20;
        const city=f.team.cities[1];
        for(const c of f.team.cities)c.loyalty=20;
        for(const u of f.team.users)Object.assign(f.entries.get(u.player.logicalUnitId).state,{logicalX:city.block.x+16,logicalY:16});
        const created=scenario==="rebellion"?Factions.createRebelFaction({city,year:0,factionType:"REBEL"}):Factions.createSplitFaction(f.team,[city],0)?.team;
        expect(created).toBeDefined();last=f.team.users.size;maxMonthDelta=Math.max(maxMonthDelta,Math.abs(last-initial));
      }
      if(scenario==="union") (AutoSim.prototype as any).mergeFaction.call({}, {absorbedFaction:f.team,absorbingFaction:f.enemy,alliance:{status:"ALLIANCE",startedMonth:-120,expiresMonth:120}},0);
      if(scenario==="submission") Submission({submitted:f.team,receiving:f.enemy,evidence:{},path:"PEACEFUL"},0);
      const actualTransferred=initialUsers.filter(u=>u.team!==f.team).length;
      const foundingWorldNet=core.teams.reduce((n:number,t:any)=>n+t.users.size,0)-initial;
      const months=["rebellion","split","union","submission"].includes(scenario)?0:scenario==="small-immigration"?60:2400;
      const checkpoints:Record<string,number>={};
      for(let month=1;month<=months;month++){
        core.simulator.year=month;
        const war=scenario.includes("siege") && month<=60;
        for(const c of f.team.cities){c.siegeContacts=war?new Map([[f.enemy.name,{team:f.enemy,count:3,year:month}]]):new Map();c.underSiege=war;if(war)(c as any).updateSiege(month);}
        f.eventSystem.settlePopulationEffects?.(month,core.teams);
        f.populationSystem.update(month,[f.team],()=>f.eventSystem.getPopulationGrowthMultiplier(f.team));
        const next=f.team.users.size;if(last>0&&next===0)zeros++;maxMonthDelta=Math.max(maxMonthDelta,Math.abs(next-last));if(war)minWar=Math.min(minWar,next);last=next;
        if(month%120===0)checkpoints[String(month/12)]=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);
        f.audit.reconcile(month,core.teams);
      }
      f.audit.reconcile(months,core.teams);
      expect(f.audit.getRuntimeCardinality().populationAuditRecent).toBeLessThanOrEqual(240);
      expect(f.audit.getRuntimeCardinality().populationAuditMonthBuckets).toBeLessThanOrEqual(12);
      const final=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),explained=Object.values(f.totals).reduce((a,b)=>a+b,0);
      expect(initial+explained).toBe(final);
      expect(f.audit.getRecent().some(r=>r.cause==="UNATTRIBUTED")).toBe(false);
      rows.push({scenario,seed,years:months/12,initial,final,countryFinal:f.team.users.size,actualTransferred,foundingWorldNet,created:core.teams.length-2,extinct:core.teams.filter((t:any)=>t.status==="EXTINCT").length,checkpoints,minWar,zeros,maxMonthDelta,natural:f.totals.NATURAL_GROWTH??0,warDeaths:-(f.totals.SIEGE_LOSS??0),external:f.totals.IMMIGRATION??f.totals.RANDOM_EVENT??0,special:f.totals.SPECIAL_EVENT??0,unexplained:final-initial-explained,defense:f.team.cities.reduce((n:number,c:any)=>n+c.defense,0)});
      vi.restoreAllMocks();
    }
  }
  expect(xBaseline.baselineHead).toBe("122e470e5a507cb1af413cc617382f5891fb30fb");
  const mean=(scenario:string,key:string)=>{const selected=rows.filter(r=>r.scenario===scenario);return selected.reduce((n,r)=>n+r[key],0)/selected.length;};
  expect(rows.filter(r=>r.scenario==="peace").reduce((n,r)=>n+r.checkpoints["20"],0)/8).toBeGreaterThan(xBaseline.meanResults.peace.populationAt20Years);
  for(const scenario of ["one-siege","three-sieges"]){
    expect(mean(scenario,"zeros")).toBe(0);
    expect(mean(scenario,"warDeaths")).toBeLessThan(xBaseline.meanResults[scenario as "one-siege"|"three-sieges"].warDeaths);
  }
  expect(mean("small-immigration","external")).toBeLessThanOrEqual(2);
  expect(mean("rebellion","foundingWorldNet")).toBe(0);expect(mean("split","foundingWorldNet")).toBe(0);
  console.log("POPULATION_PRODUCTION_REPLAY", `${rows.length} controlled production runs; 8 fixed seeds; up to 200 years; all population sources reconciled`);
  if(process.env.WANGUOJI_POPULATION_REPLAY_OUTPUT)writeFileSync(process.env.WANGUOJI_POPULATION_REPLAY_OUTPUT,JSON.stringify(rows,null,2));
},20000);

it("growth follows actual control and bounded city conditions, not political titles or inactive markers",async()=>{
  const {getPopulationCapacity}=await import("./PopulationSystem");
  const {getPopulationRecoveryContext}=await import("./PopulationRecoveryRules");
  const f=fixture(1,4,1), count=f.team.users.size;
  expect(getPopulationCapacity(f.team)).toBe(24);
  const peace=getPopulationRecoveryContext(f.team,3).multiplier;
  const next=vi.spyOn(worldRandom,"next").mockReturnValue(.3);
  f.populationSystem.update(3,[f.team]);expect(f.team.users.size).toBe(count+1);
  f.team.cities[0].underSiege=true;f.team.cities[0].devastation=90;
  expect(getPopulationRecoveryContext(f.team,6).multiplier).toBeLessThan(peace);
  f.populationSystem.update(6,[f.team]);expect(f.team.users.size).toBe(count+1);
  next.mockReturnValue(0);
  f.team.blocks.children.size=1;
  for(let m=9;m<90;m+=3)f.populationSystem.update(m,[f.team]);
  expect(f.team.users.size).toBe(8);
  f.team.blocks.children.size=0;f.populationSystem.update(90,[f.team]);
  expect(getPopulationCapacity(f.team)).toBe(0);expect(f.team.users.size).toBe(8);
  f.team.blocks.children.size=10000;
  for(const status of ["EXILED","EXTINCT"]){f.team.status=status;f.populationSystem.update(93,[f.team]);expect(getPopulationCapacity(f.team)).toBe(0);expect(f.team.users.size).toBe(8);}
});

it("an active land-holding zero-population country can recover; an exiled country cannot",()=>{
  const f=fixture(2,0,1);vi.spyOn(worldRandom,"next").mockReturnValue(0);
  f.populationSystem.update(3,[f.team]);expect(f.team.users.size).toBe(1);
  f.team.users.values().next().value.destroyUser(false,{cause:"BATTLE_DEATH",month:3});
  f.team.status="EXILED";f.populationSystem.update(6,[f.team]);expect(f.team.users.size).toBe(0);
});

it("three simultaneous sieges share a persisted national casualty clock; defense keeps progressing",()=>{
  const f=fixture(3,6,3), before=f.team.users.size;
  core.simulator.year=1;
  for(const city of f.team.cities){city.siegeContacts=new Map([[f.enemy.name,{team:f.enemy,count:3,year:1}]]);city.updateSiege(1);}
  expect(f.team.cities.map((c:any)=>c.defense)).toEqual([99999,99999,99999]);
  expect(f.team.users.size).toBe(before-1);
  expect(f.team.removeOneUser("SIEGE_LOSS",{month:1,damageSource:"HOSTILE_HOME_OCCUPATION"})).toBeUndefined();
  const saved=JSON.parse(JSON.stringify(f.populationSystem.exportState()));
  const loaded=new Population();loaded.importState(saved);
  expect(loaded.canApplyWartimeLoss(f.team,1)).toBe(false);expect(loaded.canApplyWartimeLoss(f.team,12)).toBe(false);expect(loaded.canApplyWartimeLoss(f.team,13)).toBe(true);
  f.audit.reconcile(1,core.teams);expect(f.audit.getSummary(undefined,core.teams).totals.warDeaths).toBe(1);
});

it("a protected ruler or absent real population never consumes a fictitious casualty",()=>{
  const f=fixture(4,2,1);const users=[...f.team.users] as any[];
  users.forEach(u=>u.role="RULER");core.handleRulerCombatDeath=vi.fn(()=>false);
  expect(f.team.removeOneUser("SIEGE_LOSS",{month:1})).toBeUndefined();expect(f.team.users.size).toBe(2);expect(f.populationSystem.exportState().wartimeLossMonths).toEqual({});
  users.forEach(u=>u.role="NORMAL");expect(f.team.removeOneUser("SIEGE_LOSS",{month:1})).toBeDefined();
  const empty=fixture(4,0,1);expect(empty.team.removeOneUser("SIEGE_LOSS",{month:1})).toBeUndefined();
});

it("verified logical city-area residents are preferred, without claiming personal defense or trusting render coordinates",()=>{
  const f=fixture(5,6,1), users=[...f.team.users] as any[], local=users.at(-1);
  for(const user of users.slice(0,-1)){const e=f.entries.get(user.player.logicalUnitId);e.state.logicalX=4000;e.state.logicalY=4000;}
  core.simulator.year=1;
  const victim=f.team.removeOneUser("SIEGE_LOSS",{month:1,triggerCityId:"city-0",damageSource:"CITY_SIEGE"});
  expect(victim).toBe(local);expect(victim.isDestroyed).toBe(true);
  const row=f.audit.getRecent().at(-1)!;
  expect(row.casualty?.victimUserId).toBe(local.id);expect(row.context).toContain("权威城域位置优先");expect(row.context).toContain("不证明守城参战");
});

it.each(["harvest","famine","population-boom","heavenly-reinforcements"])("actual %s effect and real unit counts match history and survive subsystem restoration",(kind)=>{
  const f=fixture(6,4,1);vi.spyOn(f.eventSystem,"pickRandomEventType").mockReturnValue(kind);vi.spyOn(f.eventSystem,"pickFaction").mockReturnValue(f.team);
  f.eventSystem.triggerRandomEvent(0,[f.team],256);
  const first=f.eventSystem.exportState();
  const loaded=new Events();loaded.importState(JSON.parse(JSON.stringify(first)));
  expect(loaded.exportState()).toEqual(first);
  if(kind==="harvest"||kind==="famine"){
    const duration=kind==="harvest"?24:18;expect(first.activeEffects[0].endMonth).toBe(duration);
    const before=loaded.getPopulationGrowthMultiplier(f.team);expect(before).toBe(kind==="harvest"?1.6:.45);
    loaded.settlePopulationEffects(duration,[f.team]);
    expect(loaded.getPopulationGrowthMultiplier(f.team)).toBe(1);
  }else if(kind==="population-boom"){
    expect(f.team.users.size).toBe(4);expect(first.activeEffects[0]).toMatchObject({type:"migration",remainingPopulation:2,lastSettlementMonth:0});
    loaded.settlePopulationEffects(6,[f.team]);expect(f.team.users.size).toBe(5);
    const after=JSON.parse(JSON.stringify(loaded.exportState()));loaded.importState(after,6);
    loaded.settlePopulationEffects(6,[f.team]);expect(f.team.users.size).toBe(5);
    loaded.settlePopulationEffects(12,[f.team]);expect(f.team.users.size).toBe(6);
    loaded.settlePopulationEffects(18,[f.team]);expect(f.team.users.size).toBe(6);
    const admitted=History.getEvents().filter((e:any)=>e.metadata?.source==="EXTERNAL_MIGRATION").reduce((n:number,e:any)=>n+e.metadata.immediatePopulation,0);
    expect(admitted).toBe(2);expect(f.totals.IMMIGRATION).toBe(2);
  }else{
    expect(f.team.users.size).toBe(9);expect(f.totals.SPECIAL_EVENT).toBe(5);expect(History.getEvents().at(-1).metadata.immediatePopulation).toBe(5);
  }
});

it.each(["rebellion","split"])("%s requires existing legal ordinary supporters and rolls failed preparation back without orphan Users",(kind)=>{
  const f=fixture(7,6,4), original=[...f.team.users] as any[], count=core.teams.length;
  for(const u of original)u.loyalty=20;
  original[0].militaryPersonId="active-commander";original[1].role="RULER";
  for(const c of f.team.cities)c.loyalty=20;
  const city=f.team.cities[1];for(const u of f.team.users)Object.assign(f.entries.get(u.player.logicalUnitId).state,{logicalX:city.block.x+16,logicalY:16});const refused=original.filter(u=>u.role==="NORMAL"&&!u.militaryPersonId).sort((a,b)=>a.id-b.id)[1];const originalMove=refused.setTeam;
  refused.setTeam=function(...args:any[]){if(args[0]!==f.team)throw new Error("controlled identity refusal");return originalMove.apply(this,args);};
  const result=kind==="split"?Factions.createSplitFaction(f.team,[city],1):Factions.createRebelFaction({city,year:1,factionType:"REBEL"});
  expect(result).toBeUndefined();expect(core.teams).toHaveLength(count);expect(f.team.users.size).toBe(6);expect(city.ownerFactionId).toBe(f.team.name);
  refused.setTeam=originalMove;
  for(const c of f.team.cities){c.loyalty=95;c.devastation=0;}
  for(const u of original)u.loyalty=99;
  expect(kind==="split"?Factions.createSplitFaction(f.team,[city],1):Factions.createRebelFaction({city,year:1,factionType:"REBEL"})).toBeUndefined();
  expect(f.team.users.size).toBe(6);
});

it("actual siege casualty, capital loss/capture and peaceful recovery stay distinct and reconcile",()=>{
  const f=fixture(8,6,2);core.simulator.year=1;
  const city=f.team.cities[0];city.defense=1;city.siegeContacts=new Map([[f.enemy.name,{team:f.enemy,count:3,year:1}]]);
  city.updateSiege(1);
  expect(city.ownerFactionId).toBe(f.enemy.name);expect(f.team.users.size).toBe(5);expect(f.team.cities).toHaveLength(1);
  expect(History.getEvents().some((e:any)=>e.type==="capital-fallen")).toBe(true);
  expect(History.getEvents().some((e:any)=>e.type==="capital-relocated")).toBe(true);
  const next=vi.spyOn(worldRandom,"next").mockReturnValue(0);
  for(let month=3;month<=24;month+=3){core.simulator.year=month;f.populationSystem.update(month,[f.team]);f.audit.reconcile(month,core.teams);}
  next.mockRestore();expect(f.team.users.size).toBeGreaterThan(5);
  const report=f.audit.getSummary(undefined,core.teams);
  expect(report.totals.warDeaths).toBe(1);expect(report.unexplainedWorldDifference).toBe(0);
  expect(report.openingWorldPopulation+report.totals.net).toBe(report.closingWorldPopulation);
});

it("12 seeds: default-loyalty population and actual annual imperial city decay, controlled production paths (not Core natural worlds)",()=>{
  const rows:any[]=[];
  for(const scenario of ["stable","popular","imperial"])for(let seed=0;seed<12;seed++){
    const f=fixture(seed,20,4);core.totalCells=256;
    if(scenario!=="stable")for(const row of core.map.blocks)for(const b of row)b.claimForTeam(f.team);
    for(const c of f.team.cities)c.lastLoyaltyYear=0;
    const identities=[...f.team.users] as any[];expect(identities.every(u=>u.loyalty>=55&&u.loyalty<=95)).toBe(true);
    identities.forEach((u,i)=>{const c=f.team.cities[i%4],s=f.entries.get(u.player.logicalUnitId).state;s.logicalX=c.block.x+16;s.logicalY=16;});
    const checkpoints:any={};let cityChecks=0,politicalCities=0;
    for(let month=1;month<=2400;month++){
      core.simulator.year=month;
      for(const c of core.teams.flatMap((t:any)=>t.cities)){c.updateLoyalty(month);if(month%12===0){cityChecks++;if(c.loyalty<=28)politicalCities++;}}
      f.populationSystem.update(month,core.teams);
      f.eventSystem.checkRestorations(month,[...core.teams]);
      if(scenario==="imperial")f.eventSystem.checkEmpireSplit(month,[...core.teams],256);
      f.audit.reconcile(month,core.teams);
      if(month===1200||month===2400){const events=History.getEvents();checkpoints[month/12]={historical:core.teams.length,active:core.teams.filter((t:any)=>t.status==="ACTIVE").length,
        popular:events.filter((e:any)=>["rebel-faction-founded","frontier-faction-founded"].includes(e.type)).length,
        split:events.filter((e:any)=>e.type==="empire-split").length,restored:events.filter((e:any)=>e.type==="faction-restored").length,
        population:core.teams.reduce((n:number,t:any)=>n+t.users.size,0),natural:f.totals.NATURAL_GROWTH??0,warDeaths:-(f.totals.SIEGE_LOSS??0),cityChecks,politicalCities,
        diagnostics:f.eventSystem.getRegionalRebellionSnapshot?.()};}
    }
    expect(f.audit.getSummary(undefined,core.teams).unexplainedWorldDifference).toBe(0);
    rows.push({scenario,seed,checkpoints});vi.restoreAllMocks();
  }
  if(process.env.WANGUOJI_REGIONAL_REPLAY_OUTPUT)writeFileSync(process.env.WANGUOJI_REGIONAL_REPLAY_OUTPUT,JSON.stringify(rows,null,2));
  console.log("REGIONAL_PRODUCTION_REPLAY",rows.length,"controlled runs / 12 seeds / 200 years");
},30000);
