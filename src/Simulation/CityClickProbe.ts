import { getCityInteractionGridFromWorld } from "./CityInteractionIndex";

export interface PointerLike {
  x: number;
  y: number;
  downX?: number;
  downY?: number;
  worldX?: number;
  worldY?: number;
  event?: unknown;
}

export interface CameraLike {
  scrollX: number;
  scrollY: number;
  zoom: number;
  getWorldPoint?: (x: number, y: number) => { x: number; y: number };
}

export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GameSizeLike {
  width: number;
  height: number;
}

export interface CityPointerResolution {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  worldX: number;
  worldY: number;
  gridX: number;
  gridY: number;
}

export interface CityClickProbePayload extends CityPointerResolution {
  cameraScrollX: number;
  cameraScrollY: number;
  cameraZoom: number;
  dragDistance: number;
  pointerHandlerTriggered: boolean;
  interactionCityId?: string;
  blockCityId?: string;
  selectedCityBefore?: string;
  selectedCityAfter?: string;
}

export function getPointerCanvasPoint(
  pointer: PointerLike,
  canvasRect?: CanvasRectLike,
  gameSize?: GameSizeLike
) {
  const eventPoint = getEventClientPoint(pointer.event);
  const clientX = eventPoint?.x;
  const clientY = eventPoint?.y;
  if (
    clientX !== undefined &&
    clientY !== undefined &&
    canvasRect &&
    canvasRect.width > 0 &&
    canvasRect.height > 0 &&
    gameSize &&
    gameSize.width > 0 &&
    gameSize.height > 0
  ) {
    return {
      x: ((clientX - canvasRect.left) / canvasRect.width) * gameSize.width,
      y: ((clientY - canvasRect.top) / canvasRect.height) * gameSize.height,
    };
  }
  return { x: pointer.x, y: pointer.y };
}

export function getPointerWorldPoint(
  canvasPoint: { x: number; y: number },
  camera: CameraLike
) {
  if (camera.getWorldPoint) {
    return camera.getWorldPoint(canvasPoint.x, canvasPoint.y);
  }
  return {
    x: camera.scrollX + canvasPoint.x / Math.max(camera.zoom, 0.0001),
    y: camera.scrollY + canvasPoint.y / Math.max(camera.zoom, 0.0001),
  };
}

export function getPointerDragDistance(
  start: { x: number; y: number } | undefined,
  end: { x: number; y: number }
) {
  if (!start) {
    return 0;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function resolveCityPointerPosition(
  pointer: PointerLike,
  camera: CameraLike,
  blockSize: number,
  canvasRect?: CanvasRectLike,
  gameSize?: GameSizeLike
): CityPointerResolution {
  const eventPoint = getEventClientPoint(pointer.event);
  const screenX = eventPoint?.x ?? pointer.x;
  const screenY = eventPoint?.y ?? pointer.y;
  const canvasPoint = getPointerCanvasPoint(pointer, canvasRect, gameSize);
  const worldPoint = getPointerWorldPoint(canvasPoint, camera);
  const grid = getCityInteractionGridFromWorld(
    worldPoint.x,
    worldPoint.y,
    blockSize
  );
  return {
    screenX,
    screenY,
    canvasX: canvasPoint.x,
    canvasY: canvasPoint.y,
    worldX: worldPoint.x,
    worldY: worldPoint.y,
    gridX: grid.x,
    gridY: grid.y,
  };
}

function getEventClientPoint(event: unknown) {
  if (!event || typeof event !== "object") {
    return undefined;
  }
  const maybePoint = event as { clientX?: unknown; clientY?: unknown };
  if (typeof maybePoint.clientX === "number" && typeof maybePoint.clientY === "number") {
    return { x: maybePoint.clientX, y: maybePoint.clientY };
  }
  const maybeTouch = event as { changedTouches?: ArrayLike<{ clientX: number; clientY: number }> };
  const touch = maybeTouch.changedTouches?.[0];
  if (touch) {
    return { x: touch.clientX, y: touch.clientY };
  }
  return undefined;
}

export function logCityClickProbe(payload: CityClickProbePayload) {
  if (!import.meta.env.DEV) {
    return;
  }
  console.debug("[Wanguoji] CityClickProbe", payload);
}
