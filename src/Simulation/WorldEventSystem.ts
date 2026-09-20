import Team from "../Components/Team";
import { getFactionDevelopmentLevel, getFactionStability } from "../Components/City";
import Game from "../Game/Game";
import WorldHistory from "../History/WorldHistory";
import Danmu from "../Live/Danmu";
import { createLocalDanmu } from "../Live/LocalDanmaku";
import {
  CITY_FOUND_CHECK_INTERVAL_MONTHS,
  CITY_FOUND_COOLDOWN_MONTHS,
  CITY_FOUND_MIN_DISTANCE_CELLS,
  CITY_FOUND_MIN_POPULATION,
  CITY_FOUND_MIN_STABILITY,
  CITY_FOUND_MIN_TERRITORY,
  CITY_BASE_MAX_DEFENSE,
  CITY_MIN_ZONE_GAP,
  EMPIRE_SPLIT_CHECK_INTERVAL_MONTHS,
  EMPIRE_SPLIT_LOW_LOYALTY,
  EMPIRE_SPLIT_MAX_CITIES,
  EMPIRE_SPLIT_MIN_CITIES,
  EMPIRE_SPLIT_STABILITY_THRESHOLD,
  EMPIRE_SPLIT_STRAIN_THRESHOLD,
  FAMINE_CITY_LOYALTY_DELTA,
  FAMINE_GROWTH_MULTIPLIER,
  HARVEST_CITY_LOYALTY_DELTA,
  HARVEST_GROWTH_MULTIPLIER,
  HEAVENLY_REINFORCEMENT_COUNT,
  HEGEMONY_STABLE_MONTHS,
  HEGEMONY_TERRITORY_PERCENT,
  MAX_ACTIVE_FACTIONS,
  MAX_ACTIVE_CITIES,
  POPULATION_BOOM_MAX,
  POPULATION_BOOM_MIN,
  RANDOM_EVENT_MAX_INTERVAL_MONTHS,
  RANDOM_EVENT_MIN_INTERVAL_MONTHS,
  REBELLION_BASE_CHANCE,
  REBELLION_CHECK_INTERVAL_MONTHS,
  REBELLION_CITY_COOLDOWN_MONTHS,
  REBELLION_LOYALTY_THRESHOLD,
  FRONTIER_EDGE_RATIO,
  FRONTIER_REBELLION_CHANCE,
  USER_GOD_LOYALTY_MAX,
  USER_GOD_LOYALTY_MIN,
  USER_NATURAL_LOYALTY_MAX,
  USER_NATURAL_LOYALTY_MIN,
  REBEL_LOYALTY_THRESHOLD_V095,
  REBEL_OWNER_STABILITY_THRESHOLD_V095,
  WEAK_FACTION_POSITIVE_EVENT_BIAS,
  WORLD_EFFECT_DURATION_MONTHS,
} from "../config/simulation";
import { store } from "../store";
import { setWorldPhase, setWorldResult } from "../store/rootSlice";
import FactionRegistry from "./FactionRegistry";
import WorldRemnants from "./WorldRemnants";
import FactionEffects from "./FactionEffects";
import WorldExiles from "./WorldExiles";
import { calculateImperialStrain } from "./ImperialStrain";
import { getWorldPhase } from "./WorldPhase";
import {
  createInitialWorldCycleState,
  getConsolidationImperialStrainMultiplier,
  getConsolidationRebellionChanceMultiplier,
  getHegemonicCaptureLoyaltyBonusFromSiegeMultiplier,
  getLeadingConsolidationFaction,
  getUnifiedImperialStrainMultiplier,
  getUnifiedRebellionChanceMultiplier,
  getWorldCycleOrderFactionId,
  getWorldCycleDiagnostics,
  observeHegemonicMomentum,
  observeDynasticOrder,
  recordWorldFragmented,
  recordWorldUnified,
  WorldCycleDiagnostics,
  WorldCycleState,
} from "./WorldCycleRules";
import CityNameRegistry from "./CityNameRegistry";
import { createStateName } from "./StateNameGenerator";
import Block from "../Components/Block";
import City from "../Components/City";
import DynastyRegistry from "../Politics/Dynasty";
import {
  getStateFormationBlockers,
  observeEmperorProclamationEligibility,
  observeStateFormationEligibility,
  shouldApplyProvisionalDissolutionPressure,
} from "./FactionIdentity";
import {
  getEffectiveStability,
  getRestorationWeightMultiplier,
} from "./SovereigntyModifiers";
import {
  selectSplitCities,
  selectSplitCore,
  shouldRestoreBeforeNewRebel,
} from "./EmpireSplitRules";
import {
  getCandidateFortifiedGridCells,
  hasZoneOverlapOrGapViolation,
} from "./CityZoneSpatial";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "./TerritoryMetrics";

export type WorldEffectType = "harvest" | "famine";

export interface ActiveWorldEffect {
  id: string;
  factionId: string;
  type: WorldEffectType;
  startYear: number;
  endYear: number;
  modifiers: {
    populationGrowthMultiplier: number;
  };
}

type RandomWorldEventType =
  | "harvest"
  | "famine"
  | "population-boom"
  | "heavenly-reinforcements";

interface HegemonyCandidate {
  teamName: string;
  since: number;
}

const PROVISIONAL_DISSOLUTION_PRESSURE_INTERVAL_MONTHS = 12;
const PROVISIONAL_DISSOLUTION_LOYALTY_DELTA = -2;

export default class WorldEventSystem {
  private activeEffects: ActiveWorldEffect[] = [];
  private nextEventYear = 0;
  private sequence = 0;
  private hegemonyCandidate: HegemonyCandidate | undefined;
  private hegemonyEmitted = false;
  private unificationEmitted = false;
  private unifyingFactionId: string | undefined;
  private unificationMonth: number | undefined;
  private fractureUntilMonth = -1;
  private lastRebellionCheckYear = 0;
  private lastEmpireSplitCheckYear = 0;
  private lastCityFoundCheckYear = 0;
  private lastProvisionalPressureYear = 0;
  private cityFoundedYears: Record<string, number> = {};
  private cityRebellionYears: Record<string, number> = {};
  private cycleState: WorldCycleState = createInitialWorldCycleState(0);
  private cycleDiagnostics: WorldCycleDiagnostics = getWorldCycleDiagnostics(
    this.cycleState,
    0
  );

  reset(startYear = 0) {
    this.activeEffects = [];
    this.nextEventYear = this.rollNextEventYear(startYear);
    this.sequence = 0;
    this.hegemonyCandidate = undefined;
    this.hegemonyEmitted = false;
    this.unificationEmitted = false;
    this.unifyingFactionId = undefined;
    this.unificationMonth = undefined;
    this.fractureUntilMonth = -1;
    this.lastRebellionCheckYear = startYear;
    this.lastEmpireSplitCheckYear = startYear;
    this.lastCityFoundCheckYear = startYear;
    this.lastProvisionalPressureYear = startYear;
    this.cityFoundedYears = {};
    this.cityRebellionYears = {};
    this.cycleState = createInitialWorldCycleState(startYear);
    this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, startYear);
    FactionEffects.clearStrategicModifiers();
  }

  update(year: number, teams: Team[], totalCells: number) {
    this.activeEffects = this.activeEffects.filter(
      (effect) => year < effect.endYear
    );
    this.observeWorldGoal(year, teams, totalCells);
    this.checkStateFormation(year, teams);
    this.applyProvisionalDissolutionPressure(year, teams, totalCells);
    this.checkEmperorProclamation(year, teams, totalCells);
    this.checkRestorations(year, teams);
    this.checkEmpireSplit(year, teams, totalCells);
    this.checkCityFounding(year, teams);
    if (year < this.nextEventYear) {
      return;
    }
    this.triggerRandomEvent(year, teams, totalCells);
    this.nextEventYear = this.rollNextEventYear(year);
  }

  getCurrentPhase(year: number, teams: Team[]) {
    const aliveTeams = teams.filter((team) => !team.isDie);
    return getWorldPhase(aliveTeams.length, this.fractureUntilMonth, year);
  }

  observeWorldGoal(year: number, teams: Team[], totalCells: number) {
    const aliveTeams = teams.filter((team) => !team.isDie);
    const metrics = this.buildWorldCycleMetrics(teams, totalCells);
    this.cycleState = observeDynasticOrder(
      this.cycleState,
      metrics,
      year
    );
    this.cycleState = observeHegemonicMomentum(this.cycleState, metrics, year);
    this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, year);
    this.publishStrategicCycleModifiers();
    store.dispatch(
      setWorldPhase(getWorldPhase(aliveTeams.length, this.fractureUntilMonth, year))
    );
    if (aliveTeams.length > 1 && this.unificationEmitted) {
      if (this.unifyingFactionId) {
        WorldHistory.addWorldFractured(year, this.unifyingFactionId);
      }
      this.unificationEmitted = false;
      this.unifyingFactionId = undefined;
      this.unificationMonth = undefined;
      this.cycleState = recordWorldFragmented(this.cycleState, year);
      this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, year);
      if (store.getState().root.worldResult?.type === "unification") {
        store.dispatch(setWorldResult(undefined));
      }
    }
    if (aliveTeams.length === 1 && !this.unificationEmitted) {
      const team = aliveTeams[0];
      this.unificationEmitted = true;
      this.unifyingFactionId = team.name;
      this.unificationMonth = year;
      this.cycleState = recordWorldUnified(this.cycleState, year);
      this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, year);
      WorldHistory.addUnification(year, team.name);
      DynastyRegistry.recordUnification(team.name);
      this.publishResult("unification", year, team, totalCells);
      return;
    }

    if (this.hegemonyEmitted || aliveTeams.length < 2) {
      return;
    }

    const leader = [...aliveTeams].sort(
      (a, b) => b.blocks.children.size - a.blocks.children.size
    )[0];
    if (!leader) {
      this.hegemonyCandidate = undefined;
      return;
    }

    const territoryMetrics = calculateTerritoryMetrics(aliveTeams, totalCells);
    const territoryPercent = getFactionTerritoryMetric(
      territoryMetrics,
      leader.name
    ).controlledTerritoryShare;
    if (territoryPercent < HEGEMONY_TERRITORY_PERCENT) {
      this.hegemonyCandidate = undefined;
      return;
    }

    if (
      !this.hegemonyCandidate ||
      this.hegemonyCandidate.teamName !== leader.name
    ) {
      this.hegemonyCandidate = { teamName: leader.name, since: year };
      return;
    }

    if (year - this.hegemonyCandidate.since < HEGEMONY_STABLE_MONTHS) {
      return;
    }

    this.hegemonyEmitted = true;
    WorldHistory.addHegemony(year, leader.name);
    this.publishResult("hegemony", year, leader, totalCells);
  }

  getPopulationGrowthMultiplier(team: Team) {
    return this.activeEffects
      .filter((effect) => effect.factionId === team.name)
      .reduce(
        (multiplier, effect) =>
          multiplier * effect.modifiers.populationGrowthMultiplier,
        1
      );
  }

  getEffects() {
    return [...this.activeEffects];
  }

  getCycleDiagnostics() {
    return this.cycleDiagnostics;
  }

  getProvisionalBlockerSummary(year: number, teams: Team[], totalCells: number) {
    const summary: Record<string, number> = {};
    teams
      .filter((team) => team.status === "ACTIVE" && team.identityStage === "PROVISIONAL")
      .forEach((team) => {
        const stability = getFactionStability(team) ?? 0;
        const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
        const hasFormalRuler = Boolean(
          currentRuler?.reignOrdinal !== undefined &&
            currentRuler.accessionYear !== undefined
        );
        const blockers = getStateFormationBlockers(
          team,
          year,
          stability,
          hasFormalRuler
        );
        blockers.forEach((blocker) => {
          summary[blocker] = (summary[blocker] ?? 0) + 1;
        });
      });
    summary.PROVISIONAL_OVERAGE = this.getProvisionalOverageCount(
      year,
      teams,
      totalCells
    );
    return summary;
  }

  private triggerRandomEvent(year: number, teams: Team[], totalCells: number) {
    const aliveTeams = teams.filter((team) => !team.isDie);
    if (aliveTeams.length === 0) {
      return;
    }

    const eventType = this.pickRandomEventType();
    const positive = eventType !== "famine";
    const team = this.pickFaction(aliveTeams, totalCells, positive);
    if (!team) {
      return;
    }

    if (eventType === "harvest") {
      this.addEffect(year, team, "harvest", HARVEST_GROWTH_MULTIPLIER);
      this.applyCityLoyaltyDelta(team, HARVEST_CITY_LOYALTY_DELTA);
      WorldHistory.addRandomEvent(
        year,
        team.name,
        `${team.displayName}势力迎来丰收（持续${WORLD_EFFECT_DURATION_MONTHS}个月）`,
        `人口自然增长 ×${HARVEST_GROWTH_MULTIPLIER.toFixed(2)}，所有城市忠诚 +${HARVEST_CITY_LOYALTY_DELTA}。`,
        "normal",
        {
          duration: WORLD_EFFECT_DURATION_MONTHS,
          populationGrowthMultiplier: HARVEST_GROWTH_MULTIPLIER,
          cityLoyaltyDelta: HARVEST_CITY_LOYALTY_DELTA,
        }
      );
      return;
    }

    if (eventType === "famine") {
      this.addEffect(year, team, "famine", FAMINE_GROWTH_MULTIPLIER);
      this.applyCityLoyaltyDelta(team, FAMINE_CITY_LOYALTY_DELTA);
      WorldHistory.addRandomEvent(
        year,
        team.name,
        `${team.displayName}势力发生旱灾（持续${WORLD_EFFECT_DURATION_MONTHS}个月）`,
        `人口自然增长 ×${FAMINE_GROWTH_MULTIPLIER.toFixed(2)}，所有城市忠诚 ${FAMINE_CITY_LOYALTY_DELTA}。`,
        "normal",
        {
          duration: WORLD_EFFECT_DURATION_MONTHS,
          populationGrowthMultiplier: FAMINE_GROWTH_MULTIPLIER,
          cityLoyaltyDelta: FAMINE_CITY_LOYALTY_DELTA,
        }
      );
      return;
    }

    if (eventType === "population-boom") {
      const count = Phaser.Math.Between(POPULATION_BOOM_MIN, POPULATION_BOOM_MAX);
      const spawned = this.spawnMembers(
        year,
        team,
        count,
        "Prosperity",
        USER_NATURAL_LOYALTY_MIN,
        USER_NATURAL_LOYALTY_MAX
      );
      WorldHistory.addRandomEvent(
        year,
        team.name,
        `${team.displayName}势力流民迁入，新增${spawned}人`,
        `立即增加${spawned}名人口。`,
        "normal",
        {
          immediatePopulation: spawned,
        }
      );
      return;
    }

    const spawned = this.spawnMembers(
      year,
      team,
      HEAVENLY_REINFORCEMENT_COUNT,
      "Heaven",
      USER_GOD_LOYALTY_MIN,
      USER_GOD_LOYALTY_MAX
    );
    WorldHistory.addRandomEvent(
      year,
      team.name,
      `${team.displayName}势力获得天降援军，新增${spawned}人`,
      `立即增加${spawned}名高忠诚援军。`,
      "normal",
      {
        immediatePopulation: spawned,
      }
    );
  }

  private checkStateFormation(year: number, teams: Team[]) {
    const activeStateNames = teams
      .filter((team) => team.status === "ACTIVE" && team.identityStage === "STATE")
      .map((team) => team.displayName);
    const historicalStateNames = teams.flatMap(getHistoricalFormalStateNames);
    teams.forEach((team) => {
      const stability = getFactionStability(team) ?? 0;
      const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
      const hasFormalRuler = Boolean(
        currentRuler?.reignOrdinal !== undefined &&
          currentRuler.accessionYear !== undefined
      );
      if (
        !observeStateFormationEligibility(
          team,
          year,
          stability,
          hasFormalRuler
        )
      ) {
        return;
      }
      const oldDisplayName = team.displayName;
      const stateName = createStateName(
        {
          capitalName: team.capitalCity?.name ?? team.capital,
          founderCityName: team.cities[0]?.name,
          houseName: team.houseName,
        },
        activeStateNames,
        historicalStateNames
      );
      if (!team.formState(stateName, year)) {
        return;
      }
      activeStateNames.push(stateName);
      historicalStateNames.push(stateName);
      const eventId = WorldHistory.addStateFounded(
        year,
        team.name,
        oldDisplayName,
        stateName,
        currentRuler ? DynastyRegistry.getRulerDisplay(team.name) : undefined,
        currentRuler?.id,
        team.capitalCity?.id,
        team.capitalCity?.name
      );
      DynastyRegistry.recordStateFounded(team.name, stateName, year, eventId);
    });
  }

  private applyProvisionalDissolutionPressure(
    year: number,
    teams: Team[],
    totalCells: number
  ) {
    if (
      year - this.lastProvisionalPressureYear <
      PROVISIONAL_DISSOLUTION_PRESSURE_INTERVAL_MONTHS
    ) {
      return;
    }
    this.lastProvisionalPressureYear = year;
    teams
      .filter((team) => team.status === "ACTIVE" && team.identityStage === "PROVISIONAL")
      .forEach((team) => {
        const stability = getFactionStability(team) ?? 0;
        const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
        const hasFormalRuler = Boolean(
          currentRuler?.reignOrdinal !== undefined &&
            currentRuler.accessionYear !== undefined
        );
        const territoryShare =
          (team.blocks.children.size / Math.max(totalCells, 1)) * 100;
        if (
          !shouldApplyProvisionalDissolutionPressure(
            team,
            year,
            territoryShare,
            stability,
            hasFormalRuler
          )
        ) {
          return;
        }
        this.applyCityLoyaltyDelta(team, PROVISIONAL_DISSOLUTION_LOYALTY_DELTA);
      });
  }

  private checkEmperorProclamation(year: number, teams: Team[], totalCells: number) {
    const activeCities = teams
      .filter((team) => team.status === "ACTIVE")
      .flatMap((team) => team.cities);
    const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
    const rankedTerritoryShares = teams
      .filter((team) => team.status === "ACTIVE")
      .map((team) => ({
        factionId: team.name,
        territoryShare: getFactionTerritoryMetric(territoryMetrics, team.name)
          .controlledTerritoryShare,
      }))
      .sort((a, b) => b.territoryShare - a.territoryShare);
    teams.forEach((team) => {
      const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
      const hasFormalRuler = Boolean(
        currentRuler?.reignOrdinal !== undefined &&
          currentRuler.accessionYear !== undefined
      );
      const baseStability = getFactionStability(team) ?? 0;
      const territoryShare = getFactionTerritoryMetric(
        territoryMetrics,
        team.name
      ).controlledTerritoryShare;
      const topOtherShare =
        rankedTerritoryShares.find((item) => item.factionId !== team.name)
          ?.territoryShare ?? 0;
      const cityShare =
        activeCities.length > 0 ? (team.cities.length / activeCities.length) * 100 : 0;
      const effectiveStability = getEffectiveStability(
        baseStability,
        team.sovereigntyRank
      );
      if (
        !observeEmperorProclamationEligibility(team, year, {
          territoryShare,
          cityShare,
          stability: effectiveStability,
          leadShare: territoryShare - topOtherShare,
          hasFormalRuler,
        })
      ) {
        return;
      }
      if (!team.proclaimEmperor(year)) {
        return;
      }
      const eventId = WorldHistory.addEmperorProclaimed(
        year,
        team.name,
        team.displayName,
        currentRuler ? DynastyRegistry.getRulerDisplay(team.name) : undefined,
        currentRuler?.id,
        territoryShare,
        cityShare,
        effectiveStability
      );
      DynastyRegistry.recordEmperorProclaimed(team.name, year, eventId);
    });
  }

  private applyCityLoyaltyDelta(team: Team, delta: number) {
    team.cities.forEach((city) => {
      city.loyalty = Phaser.Math.Clamp(city.loyalty + delta, 0, 100);
    });
  }

  private getProvisionalOverageCount(
    year: number,
    teams: Team[],
    totalCells: number
  ) {
    return teams.filter((team) => {
      if (team.status !== "ACTIVE" || team.identityStage !== "PROVISIONAL") {
        return false;
      }
      const stability = getFactionStability(team) ?? 0;
      const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
      const hasFormalRuler = Boolean(
        currentRuler?.reignOrdinal !== undefined &&
          currentRuler.accessionYear !== undefined
      );
      const territoryShare =
        (team.blocks.children.size / Math.max(totalCells, 1)) * 100;
      return shouldApplyProvisionalDissolutionPressure(
        team,
        year,
        territoryShare,
        stability,
        hasFormalRuler
      );
    }).length;
  }

  private addEffect(
    year: number,
    team: Team,
    type: WorldEffectType,
    populationGrowthMultiplier: number
  ) {
    this.sequence += 1;
    this.activeEffects.push({
      id: `${type}-${team.name}-${year}-${this.sequence}`,
      factionId: team.name,
      type,
      startYear: year,
      endYear: year + WORLD_EFFECT_DURATION_MONTHS,
      modifiers: {
        populationGrowthMultiplier,
      },
    });
  }

  private spawnMembers(
    year: number,
    team: Team,
    count: number,
    prefix: string,
    minLoyalty: number,
    maxLoyalty: number
  ) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      this.sequence += 1;
      const name = `${prefix}-${team.name}-${year}-${String(this.sequence).padStart(
        4,
        "0"
      )}`;
      if (
        Danmu.Apply(
          createLocalDanmu(
            name,
            team.name,
            Phaser.Math.Between(minLoyalty, maxLoyalty)
          )
        )
      ) {
        spawned += 1;
      }
    }
    return spawned;
  }

  private checkRestorations(year: number, teams: Team[]) {
    if (year - this.lastRebellionCheckYear < REBELLION_CHECK_INTERVAL_MONTHS) {
      return;
    }
    this.lastRebellionCheckYear = year;

    const cities = teams
      .flatMap((team) => team.cities)
      .filter((city) => city.ownerFactionId !== city.founderFactionId);
    for (const city of cities) {
      if (city.loyalty > REBELLION_LOYALTY_THRESHOLD) {
        continue;
      }
      if (city.isInCaptureGrace(year)) {
        continue;
      }
      const lastRebellionYear = this.cityRebellionYears[city.id];
      if (
        lastRebellionYear !== undefined &&
        year - lastRebellionYear < REBELLION_CITY_COOLDOWN_MONTHS
      ) {
        continue;
      }

      const owner = city.ownerTeam;
      const founder = city.founderTeam;
      if (!owner || !founder) {
        continue;
      }
      const ownerStability = getFactionStability(owner) ?? 100;
      const loyaltyPressure =
        (REBELLION_LOYALTY_THRESHOLD - city.loyalty) /
        REBELLION_LOYALTY_THRESHOLD;
      const instabilityBonus = (100 - ownerStability) / 100;
      const exileLegitimacy =
        founder.status === "EXILED"
          ? (WorldExiles.get(founder.name)?.legitimacy ?? 0) / 100
          : 1;
      const restorationWeight =
        founder.status === "EXILED"
          ? getRestorationWeightMultiplier(founder.sovereigntyRank)
          : 1;
      const cycleMultiplier = this.getCycleRebellionChanceMultiplier(
        owner,
        year,
        teams
      );
      const chance =
        REBELLION_BASE_CHANCE *
        loyaltyPressure *
        (1 + instabilityBonus) *
        exileLegitimacy *
        restorationWeight *
        FactionEffects.getRebellionRiskMultiplier(owner.name) *
        cycleMultiplier;
      if (Math.random() > chance) {
        continue;
      }

      if (!founder.isDie) {
        if (city.revoltTo(founder, year)) {
          this.cityRebellionYears[city.id] = year;
          return;
        }
      }

      const remnants = WorldRemnants.get(founder.name);
      const canRestoreFounder =
        founder.status === "EXILED" &&
        (remnants?.population ?? 0) > 0 &&
        FactionRegistry.canRestoreFaction(founder);
      if (canRestoreFounder) {
        const restoredPopulation = WorldRemnants.consume(
          founder.name,
          remnants?.population ?? 0
        );
        if (FactionRegistry.restoreFaction(founder, city, year, restoredPopulation)) {
          this.cityRebellionYears[city.id] = year;
          return;
        }
      }

      if (
        teams.filter((team) => !team.isDie).length < MAX_ACTIVE_FACTIONS &&
        ownerStability <= REBEL_OWNER_STABILITY_THRESHOLD_V095 &&
        city.loyalty <= REBEL_LOYALTY_THRESHOLD_V095
      ) {
        const frontier = isFrontierCity(city) && Math.random() <= FRONTIER_REBELLION_CHANCE;
        if (
          FactionRegistry.createRebelFaction({
            city,
            year,
            factionType: frontier ? "FRONTIER" : "REBEL",
          })
        ) {
          this.cityRebellionYears[city.id] = year;
          return;
        }
      }
    }
  }

  private checkEmpireSplit(year: number, teams: Team[], totalCells: number) {
    if (year - this.lastEmpireSplitCheckYear < EMPIRE_SPLIT_CHECK_INTERVAL_MONTHS) {
      return;
    }
    this.lastEmpireSplitCheckYear = year;
    const activeCount = teams.filter((team) => !team.isDie).length;
    if (activeCount >= MAX_ACTIVE_FACTIONS) {
      return;
    }

    const candidates = teams
      .filter((team) => !team.isDie && team.cities.length >= EMPIRE_SPLIT_MIN_CITIES)
      .sort((a, b) => b.cities.length - a.cities.length);
    for (const team of candidates) {
      const stability = getFactionStability(team) ?? 100;
      const unifiedDuration =
        this.unifyingFactionId === team.name && this.unificationMonth !== undefined
          ? year - this.unificationMonth
          : 0;
      const baseStrain = calculateImperialStrain(team, totalCells, unifiedDuration);
      const strain = Math.round(
        baseStrain *
          this.getCycleImperialStrainMultiplier(team, year, teams, totalCells)
      );
      const lowCities = team.cities.filter(
        (city) => city.loyalty <= EMPIRE_SPLIT_LOW_LOYALTY
      );
      if (
        lowCities.length === 0 ||
        (stability >= EMPIRE_SPLIT_STABILITY_THRESHOLD &&
          strain < EMPIRE_SPLIT_STRAIN_THRESHOLD)
      ) {
        continue;
      }
      const coreCity = selectSplitCore(lowCities) as City | undefined;
      if (!coreCity) {
        continue;
      }
      const founder = coreCity.founderTeam;
      if (
        founder &&
        shouldRestoreBeforeNewRebel(
          FactionRegistry.canRestoreFaction(founder),
          founder.status
        )
      ) {
        const remnants = WorldRemnants.get(founder.name);
        const restoredPopulation = WorldRemnants.consume(
          founder.name,
          remnants?.population ?? 0
        );
        if (FactionRegistry.restoreFaction(founder, coreCity, year, restoredPopulation)) {
          this.fractureUntilMonth = year + 60;
          return;
        }
      }

      const splitCities = selectSplitCities(
        coreCity,
        team.cities,
        EMPIRE_SPLIT_MAX_CITIES
      ) as City[];
      const rebel = FactionRegistry.createSplitFaction(team, splitCities, year);
      if (rebel) {
        WorldHistory.addEmpireSplit(
          year,
          team.name,
          rebel.name,
          splitCities.map((city) => city.name),
          splitCities.map((city) => city.id),
          DynastyRegistry.getRulerDisplay(rebel.name),
          DynastyRegistry.getCurrentRuler(rebel.name)?.id,
          `founding-${rebel.name}-${year}`
        );
        DynastyRegistry.recordRebellion(team.name);
        this.fractureUntilMonth = year + 60;
        return;
      }
    }
  }

  private checkCityFounding(year: number, teams: Team[]) {
    if (year - this.lastCityFoundCheckYear < CITY_FOUND_CHECK_INTERVAL_MONTHS) {
      return;
    }
    this.lastCityFoundCheckYear = year;
    const activeCities = teams.flatMap((team) => team.cities);
    if (activeCities.length >= MAX_ACTIVE_CITIES) {
      return;
    }
    teams
      .filter((team) => !team.isDie)
      .forEach((team) => {
        const lastFounded = this.cityFoundedYears[team.name] ?? -Infinity;
        if (year - lastFounded < CITY_FOUND_COOLDOWN_MONTHS) {
          return;
        }
        if (
          team.users.size < CITY_FOUND_MIN_POPULATION ||
          team.blocks.children.size < CITY_FOUND_MIN_TERRITORY ||
          (getFactionStability(team) ?? 0) < CITY_FOUND_MIN_STABILITY
        ) {
          return;
        }
        const block = findCitySite(team, activeCities);
        if (!block) {
          return;
        }
        const name = CityNameRegistry.allocateCityName(
          undefined,
          `${team.name}-city-${year}`,
          year
        );
        FactionRegistry.foundCity(team, block, name, year);
        this.cityFoundedYears[team.name] = year;
      });
  }

  foundRebelByGod(city: import("../Components/City").default, year: number) {
    if (
      city.isInCaptureGrace(year) ||
      !city.ownerTeam ||
      city.loyalty > REBEL_LOYALTY_THRESHOLD_V095
    ) {
      return false;
    }
    const activeCount = Game.Core?.teams.filter((team) => !team.isDie).length ?? 0;
    if (activeCount >= MAX_ACTIVE_FACTIONS) {
      return false;
    }
    const created = FactionRegistry.createRebelFaction({
      city,
      year,
      factionType: isFrontierCity(city) ? "FRONTIER" : "REBEL",
      godDriven: true,
    });
    if (created) {
      WorldHistory.addGodIncitedRebellion(year, city.name, created.name, city.id);
      this.cityRebellionYears[city.id] = year;
      return true;
    }
    return false;
  }

  restoreByGod(city: import("../Components/City").default, year: number) {
    const founder = city.founderTeam;
    if (!founder || !founder.isDie) {
      return false;
    }
    const remnants = WorldRemnants.get(founder.name);
    if (!remnants || remnants.population <= 0) {
      return false;
    }
    if (!FactionRegistry.canRestoreFaction(founder)) {
      return false;
    }
    const restoredPopulation = WorldRemnants.consume(
      founder.name,
      remnants?.population ?? 0
    );
    const restored = FactionRegistry.restoreFaction(
      founder,
      city,
      year,
      restoredPopulation
    );
    if (restored) {
      WorldHistory.addGodSupportedRestoration(year, founder.name, city.name, city.id);
      this.cityRebellionYears[city.id] = year;
      return true;
    }
    return false;
  }

  private pickRandomEventType(): RandomWorldEventType {
    const events: RandomWorldEventType[] = [
      "harvest",
      "famine",
      "population-boom",
      "heavenly-reinforcements",
    ];
    return events[Phaser.Math.Between(0, events.length - 1)];
  }

  private getCycleRebellionChanceMultiplier(
    owner: Team,
    year: number,
    teams: Team[]
  ) {
    this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, year);
    if (
      this.cycleState.currentUnificationStartMonth !== undefined &&
      owner.name === this.unifyingFactionId
    ) {
      return getUnifiedRebellionChanceMultiplier(
        this.cycleDiagnostics.unifiedAge
      );
    }
    const orderFactionId = getWorldCycleOrderFactionId(this.cycleState);
    if (orderFactionId === owner.name) {
      return getUnifiedRebellionChanceMultiplier(
        this.cycleDiagnostics.unifiedAge
      );
    }
    const leaderId = this.getLeadingConsolidationFactionId(teams, year);
    if (leaderId !== owner.name) {
      return 1;
    }
    return getConsolidationRebellionChanceMultiplier(
      this.cycleDiagnostics.consolidationModifier
    );
  }

  private getCycleImperialStrainMultiplier(
    team: Team,
    year: number,
    teams: Team[],
    totalCells: number
  ) {
    this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, year);
    if (
      this.cycleState.currentUnificationStartMonth !== undefined &&
      team.name === this.unifyingFactionId
    ) {
      return getUnifiedImperialStrainMultiplier(this.cycleDiagnostics.unifiedAge);
    }
    const orderFactionId = getWorldCycleOrderFactionId(this.cycleState);
    if (orderFactionId === team.name) {
      return getUnifiedImperialStrainMultiplier(this.cycleDiagnostics.unifiedAge);
    }
    const leaderId = this.getLeadingConsolidationFactionId(teams, year, totalCells);
    if (leaderId !== team.name) {
      return 1;
    }
    return getConsolidationImperialStrainMultiplier(
      this.cycleDiagnostics.consolidationModifier
    );
  }

  private getLeadingConsolidationFactionId(
    teams: Team[],
    year: number,
    totalCells = Game.Core?.totalCells ?? 1
  ) {
    this.cycleDiagnostics = getWorldCycleDiagnostics(
      this.cycleState,
      year
    );
    if (this.cycleDiagnostics.consolidationModifier <= 0) {
      return undefined;
    }
    const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
    return getLeadingConsolidationFaction(
      teams
        .filter((team) => team.status === "ACTIVE")
        .map((team) => ({
          team,
          territoryShare: getFactionTerritoryMetric(territoryMetrics, team.name)
            .controlledTerritoryShare,
          stability: getFactionStability(team) ?? 0,
        }))
    );
  }

  private buildWorldCycleMetrics(teams: Team[], totalCells: number) {
    const activeTeams = teams.filter((team) => team.status === "ACTIVE");
    const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
    const activeCityCount = Math.max(
      1,
      activeTeams.reduce((sum, team) => sum + team.cities.length, 0)
    );
    return activeTeams.map((team) => ({
      team,
      territoryShare: getFactionTerritoryMetric(territoryMetrics, team.name)
        .controlledTerritoryShare,
      cityShare: (team.cities.length / activeCityCount) * 100,
      stability: getFactionStability(team) ?? 0,
    }));
  }

  private publishStrategicCycleModifiers() {
    FactionEffects.clearStrategicModifiers();
    const factionId = this.cycleDiagnostics.hegemonicCandidateId;
    if (!factionId || this.cycleDiagnostics.hegemonicSiegeMultiplier <= 1) {
      return;
    }
    const captureLoyaltyBonus = getHegemonicCaptureLoyaltyBonusFromSiegeMultiplier(
      this.cycleDiagnostics.hegemonicSiegeMultiplier
    );
    FactionEffects.setStrategicModifier(factionId, {
      siegeMultiplier: this.cycleDiagnostics.hegemonicSiegeMultiplier,
      captureLoyaltyBonus,
    });
  }

  private pickFaction(teams: Team[], totalCells: number, positive: boolean) {
    const maxTerritory = Math.max(
      1,
      ...teams.map((team) => team.blocks.children.size)
    );
    const weighted = teams.map((team) => {
      const weakness = 1 - team.blocks.children.size / maxTerritory;
      const territoryShare = team.blocks.children.size / Math.max(totalCells, 1);
      const weight = positive
        ? 1 + weakness * WEAK_FACTION_POSITIVE_EVENT_BIAS
        : 1 + territoryShare * 0.25;
      return { team, weight };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.team;
      }
    }
    return weighted[weighted.length - 1]?.team;
  }

  private rollNextEventYear(year: number) {
    return (
      year +
      Phaser.Math.Between(
        RANDOM_EVENT_MIN_INTERVAL_MONTHS,
        RANDOM_EVENT_MAX_INTERVAL_MONTHS
      )
    );
  }

  private publishResult(
    type: "unification" | "hegemony",
    year: number,
    team: Team,
    totalCells: number
  ) {
    store.dispatch(
      setWorldResult({
        type,
        teamName: team.name,
        year,
        monthIndex: year,
        population: team.users.size,
        territory: team.blocks.children.size,
        territoryPercent: (team.blocks.children.size / totalCells) * 100,
        historyEventCount: WorldHistory.getEvents().length,
      })
    );
  }
}

function getHistoricalFormalStateNames(team: Team) {
  if (team.stateFoundedMonth === undefined) {
    return [];
  }
  return team.nameHistory
    .filter((entry) => entry.startMonth >= (team.stateFoundedMonth ?? 0))
    .map((entry) => entry.name);
}

function isFrontierCity(city: import("../Components/City").default) {
  const width = Math.max(1, city.block.scene.renderer.width);
  const height = Math.max(1, city.block.scene.renderer.height);
  const xRatio = city.block.x / width;
  const yRatio = city.block.y / height;
  return (
    xRatio < FRONTIER_EDGE_RATIO ||
    xRatio > 1 - FRONTIER_EDGE_RATIO ||
    yRatio < FRONTIER_EDGE_RATIO ||
    yRatio > 1 - FRONTIER_EDGE_RATIO
  );
}

function findCitySite(team: Team, activeCities: City[]) {
  const blocks = [...team.blocks.children.entries] as Block[];
  const existing = activeCities.map((city) => ({
    x: Math.round(city.block.x / Game.BlockSize),
    y: Math.round(city.block.y / Game.BlockSize),
  }));
  const existingZones = activeCities.map((city) =>
    city.fortifiedCells.map((cell) => ({
      x: Math.round(cell.x / Game.BlockSize),
      y: Math.round(cell.y / Game.BlockSize),
    }))
  );
  const candidateMaxDefense =
    CITY_BASE_MAX_DEFENSE + getFactionDevelopmentLevel(team);
  const maxX = Game.Core?.map?.getMaxX() ?? 0;
  const maxY = Game.Core?.map?.getMaxY() ?? 0;
  const candidates = blocks
    .filter((block) => !block.city)
    .map((block) => ({
      block,
      x: Math.round(block.x / Game.BlockSize),
      y: Math.round(block.y / Game.BlockSize),
    }))
    .filter(
      (item) =>
        item.x > 1 &&
        item.y > 1 &&
        item.x < maxX - 2 &&
        item.y < maxY - 2
    )
    .filter((item) => {
      const cells = getCandidateFortifiedGridCells(
        { x: item.x, y: item.y },
        candidateMaxDefense
      );
      return !hasZoneOverlapOrGapViolation(cells, existingZones, CITY_MIN_ZONE_GAP);
    })
    .map((item) => ({
      block: item.block,
      nearestCityDistance: Math.min(
        ...existing.map(
          (city) => Math.abs(city.x - item.x) + Math.abs(city.y - item.y)
        )
      ),
    }))
    .filter((item) => item.nearestCityDistance >= CITY_FOUND_MIN_DISTANCE_CELLS)
    .sort((a, b) => b.nearestCityDistance - a.nearestCityDistance);
  return candidates[0]?.block;
}
