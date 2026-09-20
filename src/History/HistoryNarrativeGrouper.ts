import type { WorldEvent } from "./WorldHistory";

const COLLAPSE_TYPES = new Set(["faction-exiled", "faction-extinct", "faction-dissolved"]);
const COLLAPSIBLE_TYPES = new Set([
  "capital-fallen",
  "city-captured",
  "ruler-captured",
  "ruler-succession",
  "dynasty-line-ended",
  "dynasty-exiled",
  "faction-exiled",
  "faction-extinct",
  "faction-dissolved",
  "population-surrendered",
]);
const FOUNDING_TYPES = new Set([
  "rebel-faction-founded",
  "frontier-faction-founded",
  "empire-split",
  "god-rebellion",
]);
const FOUNDING_CHAIN_TYPES = new Set([
  "rebel-faction-founded",
  "frontier-faction-founded",
  "empire-split",
  "god-rebellion",
  "city-revolt",
  "ruler-acceded",
  "ruler-succession",
]);
const RESTORATION_TYPES = new Set(["faction-restored", "god-restoration"]);
const RESTORATION_CHAIN_TYPES = new Set([
  "city-revolt",
  "faction-restored",
  "god-restoration",
  "dynasty-restored",
]);

interface CollapseGroup {
  key: string;
  month: number;
  factionId: string;
  collapseEvent: WorldEvent;
  events: WorldEvent[];
}

interface FoundingGroup {
  key: string;
  month: number;
  factionId: string;
  foundingEvent: WorldEvent;
  events: WorldEvent[];
}

interface RestorationGroup {
  key: string;
  month: number;
  factionId: string;
  restorationEvent: WorldEvent;
  events: WorldEvent[];
}

export function groupHistoryNarratives(events: WorldEvent[]) {
  const groups = buildCollapseGroups(events);
  const foundingGroups = buildFoundingGroups(events);
  const restorationGroups = buildRestorationGroups(events);
  const eventToGroup = new Map<string, CollapseGroup | FoundingGroup | RestorationGroup>();
  groups.forEach((group) => {
    if (group.events.length < 2) {
      return;
    }
    group.events.forEach((event) => eventToGroup.set(event.id, group));
  });
  foundingGroups.forEach((group) => {
    if (group.events.length < 2) {
      return;
    }
    group.events.forEach((event) => eventToGroup.set(event.id, group));
  });
  restorationGroups.forEach((group) => {
    if (group.events.length < 2) {
      return;
    }
    group.events.forEach((event) => eventToGroup.set(event.id, group));
  });

  const emittedGroups = new Set<string>();
  const displayEvents: WorldEvent[] = [];
  events.forEach((event) => {
    const group = eventToGroup.get(event.id);
    if (!group) {
      displayEvents.push(event);
      return;
    }
    if (emittedGroups.has(group.key)) {
      return;
    }
    emittedGroups.add(group.key);
    displayEvents.push(
      isFoundingGroup(group)
        ? createFoundingNarrativeEvent(group)
        : isRestorationGroup(group)
        ? createRestorationNarrativeEvent(group)
        : createNarrativeEvent(group)
    );
  });
  return displayEvents;
}

function buildCollapseGroups(events: WorldEvent[]) {
  const groups: CollapseGroup[] = [];
  events
    .filter((event) => COLLAPSE_TYPES.has(event.type))
    .forEach((collapseEvent) => {
      const factionId = getFallenFactionId(collapseEvent);
      if (!factionId) {
        return;
      }
      const month = getEventMonth(collapseEvent);
      const groupEvents = events.filter(
        (event) => belongsToCollapseGroup(event, collapseEvent, month, factionId)
      );
      groups.push({
        key: `${month}:${factionId}`,
        month,
        factionId,
        collapseEvent,
        events: groupEvents,
      });
    });
  return groups;
}

function createNarrativeEvent(group: CollapseGroup): WorldEvent {
  const captured = group.events.find((event) => event.type === "ruler-captured");
  const succession = group.events.find((event) => event.type === "ruler-succession");
  const cityCapture = group.events.find(
    (event) => event.type === "capital-fallen" || event.type === "city-captured"
  );
  const surrender = group.events.find((event) => event.type === "population-surrendered");
  const exiled =
    group.collapseEvent.type === "faction-exiled" ||
    group.events.some((event) => event.type === "dynasty-exiled");
  const conquerorFactionId =
    group.collapseEvent.conquerorFactionId ??
    (typeof group.collapseEvent.metadata?.conquerorFactionId === "string"
      ? group.collapseEvent.metadata.conquerorFactionId
      : undefined) ??
    captured?.actorFactionId;

  const clauses: string[] = [];
  const capturedRulerName = getMetadataString(captured, "rulerName");
  const capturedRulerTitle = getMetadataString(captured, "capturedRulerTitle");
  if (capturedRulerTitle || capturedRulerName) {
    clauses.push(`${capturedRulerTitle ?? `${group.factionId}王${capturedRulerName}`}被俘处死`);
  }
  const nextRulerName = getMetadataString(succession, "nextRulerName");
  const nextSuccessionVerb = getMetadataString(succession, "nextSuccessionVerb") ?? "继位";
  if (nextRulerName) {
    clauses.push(`${nextRulerName}${nextSuccessionVerb}`);
  }
  if (group.collapseEvent.type === "faction-dissolved") {
    clauses.push(`${group.factionId}覆灭`);
  } else {
    clauses.push(exiled ? "王室流亡" : `${group.factionId}国王统断绝`);
  }

  const headline = conquerorFactionId
    ? `${conquerorFactionId}灭${group.factionId}`
    : `${group.factionId}亡国`;
  const sourceEventIds = group.events.map((event) => event.id).join(",");
  return {
    ...group.collapseEvent,
    id: `history-collapse-${group.key}-${group.events.length}`,
    title: `${headline}。${unique(clauses).join("，")}。`,
    description: group.events.map((event) => event.title).join(" / "),
    factionIds: unique([
      group.factionId,
      conquerorFactionId,
      ...group.events.flatMap((event) => event.factionIds ?? []),
      ...group.events.flatMap((event) => event.relatedFactionIds ?? []),
    ]),
    actorFactionId: conquerorFactionId ?? group.collapseEvent.actorFactionId,
    targetFactionId: group.factionId,
    conquerorFactionId,
    metadata: {
      ...group.collapseEvent.metadata,
      groupedEventCount: group.events.length,
      sourceEventIds,
      capturedRulerName,
      capturedRulerTitle,
      nextRulerName,
      nextSuccessionVerb,
      capturedCityName: cityCapture?.cityName,
      capitalCaptured: cityCapture?.type === "capital-fallen" ? 1 : 0,
      surrenderedPopulation: surrender?.metadata?.surrenderedPopulation,
      exiled: exiled ? 1 : 0,
      dissolved: group.collapseEvent.type === "faction-dissolved" ? 1 : 0,
    },
  };
}

function buildFoundingGroups(events: WorldEvent[]) {
  const groups: FoundingGroup[] = [];
  events
    .filter((event) => FOUNDING_TYPES.has(event.type))
    .forEach((foundingEvent) => {
      const factionId = foundingEvent.actorFactionId ?? foundingEvent.factionIds?.[0];
      if (!factionId) {
        return;
      }
      const month = getEventMonth(foundingEvent);
      const groupEvents = events.filter(
        (event) =>
          belongsToFoundingGroup(event, foundingEvent, month, factionId)
      );
      groups.push({
        key: `founding:${month}:${factionId}`,
        month,
        factionId,
        foundingEvent,
        events: groupEvents,
      });
    });
  return groups;
}

function createFoundingNarrativeEvent(group: FoundingGroup): WorldEvent {
  const cityNames = unique([
    getMetadataString(group.foundingEvent, "foundingCityNames"),
    group.foundingEvent.cityName,
    ...group.events
      .filter((event) => event.type === "city-revolt")
      .map((event) => event.cityName),
  ])
    .flatMap((value) => value?.split("、") ?? [])
    .filter(Boolean);
  const accession = group.events.find(
    (event) => event.type === "ruler-acceded" || event.type === "ruler-succession"
  );
  const foundingRulerName =
    getMetadataString(group.foundingEvent, "foundingRulerName") ??
    getMetadataString(accession, "nextRulerName") ??
    stripAccessionTitle(accession?.title);
  const parentFactionId =
    getMetadataString(group.foundingEvent, "parentFactionId") ??
    group.foundingEvent.targetFactionId ??
    group.events.find((event) => event.targetFactionId)?.targetFactionId;
  const sourceEventIds = group.events.map((event) => event.id).join(",");
  return {
    ...group.foundingEvent,
    id: `history-founding-${group.key}-${group.events.length}`,
    title: `${group.factionId}建立`,
    description: group.events.map((event) => event.title).join(" / "),
    factionIds: unique([
      group.factionId,
      parentFactionId,
      ...group.events.flatMap((event) => event.factionIds ?? []),
      ...group.events.flatMap((event) => event.relatedFactionIds ?? []),
    ]),
    actorFactionId: group.factionId,
    targetFactionId: parentFactionId,
    metadata: {
      ...group.foundingEvent.metadata,
      groupedFoundingEventCount: group.events.length,
      sourceEventIds,
      parentFactionId,
      foundingCityNames: unique(cityNames).join("、"),
      foundingRulerName,
    },
  };
}

function buildRestorationGroups(events: WorldEvent[]) {
  const groups: RestorationGroup[] = [];
  events
    .filter((event) => RESTORATION_TYPES.has(event.type))
    .forEach((restorationEvent) => {
      const factionId = restorationEvent.actorFactionId ?? restorationEvent.factionIds?.[0];
      if (!factionId) {
        return;
      }
      const month = getEventMonth(restorationEvent);
      const groupEvents = events.filter(
        (event) =>
          belongsToRestorationGroup(event, restorationEvent, month, factionId)
      );
      groups.push({
        key: restorationEvent.historyGroupId ?? `restoration:${month}:${factionId}`,
        month,
        factionId,
        restorationEvent,
        events: groupEvents,
      });
    });
  return groups;
}

function createRestorationNarrativeEvent(group: RestorationGroup): WorldEvent {
  const city = group.events.find((event) => event.cityName)?.cityName;
  const sourceEventIds = group.events.map((event) => event.id).join(",");
  return {
    ...group.restorationEvent,
    id: `history-restoration-${group.key}-${group.events.length}`,
    title: `${group.factionId}复国`,
    description: group.events.map((event) => event.title).join(" / "),
    factionIds: unique([
      group.factionId,
      ...group.events.flatMap((event) => event.factionIds ?? []),
      ...group.events.flatMap((event) => event.relatedFactionIds ?? []),
    ]),
    actorFactionId: group.factionId,
    cityName: city ?? group.restorationEvent.cityName,
    metadata: {
      ...group.restorationEvent.metadata,
      groupedRestorationEventCount: group.events.length,
      sourceEventIds,
    },
  };
}

function getFallenFactionId(event: WorldEvent) {
  if (event.type === "ruler-captured") {
    return event.targetFactionId;
  }
  if (event.type === "capital-fallen" || event.type === "city-captured") {
    return event.targetFactionId;
  }
  if (event.type === "population-surrendered") {
    return event.actorFactionId;
  }
  if (event.type === "ruler-succession" || event.type === "dynasty-exiled") {
    return event.actorFactionId ?? event.factionIds?.[0];
  }
  if (event.type === "dynasty-line-ended") {
    return event.actorFactionId ?? event.factionIds?.[0];
  }
  if (event.type === "faction-exiled" || event.type === "faction-extinct") {
    return event.targetFactionId ?? event.factionIds?.[0];
  }
  if (event.type === "faction-dissolved") {
    return event.targetFactionId ?? event.factionIds?.[0];
  }
  return undefined;
}

function getEventMonth(event: WorldEvent) {
  return event.monthIndex ?? event.year;
}

function getMetadataString(event: WorldEvent | undefined, key: string) {
  const value = event?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function isFoundingGroup(
  group: CollapseGroup | FoundingGroup | RestorationGroup
): group is FoundingGroup {
  return "foundingEvent" in group;
}

function isRestorationGroup(
  group: CollapseGroup | FoundingGroup | RestorationGroup
): group is RestorationGroup {
  return "restorationEvent" in group;
}

function stripAccessionTitle(title: string | undefined) {
  if (!title) {
    return undefined;
  }
  return title.replace(/继位$/, "");
}

function belongsToCollapseGroup(
  event: WorldEvent,
  collapseEvent: WorldEvent,
  month: number,
  factionId: string
) {
  if (collapseEvent.historyGroupId && event.historyGroupId === collapseEvent.historyGroupId) {
    return COLLAPSIBLE_TYPES.has(event.type);
  }
  return (
    getEventMonth(event) === month &&
    COLLAPSIBLE_TYPES.has(event.type) &&
    getFallenFactionId(event) === factionId
  );
}

function belongsToFoundingGroup(
  event: WorldEvent,
  foundingEvent: WorldEvent,
  month: number,
  factionId: string
) {
  if (foundingEvent.historyGroupId && event.historyGroupId === foundingEvent.historyGroupId) {
    return FOUNDING_CHAIN_TYPES.has(event.type);
  }
  return (
    getEventMonth(event) === month &&
    FOUNDING_CHAIN_TYPES.has(event.type) &&
    (event.actorFactionId === factionId || event.factionIds?.includes(factionId))
  );
}

function belongsToRestorationGroup(
  event: WorldEvent,
  restorationEvent: WorldEvent,
  month: number,
  factionId: string
) {
  if (
    restorationEvent.historyGroupId &&
    event.historyGroupId === restorationEvent.historyGroupId
  ) {
    return RESTORATION_CHAIN_TYPES.has(event.type);
  }
  return (
    getEventMonth(event) === month &&
    RESTORATION_CHAIN_TYPES.has(event.type) &&
    (event.actorFactionId === factionId || event.factionIds?.includes(factionId))
  );
}
