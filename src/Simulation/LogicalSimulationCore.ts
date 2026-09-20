import Game from "../Game/Game";
import LogicalSpatialIndex from "./LogicalSpatialIndex";
import LogicalUnitRegistry from "./LogicalUnitRegistry";
import {
  applyLogicalOccupation,
  createLogicalOccupationContactState,
} from "./LogicalOccupationSystem";
import { stepLogicalMovement } from "./LogicalMovementSystem";

export interface LogicalSimulationCoreContext {
  registry: LogicalUnitRegistry;
  getWorldMonth: () => number;
}

export default class LogicalSimulationCore {
  readonly spatialIndex = new LogicalSpatialIndex();
  private occupationContactState = createLogicalOccupationContactState();

  constructor(private context: LogicalSimulationCoreContext) {}

  step(deltaMs: number) {
    const map = Game.Core?.map;
    if (!map) {
      return;
    }
    const units = this.context.registry.getAliveUnits();
    const movementResults = stepLogicalMovement({
      units,
      deltaMs,
      bounds: {
        minX: 0,
        minY: 0,
        maxX: map.getMaxX() * Game.BlockSize - Game.BlockSize,
        maxY: map.getMaxY() * Game.BlockSize - Game.BlockSize,
      },
      blockSize: Game.BlockSize,
    });
    this.spatialIndex.rebuild(units);
    applyLogicalOccupation({
      units,
      movementResults,
      contactState: this.occupationContactState,
      context: {
        getTeam: (factionId) =>
          Game.Core?.teams.find((team) => team.name === factionId),
        getBlock: (gridX, gridY) => map.getBlock(gridX, gridY),
        getWorldMonth: this.context.getWorldMonth,
      },
    });
  }

  reset() {
    this.spatialIndex.rebuild([]);
    this.occupationContactState = createLogicalOccupationContactState();
  }
}
