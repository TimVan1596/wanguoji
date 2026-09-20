import Team from "../Components/Team";
import {
  EXILE_BASE_LEGITIMACY_DECAY,
  EXILE_INITIAL_LEGITIMACY_MAX,
  EXILE_INITIAL_LEGITIMACY_MIN,
  EXILE_LEGITIMACY_DECAY_INTERVAL_MONTHS,
  EXILE_REMNANT_DECAY_CHANCE,
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

  reset() {
    this.exiles.clear();
  }

  start(team: Team, worldMonth: number, remnantPopulation: number) {
    const dynasty = DynastyRegistry.get(team.name);
    const existing = this.exiles.get(team.name);
    const state: ExileState = {
      factionId: team.name,
      startedMonth: existing?.startedMonth ?? worldMonth,
      rulerId: dynasty?.currentRulerId ?? undefined,
      heirIds: dynasty?.heirIds ? [...dynasty.heirIds] : [],
      remnantPopulation,
      legitimacy:
        existing?.legitimacy ??
        Phaser.Math.Between(EXILE_INITIAL_LEGITIMACY_MIN, EXILE_INITIAL_LEGITIMACY_MAX),
      lastLegitimacyMonth: worldMonth,
      lastRemnantDecayMonth: worldMonth,
    };
    this.exiles.set(team.name, state);
    return state;
  }

  restore(factionId: string) {
    this.exiles.delete(factionId);
  }

  get(factionId: string) {
    return this.exiles.get(factionId);
  }

  update(worldMonth: number, teams: Team[]) {
    teams
      .filter((team) => team.status === "EXILED")
      .forEach((team) => {
        const remnant = WorldRemnants.get(team.name);
        const state =
          this.exiles.get(team.name) ??
          this.start(team, team.lastExiledYear ?? worldMonth, remnant?.population ?? 0);

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
          remnant &&
          worldMonth - state.lastRemnantDecayMonth >=
            EXILE_REMNANT_DECAY_INTERVAL_MONTHS
        ) {
          state.lastRemnantDecayMonth = worldMonth;
          if (Math.random() <= EXILE_REMNANT_DECAY_CHANCE) {
            const nextPopulation = decayRemnantPopulation(remnant.population);
            WorldRemnants.setPopulation(team.name, nextPopulation, remnant.extinctYear);
            state.remnantPopulation = nextPopulation;
          }
        }

        const currentRemnants = WorldRemnants.get(team.name)?.population ?? 0;
        state.remnantPopulation = currentRemnants;
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
          WorldHistory.addFactionExtinct(
            worldMonth,
            team.name,
            `${team.name}国残部已经消散，王统断绝，${team.name}国彻底灭亡`
          );
        }
      });
  }
}

const WorldExiles = new WorldExileStore();

export default WorldExiles;
