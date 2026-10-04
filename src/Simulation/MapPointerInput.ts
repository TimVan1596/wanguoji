export type MapPointerPhase = "down" | "up" | "move";

export interface MapPointerLike {
  id?: number;
  downElement?: unknown;
  upElement?: unknown;
  event?: unknown;
}

export interface MapPointerTargetResult {
  accepted: boolean;
  target: string;
  reason: "CANVAS_TARGET" | "NON_CANVAS_TARGET";
}

export interface MapPointerSequence {
  pointerId: number;
  x: number;
  y: number;
}

export function inspectMapPointerTarget(
  pointer: MapPointerLike,
  canvas: unknown,
  phase: MapPointerPhase
): MapPointerTargetResult {
  const event = pointer.event as {
    target?: unknown;
    composedPath?: () => unknown[];
  } | undefined;
  const eventTarget = event?.target ?? event?.composedPath?.()[0];
  const phaseTarget = phase === "down"
    ? pointer.downElement
    : phase === "up"
      ? pointer.upElement
      : eventTarget;
  const actualTarget = eventTarget ?? phaseTarget;
  const accepted = phaseTarget === canvas && eventTarget === canvas;
  return {
    accepted,
    target: describeDomTarget(actualTarget),
    reason: accepted ? "CANVAS_TARGET" : "NON_CANVAS_TARGET",
  };
}

export function beginMapPointerSequence(
  accepted: boolean,
  pointerId: number,
  point: { x: number; y: number }
): MapPointerSequence | undefined {
  return accepted ? { pointerId, ...point } : undefined;
}

export function finishMapPointerSequence(
  sequence: MapPointerSequence | undefined,
  acceptedCanvasTarget: boolean,
  pointerId: number
): { accepted: boolean; reason: "CANVAS_SEQUENCE" | "NON_CANVAS_TARGET" | "NO_VALID_POINTER_DOWN" | "POINTER_SEQUENCE_MISMATCH" } {
  if (!acceptedCanvasTarget) return { accepted: false, reason: "NON_CANVAS_TARGET" };
  if (!sequence) return { accepted: false, reason: "NO_VALID_POINTER_DOWN" };
  if (sequence.pointerId !== pointerId) return { accepted: false, reason: "POINTER_SEQUENCE_MISMATCH" };
  return { accepted: true, reason: "CANVAS_SEQUENCE" };
}

function describeDomTarget(target: unknown) {
  if (target === null || target === undefined) return "UNKNOWN";
  if (typeof target !== "object") return String(target).toUpperCase();
  const node = target as { nodeType?: number; tagName?: string; nodeName?: string };
  if (node.nodeType === 9) return "DOCUMENT";
  return (node.tagName ?? node.nodeName ?? "UNKNOWN").toUpperCase();
}
