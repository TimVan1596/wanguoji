export type CityZoneVisualState = "NORMAL" | "HOVERED" | "SELECTED" | "UNDER_SIEGE";

export interface CityZoneVisualInput {
  underSiege: boolean;
  selected: boolean;
  hovered: boolean;
}

export interface ZoneCellLike {
  x: number;
  y: number;
}

export interface ZoneOutlineEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function getCityZoneVisualState({
  underSiege,
  selected,
  hovered,
}: CityZoneVisualInput): CityZoneVisualState {
  if (underSiege) {
    return "UNDER_SIEGE";
  }
  if (selected) {
    return "SELECTED";
  }
  if (hovered) {
    return "HOVERED";
  }
  return "NORMAL";
}

export function getCityZoneOutlineStyle(state: CityZoneVisualState) {
  if (state === "UNDER_SIEGE") {
    return { color: 0xff3b30, alpha: 0.96, width: 4 };
  }
  if (state === "SELECTED") {
    return { color: 0x3f8cff, alpha: 0.92, width: 3 };
  }
  if (state === "HOVERED") {
    return { color: 0xffffff, alpha: 0.9, width: 2 };
  }
  return { color: 0x111111, alpha: 0.18, width: 1 };
}

export function getExteriorZoneEdges(cells: ZoneCellLike[], blockSize: number) {
  const occupied = new Set(cells.map((cell) => key(cell.x, cell.y)));
  const edges: ZoneOutlineEdge[] = [];
  cells.forEach((cell) => {
    const left = cell.x;
    const right = cell.x + blockSize;
    const top = cell.y;
    const bottom = cell.y + blockSize;
    if (!occupied.has(key(cell.x, cell.y - blockSize))) {
      edges.push({ x1: left, y1: top, x2: right, y2: top });
    }
    if (!occupied.has(key(cell.x + blockSize, cell.y))) {
      edges.push({ x1: right, y1: top, x2: right, y2: bottom });
    }
    if (!occupied.has(key(cell.x, cell.y + blockSize))) {
      edges.push({ x1: right, y1: bottom, x2: left, y2: bottom });
    }
    if (!occupied.has(key(cell.x - blockSize, cell.y))) {
      edges.push({ x1: left, y1: bottom, x2: left, y2: top });
    }
  });
  return edges;
}

function key(x: number, y: number) {
  return `${x}:${y}`;
}
