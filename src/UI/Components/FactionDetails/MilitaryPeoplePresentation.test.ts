import { describe, expect, it } from "vitest";
import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";
import { describeMilitaryAge, describeMilitaryDeathCause, getMilitaryPersonRelevantMonth, sortMilitaryPeople } from "./MilitaryPeoplePresentation";

const person = (personId: string, status: MilitaryPerson["status"], startMonth: number, endMonth?: number, deathMonth?: number): MilitaryPerson => ({
  personId, sourceUserId: Number(personId.replace(/\\D/g, "")) || 1, name: personId, bornMonth: -300,
  factionId: "qin", status, appointments: [{ factionId: "qin", startMonth, endMonth, commandId: `cmd-${personId}` }],
  ...(deathMonth === undefined ? {} : { deathMonth, deathCause: "SIEGE_LOSS" }), capturedEventIds: [],
});

describe("military people presentation", () => {
  it("keeps current commanders before retired and dead people, then uses recent dates and stable IDs", () => {
    expect(sortMilitaryPeople([
      person("dead-1", "DEAD", 20, 30, 40), person("retired-2", "RETIRED", 50, 70),
      person("active-b", "ACTIVE", 60), person("active-a", "ACTIVE", 60),
    ]).map(item => item.personId)).toEqual(["active-a", "active-b", "retired-2", "dead-1"]);
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
  expect(describeMilitaryAge(p, 6000, false)).toContain("原User未核验");
  expect(describeMilitaryAge(p, 600, true)).toBe("年龄 75 岁");
  expect(describeMilitaryAge({ ...p, status: "DEAD", deathMonth: 660 }, 6000, false)).toBe("享年 80 岁");
});
