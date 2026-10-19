import { describe, expect, it } from "vitest";
import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";
import { describeMilitaryAge, describeMilitaryDeathCause, getMilitaryPersonRelevantMonth,getMilitaryArchivePage, sortMilitaryPeople } from "./MilitaryPeoplePresentation";

const person = (personId: string, status: MilitaryPerson["status"], startMonth: number, endMonth?: number, deathMonth?: number): MilitaryPerson => ({
  personId, sourceUserId: Number(personId.replace(/\\D/g, "")) || 1, name: personId, personalName: "李承远", bornMonth: -300,
  factionId: "qin", status, appointments: [{ factionId: "qin", startMonth, endMonth, commandId: `cmd-${personId}` }],
  ...(deathMonth === undefined ? {} : { deathMonth, deathCause: "SIEGE_LOSS" }), capturedEventIds: [],
});

describe("military people presentation", () => {
  it("orders by the first recorded appointment and stable IDs, independently of death date", () => {
    expect(sortMilitaryPeople([
      person("dead-1", "DEAD", 20, 30, 40), person("retired-2", "RETIRED", 50, 70),
      person("active-b", "ACTIVE", 60), person("active-a", "ACTIVE", 60),
    ]).map(item => item.personId)).toEqual(["dead-1", "retired-2", "active-a", "active-b"]);
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

it("keeps all verified active careers visible with ten historical rows per page and uses local-country dates",()=>{
  const people=[person("active-a","ACTIVE",50),person("active-b","ACTIVE",60),...Array.from({length:25},(_,i)=>person(`old-${i}`,"DEAD",i,i+1,i+2))];
  const formations:any[]=people.slice(0,2).map(p=>({status:"ACTIVE",commanderPersonId:p.personId,factionId:"qin"}));
  const live=new Set(["active-a","active-b"]),first=getMilitaryArchivePage(people,"qin",formations,live,0),last=getMilitaryArchivePage(people,"qin",formations,live,99);
  expect(first.currentPeople.map(p=>p.personId)).toEqual(["active-a","active-b"]);expect(first.visiblePeople).toHaveLength(12);expect(first.pageCount).toBe(3);
  expect(last.page).toBe(2);expect(last.visiblePeople).toHaveLength(7);expect(last.visiblePeople.slice(0,2)).toEqual(first.currentPeople);
  expect(getMilitaryArchivePage([],"qin",[],new Set(),99).page).toBe(0);
  const transferred=person("transfer","ACTIVE",10,20);transferred.factionId="wei";transferred.appointments.push({factionId:"wei",startMonth:70,commandId:"new"});
  expect(getMilitaryArchivePage([transferred],"qin",[],new Set([transferred.personId]),0).currentPeople).toEqual([]);
});
