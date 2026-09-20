import { describe, expect, it } from "vitest";
import {
  applyLogicalOccupation,
  createLogicalOccupationContactState,
} from "./LogicalOccupationSystem";
import type { LogicalUnitState } from "./LogicalUnitState";

function unit(overrides: Partial<LogicalUnitState> = {}): LogicalUnitState {
  return {
    unitId: "u1",
    factionId: "qin",
    logicalX: 32,
    logicalY: 32,
    logicalVX: 0,
    logicalVY: 0,
    alive: true,
    currentGridX: 1,
    currentGridY: 1,
    radius: 16,
    speed: 0,
    ...overrides,
  };
}

describe("LogicalOccupationSystem", () => {
  it("occupies an enemy non-city block without Phaser collision", () => {
    const qin = { name: "qin", isDie: false };
    const old = { name: "chu" };
    const block = {
      team: old,
      setTeam: (team: typeof qin) => {
        block.team = team;
      },
    };
    const result = applyLogicalOccupation({
      units: [unit()],
      movementResults: [
        {
          unitId: "u1",
          previousGridX: 0,
          previousGridY: 1,
          currentGridX: 1,
          currentGridY: 1,
          enteredNewGrid: true,
        },
      ],
      context: {
        getTeam: () => qin as never,
        getBlock: () => block as never,
        getWorldMonth: () => 12,
      },
    });
    expect(result.transitions).toBe(1);
    expect(block.team).toBe(qin);
  });

  it("does not repeat ordinary occupation side effects while staying in the same grid", () => {
    const qin = { name: "qin", isDie: false };
    let transitions = 0;
    const block = {
      team: { name: "chu" },
      setTeam: (team: typeof qin) => {
        transitions += 1;
        block.team = team;
      },
    };
    const context = {
      getTeam: () => qin as never,
      getBlock: () => block as never,
      getWorldMonth: () => 12,
    };
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [
        {
          unitId: "u1",
          previousGridX: 0,
          previousGridY: 1,
          currentGridX: 1,
          currentGridY: 1,
          enteredNewGrid: true,
        },
      ],
      context,
    });
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [
        {
          unitId: "u1",
          previousGridX: 1,
          previousGridY: 1,
          currentGridX: 1,
          currentGridY: 1,
          enteredNewGrid: false,
        },
      ],
      context,
    });
    expect(transitions).toBe(1);
  });

  it("does not trigger same-owned block occupation side effects", () => {
    const qin = { name: "qin", isDie: false };
    let transitions = 0;
    const block = {
      team: qin,
      setTeam: () => {
        transitions += 1;
      },
    };
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [
        {
          unitId: "u1",
          previousGridX: 0,
          previousGridY: 1,
          currentGridX: 1,
          currentGridY: 1,
          enteredNewGrid: true,
        },
      ],
      context: {
        getTeam: () => qin as never,
        getBlock: () => block as never,
        getWorldMonth: () => 12,
      },
    });
    expect(transitions).toBe(0);
  });

  it("registers siege contact for enemy city cells every logical step", () => {
    const qin = { name: "qin", isDie: false };
    const owner = { name: "chu" };
    const contacts: Array<{ factionId: string; month: number; rulerId?: string }> = [];
    const city = {
      ownerTeam: owner,
      registerSiegeContact: (
        attacker: typeof qin,
        month: number,
        rulerId?: string
      ) => contacts.push({ factionId: attacker.name, month, rulerId }),
    };
    const result = applyLogicalOccupation({
      units: [unit({ role: "RULER", rulerId: "r1" })],
      movementResults: [],
      context: {
        getTeam: () => qin as never,
        getBlock: () => ({ city }) as never,
        getWorldMonth: () => 44,
      },
    });
    expect(result.siegeContacts).toBe(1);
    expect(contacts).toEqual([{ factionId: "qin", month: 44, rulerId: "r1" }]);
  });

  it("deduplicates siege contact for the same unit and city within one world month", () => {
    const qin = { name: "qin", isDie: false };
    const owner = { name: "chu" };
    let month = 44;
    const contacts: number[] = [];
    const city = {
      id: "city-1",
      ownerTeam: owner,
      registerSiegeContact: (_attacker: typeof qin, contactMonth: number) =>
        contacts.push(contactMonth),
    };
    const contactState = createLogicalOccupationContactState();
    const context = {
      getTeam: () => qin as never,
      getBlock: () => ({ city }) as never,
      getWorldMonth: () => month,
    };
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [],
      contactState,
      context,
    });
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [],
      contactState,
      context,
    });
    month = 45;
    applyLogicalOccupation({
      units: [unit()],
      movementResults: [],
      contactState,
      context,
    });
    expect(contacts).toEqual([44, 45]);
  });
});
