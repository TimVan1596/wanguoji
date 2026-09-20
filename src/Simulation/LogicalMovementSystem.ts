import {
  LogicalUnitState,
  LogicalWorldBounds,
  getLogicalGridCoordinate,
} from "./LogicalUnitState";

export interface LogicalMovementResult {
  unitId: string;
  previousGridX: number;
  previousGridY: number;
  currentGridX: number;
  currentGridY: number;
  enteredNewGrid: boolean;
}

export function stepLogicalMovement({
  units,
  deltaMs,
  bounds,
  blockSize,
}: {
  units: LogicalUnitState[];
  deltaMs: number;
  bounds: LogicalWorldBounds;
  blockSize: number;
}): LogicalMovementResult[] {
  const dt = Math.max(0, deltaMs) / 1000;
  return units.map((unit) => {
    const previousGridX = unit.currentGridX;
    const previousGridY = unit.currentGridY;
    unit.logicalX += unit.logicalVX * dt;
    unit.logicalY += unit.logicalVY * dt;

    if (unit.logicalX < bounds.minX) {
      unit.logicalX = bounds.minX;
      unit.logicalVX = Math.abs(unit.logicalVX);
    } else if (unit.logicalX > bounds.maxX) {
      unit.logicalX = bounds.maxX;
      unit.logicalVX = -Math.abs(unit.logicalVX);
    }

    if (unit.logicalY < bounds.minY) {
      unit.logicalY = bounds.minY;
      unit.logicalVY = Math.abs(unit.logicalVY);
    } else if (unit.logicalY > bounds.maxY) {
      unit.logicalY = bounds.maxY;
      unit.logicalVY = -Math.abs(unit.logicalVY);
    }

    const grid = getLogicalGridCoordinate(unit.logicalX, unit.logicalY, blockSize);
    unit.currentGridX = grid.gridX;
    unit.currentGridY = grid.gridY;
    return {
      unitId: unit.unitId,
      previousGridX,
      previousGridY,
      currentGridX: grid.gridX,
      currentGridY: grid.gridY,
      enteredNewGrid:
        previousGridX !== grid.gridX || previousGridY !== grid.gridY,
    };
  });
}
