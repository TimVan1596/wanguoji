import { describe, expect, it } from "vitest";
import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";
import { describeMilitaryAge, describeMilitaryDeathCause, getMilitaryPersonRelevantMonth,getMilitaryArchive,getMilitaryLocalServiceMonths,getMilitaryLocalFormation, sortMilitaryPeople } from "./MilitaryPeoplePresentation";

const person = (personId: string, status: MilitaryPerson["status"], startMonth: number, endMonth?: number, deathMonth?: number): MilitaryPerson => ({
  personId, sourceUserId: Number(personId.replace(/\\D/g, "")) || 1, name: personId, personalName: "李承远", bornMonth: -300,
  factionId: "qin", status, appointments: [{ factionId: "qin", startMonth, endMonth, commandId: `cmd-${personId}` }],
  ...(deathMonth === undefined ? {} : { deathMonth, deathCause: "SIEGE_LOSS" }), capturedEventIds: [],
});

describe("military people presentation", () => {
  it("orders by latest local end month, then latest start month and stable IDs, independently of death date", () => {
    expect(sortMilitaryPeople([
      person("dead-1", "DEAD", 20, 30, 40), person("retired-2", "RETIRED", 50, 70),
      person("active-b", "ACTIVE", 60), person("active-a", "ACTIVE", 60),
    ]).map(item => item.personId)).toEqual(["retired-2", "dead-1", "active-a", "active-b"]);
    expect(getMilitaryPersonRelevantMonth(person("dead-1", "DEAD", 20, 30, 40))).toBe(40);
  });

  it("uses a neutral death label without implying a city or personal battle action", () => {
    expect(describeMilitaryDeathCause("SIEGE_LOSS")).toBe("围城战损（SIEGE_LOSS）");
    expect(describeMilitaryDeathCause("OTHER_CAUSE")).toBe("OTHER_CAUSE");
  });
});


it("does not describe untraceable retired records as verified centuries-old living people", () => {
  const p = person("retired-1", "RETIRED", 10, 20);
  expect(describeMilitaryAge(p, 6000, false)).toContain("生死未载");
  expect(describeMilitaryAge(p, 6000, false)).not.toContain("未核验");
  expect(describeMilitaryAge(p, 600, true)).toBe("年龄 75 岁");
  expect(describeMilitaryAge({ ...p, status: "DEAD", deathMonth: 660 }, 6000, false)).toBe("享年 80 岁");
});

it("keeps all verified current careers followed by the entire recent-first local archive, including foreign-serving and living retired people",()=>{
  const people=[person("active-a","ACTIVE",50),person("active-b","ACTIVE",60),...Array.from({length:500},(_,i)=>person(`old-${i}`,"DEAD",i,i+1,6000-i))];
  const formations:any[]=people.slice(0,2).map(p=>({status:"ACTIVE",commanderPersonId:p.personId,factionId:"qin"}));
  const first=getMilitaryArchive(people,"qin",formations,new Set(["active-a","active-b"]));
  expect(first.currentPeople.map(p=>p.personId).sort()).toEqual(["active-a","active-b"]);expect(first.visiblePeople).toHaveLength(502);
  expect(first.historicalPeople[0].personId).toBe("old-499");expect(first.historicalPeople.at(-1)?.personId).toBe("old-0");
  expect(getMilitaryArchive([],"qin",[],new Set()).visiblePeople).toEqual([]);
  const transferred=person("transfer","ACTIVE",10,20);transferred.factionId="wei";transferred.appointments.push({factionId:"wei",startMonth:700,endMonth:900,commandId:"new"});
  const recent=person("recent","RETIRED",30,40),old=person("old","DEAD",1,10,6000);
  const archive=getMilitaryArchive([old,transferred,recent],"qin",[],new Set([transferred.personId,recent.personId]));
  expect(archive.currentPeople).toEqual([]);expect(archive.visiblePeople.map(p=>p.personId)).toEqual(["recent","transfer","old"]);
  expect(recent.status).toBe("RETIRED");expect(sortMilitaryPeople([old],"wei")).toEqual([]);
});
it("uses the latest appointment in the displayed country and preserves stable ties regardless of input order",()=>{
  const a=person("a","RETIRED",10,50),b=person("b","DEAD",20,50,500),c=person("c","RETIRED",20,50);
  for(const rows of [[a,c,b],[c,b,a]])expect(sortMilitaryPeople(rows,"qin").map(p=>p.personId)).toEqual(["b","c","a"]);
  a.appointments.push({factionId:"qin",startMonth:80,endMonth:90,commandId:"return"});
  expect(sortMilitaryPeople([b,a],"qin")[0]).toBe(a);
});

it("a transferred person's current foreign army and foreign service months do not enter the former country's page",()=>{
  const p=person("p","ACTIVE",10,20);p.factionId="wei";p.appointments.push({factionId:"wei",commandId:"new",startMonth:30});
  const f:any={factionId:"wei",commandId:"new",commanderPersonId:p.personId,status:"ACTIVE"};
  expect(getMilitaryLocalServiceMonths(p,"qin",72)).toBe(10);expect(getMilitaryLocalServiceMonths(p,"wei",72)).toBe(42);
  expect(getMilitaryLocalFormation(p,"qin",[f])).toBeUndefined();expect(getMilitaryLocalFormation(p,"wei",[f])).toBe(f);
  p.status="DEAD";p.deathMonth=60;expect(getMilitaryLocalServiceMonths(p,"wei",72)).toBe(30);expect(getMilitaryLocalFormation(p,"wei",[f])).toBeUndefined();
});
