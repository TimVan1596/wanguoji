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
import FactionSnapshots from "./FactionSnapshots";
import WorldEventSystem from "./WorldEventSystem";
import WorldClock from "./WorldClock";
import DynastyRegistry from "../Politics/Dynasty";
import FactionEffects from "./FactionEffects";
import WorldExiles from "./WorldExiles";
import WorldEra from "./WorldEra";
import LongRunProfiler from "./LongRunProfiler";
import ArchivedCities from "./ArchivedCities";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "./TerritoryMetrics";

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

  startWorld(
    teams: Team[],
    totalCells: number,
    populations: InitialPopulationMap
  ) {
    this.started = true;
    this.running = true;
    this.clock.reset();
    this.clock.setRunning(true);
    this.population.reset();
    this.events.reset(0);
    FactionSnapshots.reset();
    WorldEra.reset();
    LongRunProfiler.reset();
    WorldHistory.reset();
    WorldHistory.addWorldBorn(0, teams);
    DynastyRegistry.reset();
    FactionEffects.reset();
    WorldExiles.reset();
    teams.forEach((team) => DynastyRegistry.initializeFaction(team, 0));
    this.population.initialize(teams, populations);
    FactionSnapshots.observe(0, teams, totalCells);
    WorldHistory.observeWorld(0, teams, totalCells);
    this.events.observeWorldGoal(0, teams, totalCells);
    WorldEra.observe(0, teams, totalCells, this.events.getCurrentPhase(0, teams));
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

  isRunning() {
    return this.started && this.running;
  }

  observeWorld(teams: Team[], totalCells: number) {
    WorldHistory.observeWorld(this.clock.year, teams, totalCells);
    this.events.observeWorldGoal(this.clock.year, teams, totalCells);
    WorldEra.observe(this.clock.year, teams, totalCells, this.events.getCurrentPhase(this.clock.year, teams));
  }

  update(delta: number, teams: Team[], totalCells: number) {
    this.advance(delta * this.speed, teams, totalCells);
  }

  advance(simulationDeltaMs: number, teams: Team[], totalCells: number) {
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
      WorldEra.observe(this.clock.year, teams, totalCells, this.events.getCurrentPhase(this.clock.year, teams));
      this.population.update(this.clock.year, teams, (team) =>
        this.events.getPopulationGrowthMultiplier(team)
      );
      teams.forEach((team) => {
        team.cities.forEach((city) => city.updateDefense(this.clock.year));
      });
      FactionEffects.update(this.clock.year);
      DynastyRegistry.update(this.clock.year, teams);
      WorldExiles.update(this.clock.year, teams);
      FactionSnapshots.observe(this.clock.year, teams, totalCells);
      WorldHistory.observeWorld(this.clock.year, teams, totalCells);
      this.events.observeWorldGoal(this.clock.year, teams, totalCells);
      if (debugProfileEnabled) {
        const cycle = this.events.getCycleDiagnostics();
        const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
        const rankedTerritory = teams
          .filter((team) => team.status === "ACTIVE")
          .map((team) => getFactionTerritoryMetric(territoryMetrics, team.name))
          .sort((a, b) => b.controlledTerritoryShare - a.controlledTerritoryShare);
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
            hegemonicMomentum: cycle.hegemonicMomentum,
            hegemonicSiegeMultiplier: cycle.hegemonicSiegeMultiplier,
            consolidationLeaderId: cycle.consolidationLeaderId,
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

  restoreFactionByGod(city: City) {
    return this.events.restoreByGod(city, this.clock.year);
  }

  foundRebelByGod(city: City) {
    return this.events.foundRebelByGod(city, this.clock.year);
  }
}
