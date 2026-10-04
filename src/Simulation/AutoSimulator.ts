import Team from "../Components/Team";
import City from "../Components/City";
import WorldHistory from "../History/WorldHistory";
import { store } from "../store";
import {
  setSimulationSpeed,
  setWorldRunning,
  setWorldStarted,
} from "../store/rootSlice";
import PopulationSystem, { InitialPopulationMap } from "./PopulationSystem";
import { getPopulationCapacity } from "./PopulationSystem";
import FactionSnapshots from "./FactionSnapshots";
import WorldEventSystem from "./WorldEventSystem";
import WorldClock from "./WorldClock";
import DynastyRegistry from "../Politics/Dynasty";
import FactionEffects from "./FactionEffects";
import WorldExiles from "./WorldExiles";
import WorldEra from "./WorldEra";
import type { EraMapSnapshotV1 } from "./EraMapSnapshot";
import LongRunProfiler from "./LongRunProfiler";
import { resetNameGenerationTelemetry } from "../Politics/NameGenerationTelemetry";
import ArchivedCities from "./ArchivedCities";
import { calculateImperialStrain, getCityDistanceFromCapital } from "./ImperialStrain";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "./TerritoryMetrics";
import { PopulationMutationContext, PopulationTransitionAudit } from "./PopulationTransitionAudit";
import Diplomacy, { DiplomacySystem } from "../Politics/Diplomacy";
import { formatWorldDate } from "./WorldTime";

const debugProfileEnabled =
  import.meta.env.DEV ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1");

export default class AutoSimulator {
  private clock = new WorldClock();
  private population = new PopulationSystem();
  private events = new WorldEventSystem();
  private started = false;
  private running = false;
  private speed = 1;
  private lastProfilerEraId?: string;
  private lastProfilerCycleStage?: string;
  private lastProfilerCycleFamily?: "UNIFIED" | "FRAGMENTED";
  private lastProfilerLiteralMonopoly = false;
  private lastProfilerDynasticOrderId?: string;
  readonly populationTransitionAudit = new PopulationTransitionAudit();
  private lastKnownCities: City[] = [];
  private lastKnownTeams: Team[] = [];
  private diplomacy = new DiplomacySystem(Diplomacy, () => this.lastKnownCities, ({ type, month, relation }) => {
    const factionName = (id: string) => this.lastKnownTeams.find((team) => team.name === id)?.displayName ?? id;
    const names = [factionName(relation.factionAId), factionName(relation.factionBId)];
    const title = type === "treaty-expired"
      ? `${names.join("、")}协议到期`
      : type === "truce-signed" ? `${names.join("、")}议定停战` : `${names.join("、")}订立互不侵犯`;
    WorldHistory.addEvent({
      id: `diplomacy-${type}-${relation.factionAId}-${relation.factionBId}-${month}`,
      year: month, monthIndex: month, category: "politics", type, title,
      description: type === "treaty-expired"
        ? "双方恢复原有外交状态。"
        : type === "truce-signed"
          ? `约期${Math.round((relation.expiresMonth - month) / 12)}年，至${formatWorldDate(relation.expiresMonth)}。`
          : `约期五年，至${formatWorldDate(relation.expiresMonth)}。`,
      factionIds: [relation.factionAId, relation.factionBId], relatedFactionIds: [relation.factionAId, relation.factionBId],
      metadata: { reason: relation.reason, expiresMonth: relation.expiresMonth },
      importance: "normal",
    });
  });

  startWorld(
    teams: Team[],
    totalCells: number,
    populations: InitialPopulationMap,
    captureMapSnapshot?: (capturedMonth: number) => EraMapSnapshotV1
  ) {
    Diplomacy.reset();
    this.lastKnownTeams = teams;
    this.lastKnownCities = teams.flatMap((team) => team.cities);
    this.started = true;
    this.running = true;
    this.clock.reset();
    this.clock.setRunning(true);
    this.population.reset();
    this.events.reset(0);
    FactionSnapshots.reset();
    WorldEra.reset();
    LongRunProfiler.reset(0, "FRAGMENTED");
    resetNameGenerationTelemetry();
    this.lastProfilerEraId = undefined;
    this.lastProfilerCycleStage = undefined;
    this.lastProfilerCycleFamily = undefined;
    this.lastProfilerLiteralMonopoly = false;
    this.lastProfilerDynasticOrderId = undefined;
    WorldHistory.reset();
    WorldHistory.addWorldBorn(0, teams);
    DynastyRegistry.reset();
    FactionEffects.reset();
    WorldExiles.reset();
    teams.forEach((team) => DynastyRegistry.initializeFaction(team, 0));
    this.population.initialize(teams, populations);
    this.populationTransitionAudit.reset(0, teams);
    FactionSnapshots.observe(0, teams, totalCells);
    WorldHistory.observeWorld(0, teams, totalCells);
    this.events.observeWorldGoal(0, teams, totalCells);
    WorldEra.observe(0, teams, totalCells, this.events.getCurrentPhase(0, teams), captureMapSnapshot);
    this.rebaseProfilerLatches();
    store.dispatch(setWorldStarted(true));
    store.dispatch(setWorldRunning(true));
    store.dispatch(setSimulationSpeed(this.speed));
  }

  setRunning(running: boolean) {
    if (!this.started) {
      return;
    }
    this.running = running;
    this.clock.setRunning(running);
    store.dispatch(setWorldRunning(running));
  }

  setSpeed(speed: number) {
    this.speed = speed;
    store.dispatch(setSimulationSpeed(speed));
  }

  getSpeed() {
    return this.speed;
  }

  recordPopulationMutation(team: Team, before: number, after: number, metadata: PopulationMutationContext) {
    this.populationTransitionAudit.record(team, before, after, {
      ...metadata,
      month: metadata.month ?? this.clock.year,
    });
  }

  getPopulationTransitionDiagnostics() {
    return this.populationTransitionAudit.getRecentSignificant();
  }

  godAddPopulation(team: Team, count: number) {
    return this.population.godAdd(team, count);
  }

  godRemovePopulation(team: Team, count: number) {
    return this.population.godRemove(team, count);
  }

  getPopulationCapacity(team: Team) {
    return getPopulationCapacity(team);
  }

  exportState() {
    return {
      started: this.started,
      running: this.running,
      selectedSpeed: this.speed,
      clock: this.clock.exportState(),
      populationSystem: this.population.exportState(),
      worldEventSystem: this.events.exportState(),
    };
  }

  importState(state: {
    started: boolean;
    selectedSpeed: number;
    clock: { worldMonth: number; elapsedMs: number; running: boolean };
    populationSystem: ReturnType<PopulationSystem["exportState"]>;
    worldEventSystem: ReturnType<WorldEventSystem["exportState"]>;
  }, teams?: Team[]) {
    this.started = state.started;
    this.running = false;
    this.speed = state.selectedSpeed;
    this.clock.importState({ ...state.clock, running: false });
    this.population.importState(state.populationSystem);
    this.events.importState(state.worldEventSystem, state.clock.worldMonth);
    if (teams) this.populationTransitionAudit.reset(state.clock.worldMonth, teams);
    this.lastKnownCities = teams?.flatMap((team) => team.cities) ?? [];
    this.lastKnownTeams = teams ?? [];
    this.rebaseProfilerLatches();
    store.dispatch(setWorldStarted(this.started));
    store.dispatch(setWorldRunning(false));
    store.dispatch(setSimulationSpeed(this.speed));
  }

  getCurrentPhase(teams: Team[]) {
    return this.events.getCurrentPhase(this.clock.worldMonth, teams);
  }

  isRunning() {
    return this.started && this.running;
  }

  rebaseProfilerLatches() {
    const cycle = this.events.getCycleDiagnostics();
    this.lastProfilerCycleStage = cycle.stage;
    this.lastProfilerCycleFamily = cycle.stage === "UNIFIED_EARLY" || cycle.stage === "UNIFIED_MATURE" || cycle.stage === "DYNASTIC_FATIGUE"
      ? "UNIFIED"
      : "FRAGMENTED";
    this.lastProfilerEraId = WorldEra.getCurrentEra()?.id;
    this.lastProfilerLiteralMonopoly = this.events.isLiteralMonopolyActive();
    this.lastProfilerDynasticOrderId = cycle.dynasticOrderFactionId;
  }

  observeWorld(teams: Team[], totalCells: number, captureMapSnapshot?: (capturedMonth: number) => EraMapSnapshotV1) {
    WorldHistory.observeWorld(this.clock.year, teams, totalCells);
    this.events.observeWorldGoal(this.clock.year, teams, totalCells);
    WorldEra.observe(this.clock.year, teams, totalCells, this.events.getCurrentPhase(this.clock.year, teams), captureMapSnapshot);
  }

  update(delta: number, teams: Team[], totalCells: number) {
    this.advance(delta * this.speed, teams, totalCells);
  }

  advance(
    simulationDeltaMs: number,
    teams: Team[],
    totalCells: number,
    captureMapSnapshot?: (capturedMonth: number) => EraMapSnapshotV1
  ) {
    if (!this.started || !this.running) {
      return;
    }

    const advancedMonths = this.clock.update(simulationDeltaMs);
    for (let i = 0; i < advancedMonths; i++) {
      const stepStart =
        import.meta.env.DEV && globalThis.performance
          ? globalThis.performance.now()
          : undefined;
      this.events.update(this.clock.year, teams, totalCells);
      this.lastKnownTeams = teams;
      this.lastKnownCities = teams.flatMap((team) => team.cities);
      this.diplomacy.update(this.clock.year, teams, totalCells);
      WorldEra.observe(this.clock.year, teams, totalCells, this.events.getCurrentPhase(this.clock.year, teams), captureMapSnapshot);
      this.population.update(this.clock.year, teams, (team) =>
        this.events.getPopulationGrowthMultiplier(team)
      );
      teams.forEach((team) => {
        team.cities.forEach((city) => city.updateDefense(this.clock.year));
      });
      FactionEffects.update(this.clock.year);
      DynastyRegistry.update(this.clock.year, teams);
      WorldExiles.update(this.clock.year, teams);
      this.populationTransitionAudit.reconcile(this.clock.year, teams);
      FactionSnapshots.observe(this.clock.year, teams, totalCells);
      WorldHistory.observeWorld(this.clock.year, teams, totalCells);
      this.events.observeWorldGoal(this.clock.year, teams, totalCells);
      if (debugProfileEnabled) {
        const cycle = this.events.getCycleDiagnostics();
        const currentEra = WorldEra.getCurrentEra();
        if (cycle.stage !== this.lastProfilerCycleStage) {
          LongRunProfiler.recordTransition({ kind: "CYCLE_STAGE_CHANGED", month: this.clock.year, from: this.lastProfilerCycleStage, to: cycle.stage });
          const family = cycle.stage === "UNIFIED_EARLY" || cycle.stage === "UNIFIED_MATURE" || cycle.stage === "DYNASTIC_FATIGUE" ? "UNIFIED" : "FRAGMENTED";
          if (family !== this.lastProfilerCycleFamily) {
            LongRunProfiler.recordTransition({ kind: family === "UNIFIED" ? "WORLD_UNIFIED" : "WORLD_FRAGMENTED", month: this.clock.year, from: this.lastProfilerCycleFamily, to: family });
            this.lastProfilerCycleFamily = family;
          }
          this.lastProfilerCycleStage = cycle.stage;
        }
        if (currentEra && currentEra.id !== this.lastProfilerEraId) {
          LongRunProfiler.recordTransition({ kind: this.lastProfilerEraId ? "ERA_REPLACED" : "ERA_CONFIRMED", month: currentEra.confirmedMonth, from: this.lastProfilerEraId, to: currentEra.id, factionId: currentEra.dominantFactionIds[0] });
          this.lastProfilerEraId = currentEra.id;
        }
        const literalMonopoly = this.events.isLiteralMonopolyActive();
        if (literalMonopoly !== this.lastProfilerLiteralMonopoly) {
          LongRunProfiler.recordTransition({ kind: literalMonopoly ? "LITERAL_MONOPOLY_STARTED" : "LITERAL_MONOPOLY_ENDED", month: this.clock.year, factionId: cycle.hegemonicOwnerId });
          this.lastProfilerLiteralMonopoly = literalMonopoly;
        }
        if (cycle.dynasticOrderFactionId !== this.lastProfilerDynasticOrderId) {
          LongRunProfiler.recordTransition({ kind: cycle.dynasticOrderFactionId ? "DYNASTIC_ORDER_ESTABLISHED" : "DYNASTIC_ORDER_LOST", month: this.clock.year, factionId: cycle.dynasticOrderFactionId });
          this.lastProfilerDynasticOrderId = cycle.dynasticOrderFactionId;
        }
        const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
        const rankedTerritory = teams
          .filter((team) => team.status === "ACTIVE")
          .map((team) => getFactionTerritoryMetric(territoryMetrics, team.name))
          .sort((a, b) => b.controlledTerritoryShare - a.controlledTerritoryShare);
        const formalRanked = teams
          .filter((team) => team.status === "ACTIVE" && team.identityStage === "STATE")
          .map((team) => ({ team, territory: getFactionTerritoryMetric(territoryMetrics, team.name).controlledTerritoryShare, cities: team.cities.length, stability: team.cities.length ? team.cities.reduce((sum, city) => sum + (city.loyalty ?? 0), 0) / team.cities.length : 0 }))
          .sort((a, b) => b.territory - a.territory);
        const formalCityTotal = Math.max(1, formalRanked.reduce((sum, item) => sum + item.cities, 0));
        const formalTop1 = formalRanked[0];
        const provisionalRanked = teams.filter((team) => team.status === "ACTIVE").map((team) => ({ team, territory: getFactionTerritoryMetric(territoryMetrics, team.name).controlledTerritoryShare })).sort((a, b) => b.territory - a.territory);
        const dynasticBlockerFlags = [
          ["SOLE_TERRITORY", (formalTop1?.territory ?? 0) < 60],
          ["SOLE_CITY_SHARE", (formalTop1 ? formalTop1.cities / formalCityTotal * 100 : 0) < 55],
          ["SOLE_STABILITY", (formalTop1?.stability ?? 0) < 65],
          ["SOLE_TOP2", (formalRanked[1]?.territory ?? 0) > 20],
        ] as Array<[string, boolean]>;
        const soleDynasticBlocker = dynasticBlockerFlags.filter(([, failed]) => failed);
        const stateFormationBlockers = this.events.getProvisionalBlockerSummary(
          this.clock.year,
          teams,
          totalCells
        );
        LongRunProfiler.observe(
          this.clock.year,
          teams,
          stepStart === undefined || !globalThis.performance
            ? undefined
            : globalThis.performance.now() - stepStart,
          {
            archivedCities: ArchivedCities.list().length,
            totalRulers: DynastyRegistry.getAll().reduce(
              (sum, dynasty) => sum + dynasty.rulers.length,
              0
            ),
            historyEvents: WorldHistory.getEventCount(),
            factionSnapshots: FactionSnapshots.getTotalSnapshotCount(),
            worldEras: WorldEra.getEras().length,
            fragmentationAge: cycle.fragmentationAge,
            unifiedAge: cycle.unifiedAge,
            cycleStage: cycle.stage,
            consolidationModifier: cycle.consolidationModifier,
            dynasticGraceMultiplier: cycle.dynasticGraceMultiplier,
            dynasticFatigueMultiplier: cycle.dynasticFatigueMultiplier,
            hegemonicCandidateId: cycle.hegemonicCandidateId,
            hegemonicOwnerId: cycle.hegemonicOwnerId,
            hegemonicMomentum: cycle.hegemonicMomentum,
            hegemonicSiegeMultiplier: cycle.hegemonicSiegeMultiplier,
            consolidationLeaderId: cycle.consolidationLeaderId,
            consolidationLeaderCandidateId: cycle.consolidationLeaderCandidateId,
            consolidationLeaderOwnerId: cycle.consolidationLeaderOwnerId,
            consolidationLeaderMomentum: cycle.consolidationLeaderMomentum,
            stateFormationBlockers,
            provisionalOverageCount: stateFormationBlockers.PROVISIONAL_OVERAGE ?? 0,
            controlledBlocks: territoryMetrics.controlledBlocks,
            neutralBlocks: territoryMetrics.neutralBlocks,
            top1AbsoluteShare: rankedTerritory[0]?.absoluteWorldShare ?? 0,
            top1ControlledShare:
              rankedTerritory[0]?.controlledTerritoryShare ?? 0,
            top2ControlledShare:
              rankedTerritory[1]?.controlledTerritoryShare ?? 0,
            top3ControlledShare:
              rankedTerritory[2]?.controlledTerritoryShare ?? 0,
            formalTop1TerritoryShare: formalTop1?.territory ?? 0,
            formalTop1CityShare: formalTop1 ? formalTop1.cities / formalCityTotal * 100 : 0,
            top1Provisional: provisionalRanked[0]?.team.identityStage === "PROVISIONAL",
            top3ContainsProvisional: provisionalRanked.slice(0, 3).some((item) => item.team.identityStage === "PROVISIONAL"),
            maxProvisionalTerritoryShare: Math.max(0, ...provisionalRanked.filter((item) => item.team.identityStage === "PROVISIONAL").map((item) => item.territory)),
            maxProvisionalCityCount: Math.max(0, ...teams.filter((team) => team.identityStage === "PROVISIONAL").map((team) => team.cities.length)),
            dynasticOrderBlockers: {
              TERRITORY: !formalTop1 || formalTop1.territory < 60,
              CITY_SHARE: !formalTop1 || formalTop1.cities / formalCityTotal * 100 < 55,
              STABILITY: !formalTop1 || formalTop1.stability < 65,
              TOP2_SHARE: (formalRanked[1]?.territory ?? 0) > 20,
              NO_FORMAL_STATE: !formalTop1,
            },
            dynasticTerritoryQualified: (formalTop1?.territory ?? 0) >= 60,
            dynasticCityQualified: (formalTop1 ? formalTop1.cities / formalCityTotal * 100 : 0) >= 55,
            dynasticStabilityQualified: (formalTop1?.stability ?? 0) >= 65,
            dynasticTop2Qualified: (formalRanked[1]?.territory ?? 0) <= 20,
            dynasticAllQualified: Boolean(formalTop1 && formalTop1.territory >= 60 && formalTop1.cities / formalCityTotal * 100 >= 55 && formalTop1.stability >= 65 && (formalRanked[1]?.territory ?? 0) <= 20),
            dynasticCandidateFactionId: cycle.dynasticOrderCandidateFactionId,
            soleDynasticBlocker: soleDynasticBlocker.length === 1 ? soleDynasticBlocker[0][0] : undefined,
            top1Stability: formalTop1?.stability,
            rawImperialStrain: formalTop1 ? calculateImperialStrain(formalTop1.team, totalCells, 0) : undefined,
            effectiveImperialStrain: formalTop1 ? calculateImperialStrain(formalTop1.team, totalCells, 0) * FactionEffects.getAdministrativeStrainMultiplier(formalTop1.team.name) : undefined,
            lowLoyaltyCityCount: formalTop1?.team.cities.filter((city) => city.loyalty < 65).length,
            minimumCityLoyalty: formalTop1 ? Math.min(...formalTop1.team.cities.map((city) => city.loyalty)) : undefined,
            averageCapitalDistance: formalTop1 && formalTop1.team.cities.length ? formalTop1.team.cities.reduce((sum, city) => sum + getCityDistanceFromCapital(formalTop1.team, city), 0) / formalTop1.team.cities.length : undefined,
            eraType: WorldEra.getCurrentEra()?.type,
            eraCandidateType: WorldEra.getCandidateDiagnostics(this.clock.year)?.type,
            eraCandidateSinceMonth: WorldEra.getCandidateDiagnostics(this.clock.year)?.sinceMonth,
          }
        );
      }
    }
  }

  get year() {
    return this.clock.year;
  }

  getWorldCycleDiagnostics() {
    return this.events.getCycleDiagnostics();
  }

  getDiplomacyDiagnostics() {
    return Diplomacy.getDiagnostics(this.clock.year);
  }

  importDiplomacyState(state: Parameters<typeof Diplomacy.importState>[0]) {
    Diplomacy.importState(state);
  }

  restoreFactionByGod(city: City) {
    return this.events.restoreByGod(city, this.clock.year);
  }

  foundRebelByGod(city: City) {
    return this.events.foundRebelByGod(city, this.clock.year);
  }
}
