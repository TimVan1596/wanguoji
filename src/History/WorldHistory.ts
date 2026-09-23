import Team from "../Components/Team";
import { ArchivedCity } from "../Simulation/ArchivedCities";
import type { WorldEra } from "../Simulation/WorldEra";
import {
  LEADER_MIN_GAP,
  LEADER_MIN_RATIO,
  LEADER_STABLE_MONTHS,
  POPULATION_MILESTONES,
  TERRITORY_MILESTONES,
} from "../config/simulation";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export type WorldEventType =
  | "world-born"
  | "population-milestone"
  | "territory-milestone"
  | "population-leader"
  | "territory-leader"
  | "faction-fallen"
  | "faction-exiled"
  | "faction-extinct"
  | "faction-dissolved"
  | "player-intervention"
  | "god-intervention"
  | "random-event"
  | "city-captured"
  | "city-recovered"
  | "capital-fallen"
  | "capital-relocated"
  | "city-revolt"
  | "faction-restored"
  | "rebel-faction-founded"
  | "population-surrendered"
  | "ruler-died"
  | "ruler-acceded"
  | "ruler-succession"
  | "ruler-captured"
  | "dynasty-exiled"
  | "dynasty-restored"
  | "dynasty-line-ended"
  | "god-restoration"
  | "god-rebellion"
  | "frontier-faction-founded"
  | "state-founded"
  | "emperor-proclaimed"
  | "world-unification"
  | "world-hegemony"
  | "world-fractured"
  | "world-era-started"
  | "empire-split"
  | "city-founded"
  | "city-destroyed";

export type WorldEventCategory = "war" | "politics" | "disaster" | "god";

export interface WorldEvent {
  id: string;
  year: number;
  monthIndex?: number;
  category: WorldEventCategory;
  type: WorldEventType;
  title: string;
  description?: string;
  factionIds?: string[];
  relatedFactionIds?: string[];
  actorFactionId?: string;
  targetFactionId?: string;
  cityId?: string;
  cityName?: string;
  rulerId?: string;
  conquerorFactionId?: string;
  previousOwnerFactionId?: string;
  founderFactionId?: string;
  metadata?: Record<string, string | number | undefined>;
  historyGroupId?: string;
  importance: "normal" | "major";
}

type Listener = (events: WorldEvent[]) => void;

interface LeaderCandidate {
  name: string;
  since: number;
}

function compareEventsDesc(a: WorldEvent, b: WorldEvent) {
  return (b.monthIndex ?? b.year) - (a.monthIndex ?? a.year);
}

function getEventFactionIds(event: WorldEvent) {
  return [
    ...(event.factionIds ?? []),
    ...(event.relatedFactionIds ?? []),
    event.actorFactionId,
    event.targetFactionId,
    event.conquerorFactionId,
    event.previousOwnerFactionId,
    event.founderFactionId,
    typeof event.metadata?.parentFactionId === "string" ? event.metadata.parentFactionId : undefined,
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

function lowerBoundMonth(events: WorldEvent[], month: number) {
  let left = 0;
  let right = events.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const eventMonth = events[mid].monthIndex ?? events[mid].year;
    if (eventMonth < month) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function upperBoundMonth(events: WorldEvent[], month: number) {
  let left = 0;
  let right = events.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const eventMonth = events[mid].monthIndex ?? events[mid].year;
    if (eventMonth <= month) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

class WorldHistoryStore {
  private events: WorldEvent[] = [];
  private sortedEventsCache: WorldEvent[] | undefined;
  private eventsByFactionId = new Map<string, WorldEvent[]>();
  private emitted = new Set<string>();
  private listeners = new Set<Listener>();
  private batchDepth = 0;
  private batchDirty = false;
  private populationLeader: string | undefined;
  private territoryLeader: string | undefined;
  private populationCandidate: LeaderCandidate | undefined;
  private territoryCandidate: LeaderCandidate | undefined;
  private extinctFactions = new Set<string>();
  private sequence = 0;
  private unificationCount = 0;

  reset() {
    this.events = [];
    this.sortedEventsCache = undefined;
    this.eventsByFactionId.clear();
    this.emitted.clear();
    this.populationLeader = undefined;
    this.territoryLeader = undefined;
    this.populationCandidate = undefined;
    this.territoryCandidate = undefined;
    this.extinctFactions.clear();
    this.sequence = 0;
    this.unificationCount = 0;
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getEvents());
    return () => {
      this.listeners.delete(listener);
    };
  }

  beginBatchNotifications() {
    this.batchDepth += 1;
  }

  endBatchNotifications() {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth === 0 && this.batchDirty) {
      this.batchDirty = false;
      this.notify();
    }
  }

  getEvents() {
    if (!this.sortedEventsCache) {
      this.sortedEventsCache = [...this.events].sort(compareEventsDesc);
    }
    return [...this.sortedEventsCache];
  }

  getEventCount() {
    return this.events.length;
  }

  exportState() {
    return {
      events: this.events.map(({ year, ...event }) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined, monthIndex: event.monthIndex ?? year })),
      emittedKeys: [...this.emitted],
      populationLeader: this.populationLeader,
      territoryLeader: this.territoryLeader,
      populationCandidate: this.populationCandidate ? { ...this.populationCandidate } : undefined,
      territoryCandidate: this.territoryCandidate ? { ...this.territoryCandidate } : undefined,
      extinctFactionIds: [...this.extinctFactions],
      sequence: this.sequence,
      unificationCount: this.unificationCount,
    };
  }

  getEventsForFaction(factionId: string) {
    return [...(this.eventsByFactionId.get(factionId) ?? [])].sort(compareEventsDesc);
  }

  getEventsBetween(startMonth: number, endMonth?: number) {
    const startIndex = lowerBoundMonth(this.events, startMonth);
    const endExclusive = endMonth === undefined ? this.events.length : upperBoundMonth(this.events, endMonth);
    return this.events.slice(startIndex, endExclusive).sort(compareEventsDesc);
  }

  addEvent(event: WorldEvent) {
    const normalizedEvent = {
      ...event,
      monthIndex: event.monthIndex ?? event.year,
      metadata: event.metadata ? { ...event.metadata } : undefined,
    };
    this.events.push(normalizedEvent);
    this.sortedEventsCache = undefined;
    this.indexEvent(normalizedEvent);
    this.notify();
    return event.id;
  }

  private indexEvent(event: WorldEvent) {
    getEventFactionIds(event).forEach((factionId) => {
      const events = this.eventsByFactionId.get(factionId) ?? [];
      events.push(event);
      this.eventsByFactionId.set(factionId, events);
    });
  }

  addUniqueEvent(key: string, event: Omit<WorldEvent, "id">) {
    if (this.emitted.has(key)) {
      return;
    }
    this.emitted.add(key);
    this.addEvent({
      ...event,
      id: `${key}-${event.year}`,
      monthIndex: event.year,
    });
  }

  addWorldBorn(year: number, teams: Team[]) {
    this.addUniqueEvent("world-born", {
      year,
      category: "politics",
      type: "world-born",
      title: "世界诞生",
      description: `${teams.map((team) => team.name).join("、")}开始发展。`,
      factionIds: teams.map((team) => team.name),
      importance: "major",
    });
  }

  addPlayerIntervention(year: number, playerName: string, teamName: string) {
    this.addEvent({
      id: `player-intervention-${year}-${playerName}-${teamName}-${this.sequence++}`,
      year,
      category: "god",
      type: "player-intervention",
      title: `${playerName}降临并援助${teamName}势力`,
      factionIds: [teamName],
      importance: "normal",
    });
  }

  addGodIntervention(year: number, teamName: string, count: number) {
    this.addEvent({
      id: `god-intervention-${year}-${teamName}-${this.sequence++}`,
      year,
      category: "god",
      type: "god-intervention",
      title: `上帝向${teamName}势力派遣了${count}名援军`,
      factionIds: [teamName],
      importance: count >= 10 ? "major" : "normal",
    });
  }

  addGodSupportedRestoration(
    year: number,
    teamName: string,
    cityName: string,
    cityId?: string
  ) {
    this.addEvent({
      id: `god-restoration-${year}-${teamName}-${cityName}-${this.sequence++}`,
      year,
      category: "god",
      type: "god-restoration",
      title: `上帝扶持${teamName}国在${cityName}复国`,
      factionIds: [teamName],
      actorFactionId: teamName,
      cityId,
      cityName,
      importance: "major",
    });
  }

  addGodIncitedRebellion(
    year: number,
    cityName: string,
    rebelFactionName: string,
    cityId?: string
  ) {
    this.addEvent({
      id: `god-rebellion-${year}-${rebelFactionName}-${cityName}-${this.sequence++}`,
      year,
      category: "god",
      type: "god-rebellion",
      title: `上帝在${cityName}煽动叛乱`,
      description: `${rebelFactionName}响应而起。`,
      factionIds: [rebelFactionName],
      actorFactionId: rebelFactionName,
      cityId,
      cityName,
      importance: "major",
    });
  }

  addRandomEvent(
    year: number,
    teamName: string,
    title: string,
    description?: string,
    importance: "normal" | "major" = "normal",
    metadata?: Record<string, string | number | undefined>
  ) {
    this.addEvent({
      id: `random-event-${year}-${teamName}-${this.sequence++}`,
      year,
      category: "disaster",
      type: "random-event",
      title,
      actorFactionId: teamName,
      description,
      factionIds: [teamName],
      metadata,
      importance,
    });
  }

  addUnification(year: number, teamName: string) {
    this.unificationCount += 1;
    this.addEvent({
      id: `world-unification-${year}-${teamName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "world-unification",
      title:
        this.unificationCount > 1
          ? `${teamName}第${this.unificationCount}次统一天下`
          : `${teamName}统一天下`,
      actorFactionId: teamName,
      factionIds: [teamName],
      metadata: {
        unificationCount: this.unificationCount,
      },
      importance: "major",
    });
  }

  addWorldFractured(year: number, formerUnifierName: string) {
    this.addEvent({
      id: `world-fractured-${year}-${formerUnifierName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "world-fractured",
      title: "天下再次分裂",
      description: `${formerUnifierName}的一统局面瓦解，天下再次进入割据时代。`,
      factionIds: [formerUnifierName],
      actorFactionId: formerUnifierName,
      importance: "major",
    });
  }

  addWorldEraStarted(year: number, era: WorldEra) {
    const retrospective = era.startMonth !== year;
    this.addEvent({
      id: `world-era-started-${year}-${era.id}`,
      year,
      category: "politics",
      type: "world-era-started",
      title: retrospective
        ? `${era.name}格局确立，追溯始于${formatWorldDate(era.startMonth)}。`
        : era.type === "FRAGMENTATION"
        ? `${era.name}。`
        : `天下进入${era.name}时代。`,
      description: era.explanation,
      factionIds: era.dominantFactionIds,
      actorFactionId: era.dominantFactionIds[0],
      metadata: {
        eraId: era.id,
        eraType: era.type,
        eraName: era.name,
        eraStartMonth: era.startMonth,
        eraEndMonth: era.endMonth,
        confirmedMonth: year,
      },
      importance: "major",
    });
  }

  addEmpireSplit(
    year: number,
    empireName: string,
    rebelName: string,
    cityNames: string[],
    cityIds: string[] = [],
    foundingRulerName?: string,
    foundingRulerId?: string,
    historyGroupId?: string,
    splitCoreCityId?: string,
    splitCoreCityName?: string
  ) {
    this.addEvent({
      id: `empire-split-${year}-${empireName}-${rebelName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "empire-split",
      title: `${empireName}帝国发生大规模分裂`,
      description: `${cityNames.join("、")}脱离${empireName}，${rebelName}兴起。`,
      factionIds: [empireName, rebelName],
      actorFactionId: rebelName,
      targetFactionId: empireName,
      metadata: {
        splitCityCount: cityNames.length,
        parentFactionId: empireName,
        foundingCityNames: cityNames.join("、"),
        foundingCityIds: cityIds.join(","),
        foundingRulerName,
        foundingRulerId,
        splitCoreCityId,
        splitCoreCityName,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addHegemony(year: number, teamName: string) {
    this.addUniqueEvent("world-hegemony", {
      year,
      category: "politics",
      type: "world-hegemony",
      title: `${teamName}确立天下霸权`,
      actorFactionId: teamName,
      factionIds: [teamName],
      importance: "major",
    });
  }

  addCityCaptured(
    year: number,
    attackerName: string,
    previousOwnerName: string,
    founderFactionId: string,
    cityName: string,
    cityId?: string,
    wasCapital = false,
    founderCapital = false,
    cityDefenseBefore?: number,
    rulerName?: string,
    rulerId?: string,
    historyGroupId?: string
  ) {
    return this.addEvent({
      id: `city-captured-${year}-${attackerName}-${cityName}-${this.sequence++}`,
      year,
      category: "war",
      type: "city-captured",
      title: buildCityCaptureTitle({
        attackerName,
        previousOwnerName,
        founderFactionId,
        cityName,
        wasCapital,
        founderCapital,
        rulerName,
      }),
      description: `${cityName}原由${previousOwnerName}控制。`,
      factionIds: [attackerName, previousOwnerName],
      actorFactionId: attackerName,
      targetFactionId: previousOwnerName,
      conquerorFactionId: attackerName,
      previousOwnerFactionId: previousOwnerName,
      founderFactionId,
      cityId,
      cityName,
      rulerId,
      metadata: {
        rulerId,
        previousOwner: previousOwnerName,
        founder: founderFactionId,
        wasCapital: wasCapital ? 1 : 0,
        cityDefenseBefore,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addCityRecovered(
    year: number,
    teamName: string,
    previousOwnerName: string,
    founderFactionId: string,
    cityName: string,
    cityId?: string,
    founderCapital = false,
    cityDefenseBefore?: number,
    rulerId?: string,
    historyGroupId?: string
  ) {
    return this.addEvent({
      id: `city-recovered-${year}-${teamName}-${cityName}-${this.sequence++}`,
      year,
      category: "war",
      type: "city-recovered",
      title: `${teamName}从${previousOwnerName}手中收复${
        founderCapital ? "故都" : ""
      }${cityName}`,
      factionIds: [teamName, previousOwnerName, founderFactionId],
      actorFactionId: teamName,
      targetFactionId: previousOwnerName,
      previousOwnerFactionId: previousOwnerName,
      founderFactionId,
      cityId,
      cityName,
      rulerId,
      metadata: {
        rulerId,
        previousOwner: previousOwnerName,
        founder: founderFactionId,
        cityDefenseBefore,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addCapitalFallen(
    year: number,
    attackerName: string,
    defenderName: string,
    founderFactionId: string,
    cityName: string,
    cityId?: string,
    wasCapital = true,
    cityDefenseBefore?: number,
    rulerName?: string,
    rulerId?: string,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `capital-fallen-${year}-${attackerName}-${defenderName}-${cityName}-${this.sequence++}`,
      year,
      category: "war",
      type: "capital-fallen",
      title: buildCityCaptureTitle({
        attackerName,
        previousOwnerName: defenderName,
        founderFactionId,
        cityName,
        wasCapital,
        founderCapital: true,
        rulerName,
      }),
      factionIds: [attackerName, defenderName],
      actorFactionId: attackerName,
      targetFactionId: defenderName,
      conquerorFactionId: attackerName,
      previousOwnerFactionId: defenderName,
      founderFactionId,
      cityId,
      cityName,
      metadata: {
        rulerId,
        previousOwner: defenderName,
        founder: founderFactionId,
        wasCapital: wasCapital ? 1 : 0,
        cityDefenseBefore,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addCapitalRelocated(year: number, teamName: string, cityName: string, cityId?: string) {
    this.addEvent({
      id: `capital-relocated-${year}-${teamName}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "capital-relocated",
      title: `${teamName}迁都${cityName}`,
      factionIds: [teamName],
      actorFactionId: teamName,
      cityId,
      cityName,
      importance: "major",
    });
  }

  addCityFounded(
    year: number,
    teamName: string,
    cityName: string,
    cityId?: string
  ) {
    this.addEvent({
      id: `city-founded-${year}-${teamName}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "city-founded",
      title: `${teamName}建立新城${cityName}`,
      factionIds: [teamName],
      actorFactionId: teamName,
      cityId,
      cityName,
      importance: "normal",
    });
  }

  addCityDestroyed(year: number, city: ArchivedCity) {
    this.addEvent({
      id: `city-destroyed-${year}-${city.id}-${this.sequence++}`,
      year,
      category: "war",
      type: "city-destroyed",
      title: `${city.name}在长期战乱中彻底毁灭`,
      factionIds: [city.lastOwnerFactionId, city.founderFactionId],
      targetFactionId: city.lastOwnerFactionId,
      founderFactionId: city.founderFactionId,
      cityId: city.id,
      cityName: city.name,
      metadata: {
        captureCount: city.captureCount,
        foundedMonth: city.foundedMonth,
        destroyedMonth: city.destroyedMonth,
      },
      importance: "major",
    });
  }

  addFactionExtinct(
    year: number,
    teamName: string,
    title?: string,
    metadata?: Record<string, string | number | undefined>,
    historyGroupId?: string
  ) {
    if (this.extinctFactions.has(teamName)) {
      return;
    }
    this.extinctFactions.add(teamName);
    this.addEvent({
      id: `extinct-${year}-${teamName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "faction-extinct",
      title: title ?? `${teamName}国残部消散，${teamName}国彻底灭亡`,
      factionIds: [teamName],
      targetFactionId: teamName,
      conquerorFactionId:
        typeof metadata?.conquerorFactionId === "string"
          ? metadata.conquerorFactionId
          : undefined,
      cityId: typeof metadata?.cityId === "string" ? metadata.cityId : undefined,
      cityName:
        typeof metadata?.cityName === "string" ? metadata.cityName : undefined,
      metadata,
      historyGroupId,
      importance: "major",
    });
  }

  addFactionDissolved(
    year: number,
    factionId: string,
    metadata?: Record<string, string | number | undefined>,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `dissolved-${year}-${factionId}-${this.sequence++}`,
      year,
      category: "politics",
      type: "faction-dissolved",
      title: `${factionId}覆灭`,
      description: `${factionId}失去最后据点，残部解散。`,
      factionIds: [factionId],
      targetFactionId: factionId,
      conquerorFactionId:
        typeof metadata?.conquerorFactionId === "string"
          ? metadata.conquerorFactionId
          : undefined,
      metadata,
      historyGroupId,
      importance: "major",
    });
  }

  addFactionExiled(
    year: number,
    teamName: string,
    rulerName: string,
    remnantPopulation: number,
    metadata?: Record<string, string | number | undefined>,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `exiled-${year}-${teamName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "faction-exiled",
      title: `${teamName}失去最后一座城市，${teamName}国亡国`,
      description: `${rulerName}率王室流亡。${teamName}仍有${remnantPopulation}名残部。`,
      factionIds: [teamName],
      targetFactionId: teamName,
      conquerorFactionId:
        typeof metadata?.conquerorFactionId === "string"
          ? metadata.conquerorFactionId
          : undefined,
      cityId: typeof metadata?.cityId === "string" ? metadata.cityId : undefined,
      cityName:
        typeof metadata?.cityName === "string" ? metadata.cityName : undefined,
      metadata: {
        ...metadata,
        remnantPopulation,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addCityRevolt(
    year: number,
    cityName: string,
    previousOwnerName: string,
    restoredOwnerName: string,
    cityId?: string,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `city-revolt-${year}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "city-revolt",
      title: `${cityName}起义并重新归附${restoredOwnerName}`,
      description: `${cityName}脱离${previousOwnerName}控制。`,
      factionIds: [previousOwnerName, restoredOwnerName],
      actorFactionId: restoredOwnerName,
      targetFactionId: previousOwnerName,
      cityId,
      cityName,
      historyGroupId,
      importance: "major",
    });
  }

  addFactionRestored(
    year: number,
    teamName: string,
    cityName: string,
    remnantPopulation: number,
    cityId?: string,
    historyGroupId?: string
  ) {
    this.extinctFactions.delete(teamName);
    return this.addEvent({
      id: `faction-restored-${year}-${teamName}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "faction-restored",
      title: `${teamName}国在${cityName}复国`,
      description: `${remnantPopulation}名${teamName}国残部响应。`,
      factionIds: [teamName],
      actorFactionId: teamName,
      cityId,
      cityName,
      metadata: {
        remnantPopulation,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addPopulationSurrendered(
    year: number,
    fromFactionId: string,
    toFactionId: string,
    population: number,
    historyGroupId?: string
  ) {
    if (population <= 0) {
      return;
    }
    this.addEvent({
      id: `population-surrendered-${year}-${fromFactionId}-${toFactionId}-${this.sequence++}`,
      year,
      category: "politics",
      type: "population-surrendered",
      title: `${fromFactionId}${population}人投降${toFactionId}`,
      factionIds: [fromFactionId, toFactionId],
      actorFactionId: fromFactionId,
      targetFactionId: toFactionId,
      metadata: {
        surrenderedPopulation: population,
      },
      historyGroupId,
      importance: "normal",
    });
  }

  addRebelFactionFounded(
    year: number,
    rebelFactionId: string,
    previousOwnerName: string,
    cityName: string,
    cityId?: string,
    foundingRulerName?: string,
    foundingRulerId?: string,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `rebel-founded-${year}-${rebelFactionId}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "rebel-faction-founded",
      title: `${rebelFactionId}兴起`,
      description: `${previousOwnerName}治下的${cityName}爆发叛乱。`,
      factionIds: [rebelFactionId, previousOwnerName],
      actorFactionId: rebelFactionId,
      targetFactionId: previousOwnerName,
      cityId,
      cityName,
      metadata: {
        parentFactionId: previousOwnerName,
        foundingCityNames: cityName,
        foundingCityIds: cityId,
        foundingRulerName,
        foundingRulerId,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addFrontierFactionFounded(
    year: number,
    factionId: string,
    previousOwnerName: string,
    cityName: string,
    cityId?: string,
    foundingRulerName?: string,
    foundingRulerId?: string,
    historyGroupId?: string
  ) {
    this.addEvent({
      id: `frontier-founded-${year}-${factionId}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "frontier-faction-founded",
      title: `${factionId}兴起`,
      description: `${previousOwnerName}边地的${cityName}爆发叛乱。`,
      factionIds: [factionId, previousOwnerName],
      actorFactionId: factionId,
      targetFactionId: previousOwnerName,
      cityId,
      cityName,
      metadata: {
        parentFactionId: previousOwnerName,
        foundingCityNames: cityName,
        foundingCityIds: cityId,
        foundingRulerName,
        foundingRulerId,
      },
      historyGroupId,
      importance: "major",
    });
  }

  addStateFounded(
    year: number,
    factionId: string,
    oldDisplayName: string,
    newDisplayName: string,
    rulerName?: string,
    rulerId?: string,
    capitalCityId?: string,
    capitalCityName?: string
  ) {
    return this.addEvent({
      id: `state-founded-${year}-${factionId}-${newDisplayName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "state-founded",
      title: rulerName
        ? `${oldDisplayName}正式建国，定国号“${newDisplayName}”，首领${rulerName}称王。`
        : `${oldDisplayName}正式建国，定国号“${newDisplayName}”。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      rulerId,
      cityId: capitalCityId,
      cityName: capitalCityName,
      metadata: {
        oldDisplayName,
        newDisplayName,
        rulerName,
        rulerId,
        capitalCityId,
        capitalCityName,
      },
      importance: "major",
    });
  }

  addEmperorProclaimed(
    year: number,
    factionId: string,
    displayName: string,
    rulerName?: string,
    rulerId?: string,
    territoryShare?: number,
    cityShare?: number,
    stability?: number
  ) {
    return this.addEvent({
      id: `emperor-proclaimed-${year}-${factionId}-${this.sequence++}`,
      year,
      category: "politics",
      type: "emperor-proclaimed",
      title: rulerName
        ? `${displayName}国威震天下，${displayName}王${rulerName}称帝。`
        : `${displayName}正式建立帝号。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      rulerId,
      metadata: {
        oldRank: "KING",
        newRank: "EMPEROR",
        displayName,
        rulerName,
        rulerId,
        territoryShare,
        cityShare,
        stability,
      },
      importance: "major",
    });
  }

  addRulerDied(
    year: number,
    factionId: string,
    rulerTitle: string,
    metadata?: Record<string, string | number | undefined>
  ) {
    this.addEvent({
      id: `ruler-died-${year}-${factionId}-${rulerTitle}-${this.sequence++}`,
      year,
      category: "politics",
      type: "ruler-died",
      title: `${rulerTitle}去世`,
      description:
        metadata?.reignMonths !== undefined && metadata?.age !== undefined
          ? `在位${formatWorldDuration(Number(metadata.reignMonths))}，享年${metadata.age}岁。`
          : metadata?.reignYears !== undefined && metadata?.age !== undefined
          ? `在位${formatWorldDuration(Number(metadata.reignYears) * 12)}，享年${metadata.age}岁。`
          : undefined,
      factionIds: [factionId],
      actorFactionId: factionId,
      metadata,
      importance: "normal",
    });
  }

  addRulerAcceded(year: number, factionId: string, rulerTitle: string, rulerId?: string) {
    return this.addEvent({
      id: `ruler-acceded-${year}-${factionId}-${rulerTitle}-${this.sequence++}`,
      year,
      category: "politics",
      type: "ruler-acceded",
      title: `${rulerTitle}继位`,
      factionIds: [factionId],
      actorFactionId: factionId,
      rulerId,
      importance: "normal",
    });
  }

  addRulerSuccession(
    year: number,
    factionId: string,
    previousRulerName: string,
    nextRulerName: string,
    metadata: Record<string, string | number | undefined>
  ) {
    const combatDeath = metadata.reason === "combat";
    const captured = metadata.reason === "captured";
    const exiled = metadata.factionStatus === "EXILED";
    const previousRulerTitle =
      typeof metadata.previousRulerTitle === "string"
        ? metadata.previousRulerTitle
        : `${factionId}王${previousRulerName}`;
    const nextSuccessionVerb =
      typeof metadata.nextSuccessionVerb === "string"
        ? metadata.nextSuccessionVerb
        : "继位";
    const naturalDeathVerb =
      typeof metadata.naturalDeathVerb === "string"
        ? metadata.naturalDeathVerb
        : metadata.rulerPoliticalTitle === "帝"
        ? "崩"
        : metadata.rulerPoliticalTitle === "首领"
        ? "去世"
        : "薨";
    const relationType = metadata.relationType;
    const successionTitle =
      relationType === "DIRECT_CHILD" && exiled
        ? `流亡${previousRulerTitle}去世，其子${nextRulerName}继承${factionId}王室`
        : relationType === "NEW_HOUSE"
        ? `${previousRulerTitle}王统断绝，${nextRulerName}新家族继位`
        : relationType === "LEADER_SUCCESSOR"
        ? `${previousRulerTitle}退场，${nextRulerName}首领更替`
        : relationType === "COLLATERAL_KIN"
        ? `${previousRulerTitle}之后，${nextRulerName}宗室旁支继位`
        : undefined;
    this.addEvent({
      id: `ruler-succession-${year}-${factionId}-${previousRulerName}-${nextRulerName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "ruler-succession",
      title: successionTitle ?? (exiled
        ? `流亡${previousRulerTitle}去世，${nextRulerName}继承${factionId}王室`
        : captured
        ? `${nextRulerName}继承${factionId}王室`
        : combatDeath
        ? `${previousRulerTitle}战死，${nextRulerName}${nextSuccessionVerb}`
        : `${previousRulerTitle}${naturalDeathVerb}，${nextRulerName}${nextSuccessionVerb}`),
      description: exiled
        ? `${relationType === "DIRECT_CHILD" ? "其子" : relationType === "COLLATERAL_KIN" ? "宗室" : relationType === "NEW_HOUSE" ? "新家族" : relationType === "LEADER_SUCCESSOR" ? "新首领" : "继承人"}${nextRulerName}继承流亡中的${factionId}国王室。`
        : `${previousRulerName}在位${
            metadata.reignMonths !== undefined
              ? formatWorldDuration(Number(metadata.reignMonths))
              : `${metadata.reignYears}年`
          }，享年${metadata.age}岁。${relationType === "DIRECT_CHILD" ? "其子" : relationType === "COLLATERAL_KIN" ? "宗室" : relationType === "NEW_HOUSE" ? "新家族" : relationType === "LEADER_SUCCESSOR" ? "新首领" : "继承人"}${nextRulerName}${nextSuccessionVerb}。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      metadata: {
        ...metadata,
        previousRulerName,
        nextRulerName,
        previousRulerTitle,
      },
      importance: "major",
    });
  }

  addRulerCaptured(
    year: number,
    factionId: string,
    rulerTitle: string,
    captorFactionId: string,
    captorRulerTitle?: string,
    rulerId?: string
  ) {
    const capturedRulerTitle = isFullRulerTitle(rulerTitle)
      ? rulerTitle
      : `${factionId}王${rulerTitle}`;
    const executor = captorRulerTitle
      ? `${captorRulerTitle}下令处死`
      : `${captorFactionId}处死`;
    return this.addEvent({
      id: `ruler-captured-${year}-${factionId}-${rulerTitle}-${this.sequence++}`,
      year,
      category: "politics",
      type: "ruler-captured",
      title: `${capturedRulerTitle}被俘`,
      description: `${executor}被俘的${capturedRulerTitle}。`,
      factionIds: [factionId, captorFactionId],
      actorFactionId: captorFactionId,
      targetFactionId: factionId,
      rulerId,
      metadata: {
        rulerName: rulerTitle,
        capturedRulerTitle,
        captorFactionId,
        captorRulerName: captorRulerTitle,
      },
      importance: "major",
    });
  }

  addDynastyExiled(year: number, factionId: string, rulerName: string) {
    this.addEvent({
      id: `dynasty-exiled-${year}-${factionId}-${this.sequence++}`,
      year,
      category: "politics",
      type: "dynasty-exiled",
      title: `${factionId}王室流亡`,
      description: `${rulerName}流亡。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      importance: "major",
    });
  }

  addDynastyRestored(
    year: number,
    factionId: string,
    rulerName: string,
    cityName: string
  ) {
    this.addEvent({
      id: `dynasty-restored-${year}-${factionId}-${cityName}-${this.sequence++}`,
      year,
      category: "politics",
      type: "dynasty-restored",
      title: `${factionId}王室还都${cityName}`,
      description: `${rulerName}返回${cityName}。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      cityName,
      importance: "major",
    });
  }

  addDynastyLineEnded(year: number, factionId: string, rulerName: string) {
    this.addEvent({
      id: `dynasty-line-ended-${year}-${factionId}-${this.sequence++}`,
      year,
      category: "politics",
      type: "dynasty-line-ended",
      title: `${factionId}国王统断绝`,
      description: `${factionId}国流亡王室家主${rulerName}去世后，已无合法继承人。`,
      factionIds: [factionId],
      actorFactionId: factionId,
      importance: "major",
    });
  }

  observeWorld(year: number, teams: Team[], totalCells: number) {
    this.observePopulationMilestones(year, teams);
    this.observeTerritoryMilestones(year, teams, totalCells);
    this.observeFactionFalls(year, teams);
    this.observeLeader(
      year,
      teams,
      "population",
      (team) => team.users.size
    );
    this.observeLeader(
      year,
      teams,
      "territory",
      (team) => team.blocks.children.size
    );
  }

  private observePopulationMilestones(year: number, teams: Team[]) {
    teams.forEach((team) => {
      POPULATION_MILESTONES.forEach((milestone) => {
        if (team.users.size >= milestone) {
          this.addUniqueEvent(`population-${team.name}-${milestone}`, {
            year,
            category: "politics",
            type: "population-milestone",
            title: `${team.displayName}势力人口突破${milestone}`,
            factionIds: [team.name],
            importance: milestone >= 100 ? "major" : "normal",
          });
        }
      });
    });
  }

  private observeTerritoryMilestones(
    year: number,
    teams: Team[],
    totalCells: number
  ) {
    teams.forEach((team) => {
      const percent = (team.blocks.children.size / totalCells) * 100;
      TERRITORY_MILESTONES.forEach((milestone) => {
        if (percent >= milestone) {
          this.addUniqueEvent(`territory-${team.name}-${milestone}`, {
            year,
            category: "war",
            type: "territory-milestone",
            title: `${team.displayName}势力控制世界${milestone}%的领土`,
            factionIds: [team.name],
            importance: milestone >= 50 ? "major" : "normal",
          });
        }
      });
    });
  }

  private observeFactionFalls(year: number, teams: Team[]) {
    teams.forEach((team) => {
      if (team.status === "EXTINCT") {
        this.addFactionExtinct(
          year,
          team.name,
          `${team.displayName}国残部消散，${team.displayName}国彻底灭亡`
        );
      }
    });
  }

  private observeLeader(
    year: number,
    teams: Team[],
    type: "population" | "territory",
    getValue: (team: Team) => number
  ) {
    const aliveTeams = teams
      .filter((team) => !team.isDie)
      .map((team) => ({ team, value: getValue(team) }))
      .sort((a, b) => b.value - a.value);
    const first = aliveTeams[0];
    const second = aliveTeams[1];
    if (!first || !second || first.value <= 0) {
      return;
    }

    const gap = first.value - second.value;
    const hasStableLead =
      gap >= LEADER_MIN_GAP || first.value / Math.max(second.value, 1) >= LEADER_MIN_RATIO;
    if (!hasStableLead) {
      return;
    }

    const leader = type === "population" ? this.populationLeader : this.territoryLeader;
    if (leader === first.team.name) {
      return;
    }

    const candidate =
      type === "population" ? this.populationCandidate : this.territoryCandidate;
    if (!candidate || candidate.name !== first.team.name) {
      const nextCandidate = { name: first.team.name, since: year };
      if (type === "population") {
        this.populationCandidate = nextCandidate;
      } else {
        this.territoryCandidate = nextCandidate;
      }
      return;
    }

    if (year - candidate.since < LEADER_STABLE_MONTHS) {
      return;
    }

    if (type === "population") {
      this.populationLeader = first.team.name;
      this.populationCandidate = undefined;
      this.addEvent({
        id: `population-leader-${year}-${first.team.name}`,
        year,
        category: "politics",
        type: "population-leader",
        title: `${first.team.displayName}势力成为人口最多的势力`,
        factionIds: [first.team.name],
        importance: "normal",
      });
    } else {
      this.territoryLeader = first.team.name;
      this.territoryCandidate = undefined;
      this.addEvent({
        id: `territory-leader-${year}-${first.team.name}`,
        year,
        category: "war",
        type: "territory-leader",
        title: `${first.team.displayName}势力成为领土最多的势力`,
        factionIds: [first.team.name],
        importance: "normal",
      });
    }
  }

  private notify() {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    const events = this.getEvents();
    this.listeners.forEach((listener) => listener(events));
  }
}

function buildCityCaptureTitle({
  attackerName,
  previousOwnerName,
  founderFactionId,
  cityName,
  wasCapital,
  founderCapital,
  rulerName,
}: {
  attackerName: string;
  previousOwnerName: string;
  founderFactionId: string;
  cityName: string;
  wasCapital: boolean;
  founderCapital: boolean;
  rulerName?: string;
}) {
  const prefix = rulerName ? `${rulerName}亲征，` : "";
  if (previousOwnerName === founderFactionId) {
    return `${prefix}${attackerName}攻陷${founderFactionId}${
      wasCapital ? "都" : "城"
    }${cityName}`;
  }
  return `${prefix}${attackerName}攻陷${previousOwnerName}国控制的${cityName}（${
    founderCapital ? `${founderFactionId}国故都` : `原属${founderFactionId}`
  }）`;
}

function isFullRulerTitle(value: string) {
  return value.includes("首领") || value.includes("王") || value.includes("帝");
}

const WorldHistory = new WorldHistoryStore();

export function formatEventDate(event: Pick<WorldEvent, "year" | "monthIndex">) {
  return formatWorldDate(event.monthIndex ?? event.year);
}

export default WorldHistory;
