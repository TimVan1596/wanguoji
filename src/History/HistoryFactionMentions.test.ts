import {expect,it} from "vitest";
import {historyFactionMentions,historyProtectedNames,standaloneFactionMention} from "./HistoryFactionMentions";
import type {WorldEvent} from "./WorldHistory";
const f=(id:string,names:Array<[string,number,number?]>)=>({name:id,color:0,displayName:names.at(-1)![0],nameHistory:names.map(([name,startMonth,endMonth])=>({name,startMonth,endMonth}))});
const factions=new Map([["old-id",f("old-id",[["北义军",0,19],["赵",20,59],["新赵",60]])],["other-id",f("other-id",[["赵",0]])]]);
const e=(overrides:Partial<WorldEvent>={}):WorldEvent=>({id:"e",year:10,type:"city-captured",category:"war",importance:"major",title:"北义军攻城",actorFactionId:"old-id",...overrides});
it("resolves rebel, later state and dynasty names through event IDs and month, including extinct archives",()=>{
 expect([...historyFactionMentions(e(),factions,[])]).toEqual([["北义军","old-id"]]);
 expect([...historyFactionMentions(e({year:30}),factions,[])]).toEqual([["赵","old-id"]]);
 expect([...historyFactionMentions(e({year:70}),factions,[])]).toEqual([["新赵","old-id"]]);
 const aliases=historyFactionMentions(e({type:"dynasty-usurped",year:60,metadata:{oldStateName:"赵",newStateName:"新赵"}}),factions,[]);
 expect(aliases.get("赵")).toBe("old-id");expect(aliases.get("新赵")).toBe("old-id");
});
it("refuses two same-name states, city collisions and unknown references",()=>{
 expect(historyFactionMentions(e({year:30,targetFactionId:"other-id"}),factions,[]).size).toBe(0);
 expect(historyFactionMentions(e(),factions,["北义军"]).size).toBe(0);
 expect(historyFactionMentions(e({actorFactionId:"missing"}),factions,[]).size).toBe(0);
 const two=historyFactionMentions(e({year:10,targetFactionId:"other-id"}),factions,[]);expect(two.get("赵")).toBe("other-id");expect(two.get("北义军")).toBe("old-id");
});
it("protects full personal names without treating arbitrary text labels as faction references",()=>{
 const event=e({metadata:{rulerName:"赵惟修",previousRulerName:"赵珩",leaderName:"北义军使者",unrelatedLabel:"other-id"}});
 expect(historyProtectedNames(event)).toEqual(["赵惟修","赵珩","北义军使者"]);expect(historyFactionMentions(event,factions,[]).get("赵")).toBeUndefined();
});

it("never links unlabelled person substrings while keeping explicit narrative mentions",()=>{
 expect(standaloneFactionMention("赵惟修攻城",0,1)).toBe(false);expect(standaloneFactionMention("北义军使者来朝",0,3)).toBe(false);
 expect(standaloneFactionMention("赵攻陷魏都",0,1)).toBe(true);expect(standaloneFactionMention("归附赵",2,1)).toBe(false);
 expect(standaloneFactionMention("赵国攻城",0,1)).toBe(true);expect(standaloneFactionMention("向赵进军",1,1)).toBe(false);
});
