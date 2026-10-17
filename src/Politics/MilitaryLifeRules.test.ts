import { expect, it } from "vitest";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import worldRandom from "../Simulation/WorldRandom";

it("derives bounded, varied, ordered personal schedules solely from persisted identity", () => {
  const before = worldRandom.exportState(), retirements = new Set<number>();
  for (let index = 1; index <= 1000; index++) {
    const person = { personId: `military-person-${index}`, bornMonth: -480 };
    const life = deriveMilitaryLifeSchedule(person);
    expect(life).toEqual(deriveMilitaryLifeSchedule(JSON.parse(JSON.stringify(person))));
    expect(life.retirementMonth - person.bornMonth).toBeGreaterThanOrEqual(65 * 12);
    expect(life.retirementMonth - person.bornMonth).toBeLessThanOrEqual(75 * 12);
    expect(life.naturalDeathMonth - person.bornMonth).toBeGreaterThanOrEqual(75 * 12);
    expect(life.naturalDeathMonth - person.bornMonth).toBeLessThanOrEqual(95 * 12);
    expect(life.naturalDeathMonth).toBeGreaterThan(life.retirementMonth);
    retirements.add(life.retirementMonth);
  }
  expect(retirements.size).toBeGreaterThan(80); expect(worldRandom.exportState()).toEqual(before);
});
