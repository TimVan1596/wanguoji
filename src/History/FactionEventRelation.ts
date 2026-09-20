import type { WorldEvent } from "./WorldHistory";

export type FactionEventRelation =
  | "ACTOR"
  | "TARGET"
  | "CONQUEROR"
  | "CONQUERED"
  | "FOUNDER"
  | "PARENT"
  | "CHILD"
  | "RESTORER"
  | "AFFECTED"
  | "NONE";

export function getFactionEventRelation(
  event: WorldEvent,
  factionId: string
): FactionEventRelation {
  if (event.type === "world-born") {
    return "NONE";
  }
  if (event.type === "state-founded" || event.type === "emperor-proclaimed") {
    return event.actorFactionId === factionId ? "ACTOR" : "NONE";
  }
  if (event.type === "faction-restored" || event.type === "god-restoration") {
    return event.actorFactionId === factionId ? "RESTORER" : "NONE";
  }
  if (
    event.type === "rebel-faction-founded" ||
    event.type === "frontier-faction-founded" ||
    event.type === "god-rebellion" ||
    event.metadata?.groupedFoundingEventCount
  ) {
    if (event.actorFactionId === factionId || event.factionIds?.[0] === factionId) {
      return "CHILD";
    }
    if (event.targetFactionId === factionId || event.metadata?.parentFactionId === factionId) {
      return "PARENT";
    }
    return "NONE";
  }
  if (event.type === "empire-split") {
    if (event.actorFactionId === factionId) {
      return "CHILD";
    }
    if (event.targetFactionId === factionId || event.metadata?.parentFactionId === factionId) {
      return "PARENT";
    }
    return "NONE";
  }
  if (event.metadata?.groupedRestorationEventCount) {
    return event.actorFactionId === factionId ? "RESTORER" : "NONE";
  }
  if (event.metadata?.groupedEventCount) {
    if (event.targetFactionId === factionId) {
      return "CONQUERED";
    }
    if (event.conquerorFactionId === factionId || event.actorFactionId === factionId) {
      return "CONQUEROR";
    }
    return "NONE";
  }
  if (event.conquerorFactionId === factionId) {
    return "CONQUEROR";
  }
  if (
    (event.type === "faction-exiled" ||
      event.type === "faction-extinct" ||
      event.type === "faction-dissolved" ||
      event.type === "ruler-captured" ||
      event.type === "capital-fallen") &&
    event.targetFactionId === factionId
  ) {
    return "CONQUERED";
  }
  if (event.founderFactionId === factionId) {
    return "FOUNDER";
  }
  if (event.actorFactionId === factionId) {
    return "ACTOR";
  }
  if (event.targetFactionId === factionId || event.previousOwnerFactionId === factionId) {
    return "TARGET";
  }
  if (event.relatedFactionIds?.includes(factionId)) {
    return "AFFECTED";
  }
  if (event.factionIds?.includes(factionId)) {
    return "AFFECTED";
  }
  return "NONE";
}
