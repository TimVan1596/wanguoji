import type Block from "../Components/Block";
import type Team from "../Components/Team";
import type { LogicalUnitState } from "./LogicalUnitState";
import type { LogicalMovementResult } from "./LogicalMovementSystem";

export interface LogicalOccupationContext {
  getTeam: (factionId: string) => Team | undefined;
  getBlock: (gridX: number, gridY: number) => Block | undefined;
  getWorldMonth: () => number;
}

export interface LogicalOccupationResult {
  transitions: number;
  siegeContacts: number;
}

export interface LogicalOccupationContactState {
  siegeContactMonthByUnitCity: Map<string, number>;
}

export function createLogicalOccupationContactState(): LogicalOccupationContactState {
  return {
    siegeContactMonthByUnitCity: new Map(),
  };
}

export function applyLogicalOccupation({
  units,
  movementResults,
  context,
  contactState,
}: {
  units: LogicalUnitState[];
  movementResults: LogicalMovementResult[];
  context: LogicalOccupationContext;
  contactState?: LogicalOccupationContactState;
}): LogicalOccupationResult {
  const movementByUnit = new Map(
    movementResults.map((result) => [result.unitId, result])
  );
  let transitions = 0;
  let siegeContacts = 0;

  units.forEach((unit) => {
    if (!unit.alive) {
      return;
    }
    const team = context.getTeam(unit.factionId);
    const block = context.getBlock(unit.currentGridX, unit.currentGridY);
    if (!team || team.isDie || !block) {
      return;
    }
    if (block.city && block.city.ownerTeam !== team) {
      const worldMonth = context.getWorldMonth();
      const contactKey = `${unit.unitId}:${block.city.id}`;
      if (
        contactState &&
        contactState.siegeContactMonthByUnitCity.get(contactKey) === worldMonth
      ) {
        return;
      }
      contactState?.siegeContactMonthByUnitCity.set(contactKey, worldMonth);
      block.city.registerSiegeContact(
        team,
        worldMonth,
        unit.role === "RULER" ? unit.rulerId : undefined
      );
      siegeContacts += 1;
      return;
    }
    const movement = movementByUnit.get(unit.unitId);
    if (!movement?.enteredNewGrid || block.team === team) {
      return;
    }
    block.setTeam(team);
    transitions += 1;
  });

  return { transitions, siegeContacts };
}
