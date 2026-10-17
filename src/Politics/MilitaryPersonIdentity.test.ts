import { describe, expect, it } from "vitest";
import { formatMilitaryHistoryIdentity, getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";
import { MilitaryCommandRegistryStore } from "./MilitaryCommandRegistry";
import { formatHistoryEventTitle } from "../History/HistoryRenderRules";
import worldRandom from "../Simulation/WorldRandom";
import { vi } from "vitest";
import { getLocalUserId } from "../Live/LocalUserIdentity";

describe("军政人口标签不是姓名，身份不重写",()=>{
  it.each(["邯郸北义军-099","燕-279","Heaven-燕-3834-0268"])("%s在世/已故/导入使用同一档案身份",name=>{
    const registry=new MilitaryCommandRegistryStore(),events:any[]=[];
    registry.setEventWriter(e=>{events.push(e);return e.id;});
    const team:any={name:"燕",status:"ACTIVE",cities:[],users:new Set()};
    const user:any={id:getLocalUserId(name),name,bornMonth:-300,team,role:"NORMAL",player:{active:true,logicalUnitId:"u1",x:0,y:0}};
    team.users.add(user);team.users.add({...user,id:user.id+1,name:"张清",player:{active:true,logicalUnitId:"u2",x:0,y:0}});
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(0);
    try {
      registry.update(12,[team],[]);
      const person=registry.getPeople()[0];
      expect(person.name).toBe(name);expect(user.name).toBe(name);
      expect(getMilitaryPersonDisplayName(person)).toContain("姓名未核验");
      expect(events.find(e=>e.type==="military-appointment").title).not.toContain(name);
      registry.onUserDestroyed(user,24,"BATTLE_DEATH");
      expect(person.status).toBe("DEAD");
      const state=JSON.parse(JSON.stringify(registry.exportState()));
      const loaded=new MilitaryCommandRegistryStore();loaded.importState(state);
      expect(loaded.exportState()).toEqual(registry.exportState());
      expect(getMilitaryPersonDisplayName(loaded.getPeople()[0])).toBe(getMilitaryPersonDisplayName(person));
      const old:any={id:"legacy",type:"military-person-died",title:`${name}自然去世`,year:24,metadata:{personId:person.personId}};
      expect(formatHistoryEventTitle(old,new Map())).toBe(`${getMilitaryPersonDisplayName(person)}自然去世`);
      expect(old.title).toBe(`${name}自然去世`); // do not mutate historical evidence
    } finally {next.mockRestore();}
  });
  it("已有真实名称不替换；不同档案不合并，不猜测王室身份",()=>{
    for(const name of ["郭子宸","张清","Alice-Wang"]) expect(getMilitaryPersonDisplayName({name,personId:"p1"})).toBe(name);
    expect(getMilitaryPersonDisplayName({name:"Alice-123",personId:"p1",sourceUserId:23})).toBe("Alice-123");
    expect(getMilitaryPersonDisplayName({name:"燕-279",personId:"p1"})).not.toBe(getMilitaryPersonDisplayName({name:"燕-279",personId:"p2"}));
    expect(formatMilitaryHistoryIdentity({type:"ruler-succession",title:"燕-279继位",metadata:{personId:"p1"}})).toBe("燕-279继位");
  });
});
