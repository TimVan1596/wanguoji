import {expect,it} from "vitest";
import {WorldHistoryStore} from "./WorldHistory";
import {isEventRelatedToFaction} from "./HistoryRenderRules";
it("battle names and issuer labels never create political/faction relations, including after rebuilding history indices",()=>{
  const h=new WorldHistoryStore(),event:any={id:"battle",type:"city-captured",year:12,actorFactionId:"actual",targetFactionId:"enemy",factionIds:["actual","enemy"],category:"war",importance:"major",title:"battle",
    metadata:{attackerNameAtEvent:"unrelated",defenderNameAtEvent:"old-name",authorizingRulerTitle:"other-king",commanderOffice:"JIANGJUN"}};
  h.addEvent(event);
  for(const store of [h,(()=>{const read=new WorldHistoryStore();read.importState(h.exportState());return read;})()]){
    for(const id of ["unrelated","old-name","other-king","JIANGJUN"]){expect(store.getEventWindow({factionId:id,limit:8}).events).toEqual([]);expect(isEventRelatedToFaction(event,id)).toBe(false);}
    expect(store.getEventWindow({factionId:"actual",limit:8}).events).toHaveLength(1);expect(isEventRelatedToFaction(event,"actual")).toBe(true);
  }
});
