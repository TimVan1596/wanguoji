import { getProductionRemnantProtection } from "./ExileResourceExperiments";
import { ExileResourceDiagnostics, type RestorationSource } from "./ExileResourceDiagnostics";
import { deriveRestorationTenureEvidence } from "./RestorationTenureEvidence";
import Team from "../Components/Team";
import {
  EXILE_BASE_LEGITIMACY_DECAY,
  EXILE_INITIAL_LEGITIMACY_MAX,
  EXILE_INITIAL_LEGITIMACY_MIN,
  EXILE_LEGITIMACY_DECAY_INTERVAL_MONTHS,
  EXILE_REMNANT_DECAY_INTERVAL_MONTHS,
} from "../config/simulation";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import {
  decayExileLegitimacy,
  decayRemnantPopulation,
  shouldExileBecomeExtinct,
} from "../Politics/ExileRules";
import WorldRemnants from "./WorldRemnants";
import { getExileLegitimacyDecayMultiplier } from "./SovereigntyModifiers";
import worldRandom from "./WorldRandom";

export interface ExileState {
  factionId: string;
  startedMonth: number;
  rulerId?: string;
  heirIds: string[];
  remnantPopulation: number;
  legitimacy: number;
  lastLegitimacyMonth: number;
  lastRemnantDecayMonth: number;
}

class WorldExileStore {
  private exiles = new Map<string, ExileState>();
  private observedIds = new Set<string>();
  private observedOverflow = false;
  private politicalEnds = 0;
  private resources = new ExileResourceDiagnostics();
  private pendingSamples = new WeakSet<ExileState>();
  getResourceSamples() { return this.resources.getSamples(); }
  getProductionProtectionSummary() { return this.resources.productionSummary(); }
  getResourceComparisonSummary() { return this.resources.comparisonSummary(); }
  recordRestoration(factionId: string, month: number, source: RestorationSource = "OTHER") { this.resources.recordRestoration(factionId, month, source); }
  private resetObservations() { this.observedIds.clear(); this.observedOverflow = false; this.politicalEnds = 0; this.resources = new ExileResourceDiagnostics(); this.pendingSamples = new WeakSet(); }
  getDiagnostics() {
    return { currentExiled: this.exiles.size, observedExiled: this.observedIds.size, observedOverflow: this.observedOverflow, politicalEnds: this.politicalEnds, ...this.resources.snapshot() };
  }
  private observe(factionId: string) {
    if (this.observedIds.size < 4096 || this.observedIds.has(factionId)) this.observedIds.add(factionId);
    else this.observedOverflow = true;
  }

  reset() {
    this.exiles.clear();
    this.resetObservations();
  }

  start(team: Team, worldMonth: number, remnantPopulation: number) {
    const dynasty = DynastyRegistry.get(team.name);
    const existing = this.exiles.get(team.name);
    // Repeated notification of the same episode must not restart resource clocks.
    if (existing) return existing;
    const state: ExileState = {
      factionId: team.name,
      startedMonth: worldMonth,
      rulerId: dynasty?.currentRulerId ?? undefined,
      heirIds: dynasty?.heirIds ? [...dynasty.heirIds] : [],
      remnantPopulation,
      legitimacy: worldRandom.int(EXILE_INITIAL_LEGITIMACY_MIN, EXILE_INITIAL_LEGITIMACY_MAX),
      lastLegitimacyMonth: worldMonth,
      lastRemnantDecayMonth: worldMonth,
    };
    this.exiles.set(team.name, state);
    this.resources.started(team.name); this.pendingSamples.add(state);
    this.observe(team.name);
    return state;
  }

  restore(factionId: string) {
    this.exiles.delete(factionId);
  }

  get(factionId: string) {
    return this.exiles.get(factionId);
  }

  exportState() {
    return [...this.exiles.values()].map((entry) => ({ ...entry, startedMonth: entry.startedMonth }));
  }

  importState(states: ExileState[]) {
    this.resetObservations();
    this.exiles = new Map(states.map((state) => [state.factionId, { ...state, heirIds: [...state.heirIds] }]));
  }

  update(worldMonth: number, teams: Team[]) {
    teams
      .filter((team) => team.status === "EXILED")
      .forEach((team) => {
        this.observe(team.name);
        const remnant = WorldRemnants.get(team.name);
        const state =
          this.exiles.get(team.name) ??
          this.start(team, team.lastExiledYear ?? worldMonth, remnant?.population ?? 0);

        const beforePopulation = remnant?.population ?? 0;
        const beforeLegitimacy = state.legitimacy;
        if (this.pendingSamples.has(state)) {
          this.pendingSamples.delete(state);
          const tenure = deriveRestorationTenureEvidence({ team, dynasty: DynastyRegistry.get(team.name),
            events: WorldHistory.getEventsForFaction(team.name), worldMonth });
          this.resources.addSample({ factionId: team.name, startedMonth: state.startedMonth,
            initialRemnants: beforePopulation, initialLegitimacy: beforeLegitimacy,
            emperor: team.sovereigntyRank === "EMPEROR", tenure });
        }
        if (
          worldMonth - state.lastLegitimacyMonth >=
          EXILE_LEGITIMACY_DECAY_INTERVAL_MONTHS
        ) {
          state.lastLegitimacyMonth = worldMonth;
          const population = remnant?.population ?? 0;
          state.legitimacy = decayExileLegitimacy(
            state.legitimacy,
            population,
            EXILE_BASE_LEGITIMACY_DECAY *
              getExileLegitimacyDecayMultiplier(team.sovereigntyRank)
          );
        }

        if (
          remnant && remnant.population > 0 &&
          worldMonth - state.lastRemnantDecayMonth >=
            EXILE_REMNANT_DECAY_INTERVAL_MONTHS
        ) {
          state.lastRemnantDecayMonth = worldMonth;
          const tenure = deriveRestorationTenureEvidence({ team, dynasty: DynastyRegistry.get(team.name),
            events: WorldHistory.getEventsForFaction(team.name), worldMonth });
          const protection = getProductionRemnantProtection(tenure, worldMonth, state.startedMonth, team.lastExiledYear);
          // Exactly one existing business draw; observations never affect the decision.
          const hit = worldRandom.next() <= protection.chance;
          this.resources.recordRemnantCheck({ factionId: team.name, factionName: team.displayName, worldMonth, tenure, ...protection, hit });
          if (hit) {
            const nextPopulation = decayRemnantPopulation(remnant.population);
            WorldRemnants.setPopulation(team.name, nextPopulation, remnant.extinctYear);
            state.remnantPopulation = nextPopulation;
          }
        }

        const currentRemnants = WorldRemnants.get(team.name)?.population ?? 0;
        state.remnantPopulation = currentRemnants;
        this.resources.recordResources(state, beforePopulation, currentRemnants, beforeLegitimacy, state.legitimacy,
          DynastyRegistry.hasClaimantAtMonth(team.name, worldMonth));
        if (
          shouldExileBecomeExtinct(
            currentRemnants,
            state.legitimacy,
            DynastyRegistry.hasClaimant(team.name)
          )
        ) {
          team.markExtinct(worldMonth);
          DynastyRegistry.markExtinct(team, worldMonth);
          this.exiles.delete(team.name);
          this.politicalEnds++;
          WorldHistory.addFactionExtinct(
            worldMonth,
            team.name,
            `${team.name}国残部耗尽、流亡合法性归零，独立王统政治终结`
          );
        }
      });
    this.resources.updateFollowups(worldMonth, teams);
  }
}

const WorldExiles = new WorldExileStore();

export default WorldExiles;
