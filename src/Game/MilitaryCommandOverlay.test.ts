import {afterEach,expect,it,vi} from "vitest";
vi.mock("./Game",()=>({default:{BlockSize:32}}));
import Military from "../Politics/MilitaryCommandRegistry";
import Diplomacy from "../Politics/Diplomacy";
import worldRandom from "../Simulation/WorldRandom";
import {MilitaryCommandOverlay,resolveMilitaryCommandView} from "./MilitaryCommandOverlay";

function fixture(){
  const team:any={name:"qin",status:"ACTIVE",users:new Set()},enemy:any={name:"wei",status:"ACTIVE"};
  const units=new Map<string,any>();
  for(let i=1;i<=2;i++){
    const p:any={active:true,team,role:"NORMAL",logicalUnitId:`u${i}`,x:100*i,y:200},u:any={id:i,team,role:"NORMAL",player:p,militaryPersonId:i===1?"p":undefined,matchesMilitaryLife:()=>true};p.user=u;team.users.add(u);
    units.set(p.logicalUnitId,{player:p,state:{unitId:p.logicalUnitId,alive:true,role:"NORMAL",userId:i,factionId:"qin",logicalX:i*10,logicalY:20}});
  }
  const person:any={personId:"p",sourceUserId:1,factionId:"qin",status:"ACTIVE",appointments:[{commandId:"c",factionId:"qin",startMonth:0}]};
  const formation:any={commandId:"c",commanderPersonId:"p",factionId:"qin",status:"ACTIVE",memberUnitIds:["u1","u2"],targetCityId:"city"};
  const target:any={id:"city",name:"邺",ownerFactionId:"wei",ownerTeam:enemy,block:{x:500,y:500}};
  const g:any={clear:vi.fn(),destroy:vi.fn(),lineStyle:vi.fn(),strokeCircle:vi.fn(),lineBetween:vi.fn()};g.setDepth=vi.fn(()=>g);
  const core:any={teams:[team,enemy],logicalGameplayAuthority:false,logicalUnitRegistry:{getEntry:(id:string)=>units.get(id)},allCities:[target],simulator:{year:12},scene:{add:{graphics:vi.fn(()=>g)}}};
  vi.spyOn(Military,"getPerson").mockImplementation(id=>id==="p"?person:undefined);vi.spyOn(Military,"getFormation").mockImplementation(id=>id==="c"?formation:undefined);vi.spyOn(Diplomacy,"canAttack").mockReturnValue(true);
  return {core,units,person,formation,target,g};
}
afterEach(()=>{vi.restoreAllMocks();});
it("reads live Arcade Player coordinates and logical-mode authority without consuming RNG",()=>{
  const f=fixture(),rng=worldRandom.exportState();
  expect(resolveMilitaryCommandView(f.core,"c")?.center).toEqual({x:150,y:200});
  f.core.logicalGameplayAuthority=true;expect(resolveMilitaryCommandView(f.core,"c")?.center).toEqual({x:15,y:20});
  expect(resolveMilitaryCommandView(f.core,"other")).toBeUndefined();expect(worldRandom.exportState()).toEqual(rng);
});
it.each(["truce","captured","destroyed","missing"])("removes only the target direction on %s while retaining valid members",reason=>{
  const f=fixture(),overlay=new MilitaryCommandOverlay(f.core);overlay.show("c",true);expect(f.g.lineBetween).toHaveBeenCalledTimes(3);
  f.g.lineBetween.mockClear();
  if(reason==="truce")vi.mocked(Diplomacy.canAttack).mockReturnValue(false);
  if(reason==="captured")f.target.ownerFactionId="qin";
  if(reason==="destroyed")f.target.destroyed=true;
  if(reason==="missing")f.core.allCities=[];
  overlay.update();expect(f.g.lineBetween).not.toHaveBeenCalled();expect(resolveMilitaryCommandView(f.core,"c")?.members).toHaveLength(2);
});
it("reuses one Graphics without input handlers and clears on death, disbanding, switching or destruction",()=>{
  const f=fixture(),overlay=new MilitaryCommandOverlay(f.core);overlay.show("c",true);
  for(let i=0;i<100;i++)overlay.update();expect(f.core.scene.add.graphics).toHaveBeenCalledTimes(1);
  expect(f.g).not.toHaveProperty("input");
  f.units.get("u2").state.alive=false;expect(resolveMilitaryCommandView(f.core,"c")?.members).toHaveLength(1);
  f.person.status="DEAD";f.g.strokeCircle.mockClear();overlay.update();expect(f.g.strokeCircle).not.toHaveBeenCalled();
  f.person.status="ACTIVE";overlay.show("c");f.formation.status="DISBANDED";overlay.update();
  overlay.clear();overlay.destroy();expect(f.g.destroy).toHaveBeenCalledTimes(1);
});
it("rejects mismatched identity and does not highlight unrelated units",()=>{
  const f=fixture();f.units.get("u2").state.factionId="enemy";
  expect(resolveMilitaryCommandView(f.core,"c")?.members.map(m=>m.unitId)).toEqual(["u1"]);
  f.units.get("u1").state.userId=100;expect(resolveMilitaryCommandView(f.core,"c")).toBeUndefined();
});
