export interface LogicalUnitState {
  unitId: string;
  factionId: string;
  logicalX: number;
  logicalY: number;
  logicalVX: number;
  logicalVY: number;
  alive: boolean;
  currentGridX: number;
  currentGridY: number;
  radius: number;
  speed: number;
  userId?: number;
  role?: "NORMAL" | "RULER";
  rulerId?: string;
}

export interface LogicalWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getLogicalGridCoordinate(
  worldX: number,
  worldY: number,
  blockSize: number
) {
  return {
    gridX: Math.floor(worldX / blockSize),
    gridY: Math.floor(worldY / blockSize),
  };
}

export function createLogicalUnitState({
  unitId,
  factionId,
  x,
  y,
  vx,
  vy,
  blockSize,
  radius,
  speed,
  userId,
  role = "NORMAL",
  rulerId,
}: {
  unitId: string;
  factionId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  blockSize: number;
  radius: number;
  speed: number;
  userId?: number;
  role?: "NORMAL" | "RULER";
  rulerId?: string;
}): LogicalUnitState {
  const grid = getLogicalGridCoordinate(x, y, blockSize);
  return {
    unitId,
    factionId,
    logicalX: x,
    logicalY: y,
    logicalVX: vx,
    logicalVY: vy,
    alive: true,
    currentGridX: grid.gridX,
    currentGridY: grid.gridY,
    radius,
    speed,
    userId,
    role,
    rulerId,
  };
}
