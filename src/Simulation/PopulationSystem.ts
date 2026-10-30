import {residentNaturalDeathMonth,ordinaryLifeEligible,worldRecoveryMultiplier} from "./ResidentLife";
import WorldHistory from "../History/WorldHistory";
import { getEffectivePopulationCapacity, getPopulationRecoveryContext, wartimePopulationLossInterval } from "./PopulationRecoveryRules";
import { measurePhase, type MonthlyPhaseProfiler } from "./MonthlyPhaseProfiler";
import Team from "../Components/Team";
import Danmu from "../Live/Danmu";
import { createLocalDanmu, getLocalUserId } from "../Live/LocalDanmaku";
import {
  BASE_GROWTH_CHANCE,
  NATURAL_GROWTH_CHECK_MONTHS,
  USER_NATURAL_LOYALTY_MAX,
  USER_NATURAL_LOYALTY_MIN,
} from "../config/simulation";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";
import type { PopulationMutationContext } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";

export type InitialPopulationMap = Record<string, number>;

export function selectNormalUsersForGodRemoval<T extends { id: number; name: string; role: string }>(users: Iterable<T>, requested: number) {
  return [...users]
    .filter((user) => user.role === "NORMAL")
    .sort((a, b) => a.id - b.id || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, Math.floor(requested)));
}

export function getPopulationCapacity(team: Team) {
  return getEffectivePopulationCapacity(team);
}

export default class PopulationSystem {
  private counters: Record<string, number> = {};
  private lastGrowthMonth = 0;
  private wartimeLossMonths: Record<string, number> = {};

  getRuntimeCardinality() { return { populationNameCounters: Object.keys(this.counters).length }; }

  exportState() {
    return { counters: { ...this.counters }, lastGrowthMonth: this.lastGrowthMonth, wartimeLossMonths: { ...this.wartimeLossMonths } };
  }

  importState(state: { counters: Record<string, number>; lastGrowthMonth: number; wartimeLossMonths: Record<string, number> }) {
    this.counters = { ...state.counters };
    this.lastGrowthMonth = state.lastGrowthMonth;
    this.wartimeLossMonths = { ...state.wartimeLossMonths };
  }

  reset() {
    this.counters = {};
    this.lastGrowthMonth = 0;
    this.wartimeLossMonths = {};
  }

  initialize(teams: Team[], populations: InitialPopulationMap) {
    teams.forEach((team) => {
      const count = populations[team.name] ?? 0;
      for (let i = 0; i < count; i++) {
        this.spawn(team, undefined, false, { cause: "INITIALIZATION" });
      }
    });
  }

  update(
    worldMonth: number,
    teams: Team[],
    getGrowthMultiplier: (team: Team) => number = () => 1,
    profile?: MonthlyPhaseProfiler
  ) {
    if (worldMonth <= this.lastGrowthMonth) {
      return;
    }
    const previousMonth = this.lastGrowthMonth;
    this.lastGrowthMonth = worldMonth;

    // Stable identity plans, not repeated mortality draws. Existing military/royal life writers retain authority.
    for(const team of teams)for(const user of [...team.users])if(ordinaryLifeEligible(user)&&worldMonth>=residentNaturalDeathMonth(user.id,user.bornMonth))
      user.destroyUser(false,{cause:'NATURAL_DEATH',month:worldMonth,damageSource:'RESIDENT_LIFESPAN',context:`普通居民 User ${user.id}，出生月${user.bornMonth}，寿终月${residentNaturalDeathMonth(user.id,user.bornMonth)}`});
    const recentEvents = WorldHistory.getEventsBetween?.(Math.max(0, worldMonth - 24), worldMonth) ?? [];
    const aliveTeams = measurePhase(profile, "Population.active faction scan", () => teams.filter((team) => team.status === "ACTIVE" && !team.isDie));
    aliveTeams.forEach((team) => {
      const { population, capacity } = measurePhase(profile, "Population.capacity", () => ({ population: this.getPopulation(team), capacity: this.getCapacity(team) }));
      if (population >= capacity) {
        return;
      }

      const context = measurePhase(profile, "Population.growth context", () => getPopulationRecoveryContext(team, worldMonth, recentEvents));
      const effect = getGrowthMultiplier(team);
      // Same 1–3 opportunities per three months, spread over calendar months.
      // At most one real natural increment per faction/month; skipped time is not replayed in a burst.
      const phase = [...team.name].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0)%NATURAL_GROWTH_CHECK_MONTHS;
      const due = Array.from({length:Math.min(NATURAL_GROWTH_CHECK_MONTHS,worldMonth-previousMonth)},(_,i)=>worldMonth-i)
        .some(m=>(m+phase)%NATURAL_GROWTH_CHECK_MONTHS<context.attempts);
      if (!due) return;
      {
        const current = this.getPopulation(team);
        if (current >= capacity) return;
        const roomRatio = (capacity - current) / capacity;
        const chance = Math.min(.85, BASE_GROWTH_CHANCE * roomRatio * (current <= 0 ? .65 : 1) * context.multiplier * effect * worldRecoveryMultiplier(teams.reduce((n,t)=>n+t.users.size,0)));
        if (worldRandom.next() < chance) {
          measurePhase(profile, "Population.spawn/runtime creation", () => this.spawn(team, undefined, false, { cause: "NATURAL_GROWTH", month: worldMonth, context: context.state }, profile));
        }
      }
    });
  }

  canApplyWartimeLoss(team: Team, worldMonth: number) {
    const last = this.wartimeLossMonths[team.name];
    return Number.isSafeInteger(worldMonth) && worldMonth >= 0 && team.status === "ACTIVE" && team.users.size > 0 &&
      (last === undefined || worldMonth - last >= wartimePopulationLossInterval(team.users.size));
  }

  recordWartimeLoss(team: Team, worldMonth: number) { this.wartimeLossMonths[team.name] = worldMonth; }

  getPopulation(team: Team) {
    return team.users.size;
  }

  getCapacity(team: Team) {
    return getPopulationCapacity(team);
  }

  godAdd(team: Team, requested: number) {
    let affectedCount = 0;
    for (let index = 0; index < Math.max(0, Math.floor(requested)); index += 1) {
      const name = this.nextGodName(team);
      const user = this.spawn(team, name, true, { cause: "GOD_ACTION" });
      if (user) affectedCount += 1;
    }
    return affectedCount;
  }

  godRemove(team: Team, requested: number) {
    const users = selectNormalUsersForGodRemoval(team.users, requested);
    let affectedCount = 0;
    for (const user of users) {
      if (user.destroyUser(false, { cause: "GOD_ACTION" })) affectedCount += 1;
    }
    return affectedCount;
  }

  private nextGodName(team: Team) {
    const key = `god:${team.name}`;
    const count = (this.counters[key] ?? 0) + 1;
    this.counters[key] = count;
    return `God-${team.name}-${String(count).padStart(6, "0")}`;
  }

  private spawn(
    team: Team,
    forcedName?: string,
    bypassCapacity = false,
    populationMutation: PopulationMutationContext = { cause: "NATURAL_GROWTH" },
    profile?: MonthlyPhaseProfiler
  ) {
    if (team.isDie || (!bypassCapacity && this.getPopulation(team) >= this.getCapacity(team))) return undefined;
    const teamKey = team.shortName ?? team.name;
    let name = forcedName;
    if (!name) {
      const count = (this.counters[team.name] ?? 0) + 1;
      this.counters[team.name] = count;
      name = `${teamKey}-${String(count).padStart(3, "0")}`;
    }
    const id = measurePhase(profile, "Population.user id lookup", () => {
      let candidateId = getLocalUserId(name!);
      while (Team.GetUserById(candidateId)) candidateId = candidateId >= 1999999999 ? 1000000000 : candidateId + 1;
      return candidateId;
    });
    const user = measurePhase(profile, "Population.makeUser", () => team.makeUser(
      id,
      name!,
      resolvePublicAssetUrl("img/no-face.svg"),
      worldRandom.int(USER_NATURAL_LOYALTY_MIN, USER_NATURAL_LOYALTY_MAX),
      "NORMAL",
      undefined,
      populationMutation
    ));
    if (user) return user;
    // Legacy join-command routing remains the fallback for natural population.
    return Danmu.Apply(createLocalDanmu(name, team.name,
      worldRandom.int(USER_NATURAL_LOYALTY_MIN, USER_NATURAL_LOYALTY_MAX)), populationMutation);
  }
}
