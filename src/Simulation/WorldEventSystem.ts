import { getLocalRestorationClaimant, assessLocalRestorationPopulation } from "./LocalRestorationSupport";
import { deriveRestorationTenureEvidence } from "./RestorationTenureEvidence";
import type User from "../Components/User";
import { getLocalResponseDrawDistribution, selectLocalResponseOpportunity, localResidentRestorationChance, getWarTornCityEvidence, warTornRestorationChance, deriveHistoricalCityRules, getHistoricalRestorationBasis, historicalRestorationChance, type RestorationBasis } from "./HistoricalRestorationRules";
import { measurePhase, type MonthlyPhaseProfiler } from "./MonthlyPhaseProfiler";
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
import type { PopulationMutationContext } from "./PopulationTransitionAudit";
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
  recordLiteralUnificationBroken,
  recordWorldUnified,
  WorldCycleDiagnostics,
  WorldCycleState,
} from "./WorldCycleRules";
import { createStateName } from "./StateNameGenerator";
import worldRandom from "./WorldRandom";
import Block from "../Components/Block";
import City from "../Components/City";
import DynastyRegistry from "../Politics/Dynasty";
import {
  getStateFormationBlockers,
  isDeFactoStateFormationEligible,
  isStateFormationEligible,
  observeEmperorProclamationEligibility,
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

interface LocalOpportunitySample {
  factionId:string; cityId:string; cityName:string; ownerId:string; worldMonth:number; supporters:number;
  basis:string; crisis:string; legacyChance:number; finalChance:number; actualChance:number; result:string;
}

function createLocalSupportDiagnostics() {
  return { candidateChecks: 0, historyEligible: 0, populationCandidates: 0, noUser: 0, claimantBlocked: 0,
    legitimacyBlocked: 0, cityBlocked: 0, identityBlocked: 0, eligible: 0, draws: 0, expected: 0,
    drawHits: 0, successes: 0, transferFailures: 0, executionFailures: 0,
    populationScans:0, nearbyNormal:0, identityInArea:0, outsideArea:0, invalidUnit:0, historyBlocked:0,
    distinct:{countries:0,cities:0,users:0},distinctOverflow:false,recentOpportunities:[] as LocalOpportunitySample[] };
}

export default class WorldEventSystem {
  private localObserved={countries:new Set<string>(),cities:new Set<string>(),users:new Set<string>()};
  private observeLocal(kind:"countries"|"cities"|"users", ids:readonly string[]) {
    const set=this.localObserved[kind], d=this.restorationDiagnostics.localSupport;
    for(const id of ids) {if(set.size<4096 || set.has(id)) set.add(id);else d.distinctOverflow=true;}
    d.distinct[kind]=set.size;
  }
  private activeEffects: ActiveWorldEffect[] = [];
  private nextEventYear = 0;
  private sequence = 0;
  private hegemonyCandidate: HegemonyCandidate | undefined;
  private restorationDiagnostics = { startMonth: 0, endMonth: 0, draws: 0, restorationDraws: 0, expectedRestorations: 0, evaluationTicks: 0, exiledFactions: 0, lowLoyaltyCityChecks: 0, cityChecks: 0, warTornCityChecks: 0, historicalCandidates: 0, warTornEligible: 0, warTornSuccesses: 0, failures: 0,
    founderCandidates: 0, formerCapitalCandidates: 0, longRuleCandidates: 0, eligibleChecks: 0, attempts: 0, successes: 0,
    founderEligible: 0, capitalEligible: 0, longRuleEligible: 0, founderSuccesses: 0, capitalSuccesses: 0, longRuleSuccesses: 0,
    localSupport: createLocalSupportDiagnostics(), soleBlockers: {} as Record<string, number>, blockers: {} as Record<string, number> };
  getRestorationDiagnosticSnapshot() { return structuredClone(this.restorationDiagnostics); }
  getRestorationDiagnostics() {
    const d = this.restorationDiagnostics;
    const exile = WorldExiles.getDiagnostics();
    const local = d.localSupport, followup = exile.bySource.LOCAL_RESIDENT;
    const localSummary = `旧地真实响应（本次会话，读取后重置；检查次数不是国家数）：\n旧地候选检查${local.candidateChecks}；历史资格通过${local.historyEligible}次、未通过${local.historyBlocked}次；响应User候选${local.populationCandidates}人次（城市—旧国检查）；完整响应资格${local.eligible}次\n城域人口扫描${local.populationScans}次（每城市一次）：附近NORMAL ${local.nearbyNormal}人次；域内身份不适合${local.identityInArea}人次；域外${local.outsideArea}人次；无效逻辑引用${local.invalidUnit}人次\n本会话去重：旧国${local.distinct.countries}、城市${local.distinct.cities}、有效位置User ${local.distinct.users}${local.distinctOverflow ? "（去重容量4096，至少以上数量）" : ""}\n阻断：无可响应User ${local.noUser}；无合法继统者${local.claimantBlocked}；合法性不足${local.legitimacyBlocked}；城市条件/保护期/冷却${local.cityBlocked}；政治身份不足${local.identityBlocked}（可重叠）\n真实政治draw ${local.draws}；条件期望响应${local.expected.toFixed(6)}；响应抽签命中${local.drawHits}；实际复国${local.successes}；人口转属成功${local.successes}；人口转属失败${local.transferFailures}；其他执行失败${local.executionFailures}\n响应复国连续在国随访：12月${followup.active12}/${followup.matured12}，随访不足${followup.insufficient12}；60月${followup.active60}/${followup.matured60}，随访不足${followup.insufficient60}\n各恢复来源（全路径会话成功）：原残部${exile.bySource.REMNANT.restorations}；旧地居民${followup.restorations}；其他${exile.bySource.OTHER.restorations}\n最近真实机会（最多3条，概率为该次实际draw使用值）：\n${local.recentOpportunities.map(s=>`${s.worldMonth}月 · ${s.factionId}／${s.cityName}[${s.cityId}]／占领国${s.ownerId}；可响应${s.supporters}人；${s.basis=== "FORMER_CAPITAL"?"正式旧都":"长期统治地"}、${s.crisis}；原候选风险${(100*s.legacyChance).toFixed(4)}%→本次候选风险${(100*s.finalChance).toFixed(4)}%；共享draw实际概率${(100*s.actualChance).toFixed(4)}%；${s.result}`).join("\n") || "本会话无有效机会"}`;
    const resourceSummary = `完整资格资源阻断（城市—国家候选检查）：残部为0 ${d.blockers["残部耗尽"] ?? 0}；合法性不足 ${d.blockers["流亡合法性不足"] ?? 0}；无真实继统者 ${d.blockers["无合法继统者"] ?? 0}\n城市现实阻断（城市检查）：忠诚/战乱条件 ${d.blockers["忠诚度高于叛乱门槛且无战乱旧地机会"] ?? 0}；保护期 ${d.blockers["占领保护期"] ?? 0}；冷却 ${d.blockers["城市叛乱冷却"] ?? 0}（可重叠）\n流亡资源（月度检查）：新流亡${exile.newExiles}；实际资源检查${exile.resourceChecks}；残部衰减检查${exile.remnantChecks}、命中${exile.remnantHits}\n首次残部归零${exile.remnantFirstZero}；首次合法性归零${exile.legitimacyFirstZero}；当月无真实继统主体检查${exile.claimantBlocked}\n真正城市政治draw：${d.draws}；其中有有效复国概率${d.restorationDraws}；条件期望复国触发${d.expectedRestorations.toFixed(6)}（非保证执行成功）\n复国随访（所有真实恢复路径、本会话、连续在国）：12月${exile.active12}/${exile.matured12}，随访不足${exile.insufficient12}；60月${exile.active60}/${exile.matured60}，随访不足${exile.insufficient60}；再度流亡${exile.reexiles}；随访容量未跟踪${exile.followupOverflow}；再流亡计数容量未跟踪${exile.reexileTrackingOverflow}\n存档canonical复国事件累计：${WorldHistory.getEventTypeCount("faction-restored")}（全历史、与会话成功分开）\n${WorldExiles.getProductionProtectionSummary()}\n${WorldExiles.getResourceComparisonSummary()}`;
    return `复国统计（城市年度检查；本次会话，读取时重置）\n实际观察：${d.endMonth - d.startMonth}个月（${((d.endMonth-d.startMonth)/12).toFixed(2)}世界年）\n${localSummary}\n${resourceSummary}\n年度检查：${d.evaluationTicks}次；当前流亡国家：${exile.currentExiled}个；会话曾观察流亡国家：${exile.observedExiled}${exile.observedOverflow ? "个以上（计数容量4096）" : "个"}\n所有实际城市年度检查：${d.cityChecks}次\n忠诚度≤28的城市检查：${d.lowLoyaltyCityChecks}次\n忠诚度29～39的战乱城市检查：${d.warTornCityChecks}次\n具有历史资格的流亡候选：${d.historicalCandidates}次；战乱旧地完整合格：${d.warTornEligible}次\n原始建城者候选：${d.founderCandidates}次（合格${d.founderEligible}，复国${d.founderSuccesses}）\n旧都复国候选：${d.formerCapitalCandidates}次（合格${d.capitalEligible}，复国${d.capitalSuccesses}）\n长期统治地候选：${d.longRuleCandidates}次（合格${d.longRuleEligible}，复国${d.longRuleSuccesses}）\n完整资格通过：${d.eligibleChecks}次；执行尝试：${d.attempts}次；实际复国：${d.successes}次（战乱旧地${d.warTornSuccesses}次）；执行失败：${d.failures}次\n流亡政治终结：${exile.politicalEnds}次\n主要阻断：${Object.entries(d.blockers).map(([key, value]) => `${key} ${value}次`).join("、") || "暂无"}\n单项阻断：${Object.entries(d.soleBlockers).map(([key, value]) => `${key} ${value}次`).join("、") || "暂无"}\n阻断可同时出现多项，其总数不是独立城市或国家数。\n候选与资格为城市—国家年度检查次数，不是独立国家数。实际次数仅统计上述城市检查，不含神力支持和分裂判定的恢复；旧历史资格不可回溯。`;
  }
  private resetRestorationDiagnostics(month: number) {
    this.localObserved={countries:new Set(),cities:new Set(),users:new Set()};
    this.restorationDiagnostics = { startMonth: month, endMonth: month, draws: 0, restorationDraws: 0, expectedRestorations: 0, evaluationTicks: 0, exiledFactions: 0, lowLoyaltyCityChecks: 0, cityChecks: 0, warTornCityChecks: 0, historicalCandidates: 0, warTornEligible: 0, warTornSuccesses: 0, failures: 0,
      founderCandidates: 0, formerCapitalCandidates: 0, longRuleCandidates: 0, eligibleChecks: 0, attempts: 0, successes: 0,
    founderEligible: 0, capitalEligible: 0, longRuleEligible: 0, founderSuccesses: 0, capitalSuccesses: 0, longRuleSuccesses: 0, localSupport: createLocalSupportDiagnostics(), soleBlockers: {}, blockers: {} };
  }
  private restorationBlock(reason: string) { this.restorationBlocks([reason]); }
  private restorationBlocks(reasons: string[]) {
    const d = this.restorationDiagnostics;
    for (const reason of reasons) d.blockers[reason] = (d.blockers[reason] ?? 0) + 1;
    if (reasons.length === 1) d.soleBlockers[reasons[0]] = (d.soleBlockers[reasons[0]] ?? 0) + 1;
  }
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
    this.resetRestorationDiagnostics(startYear);
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

  exportState() {
    return {
      activeEffects: this.activeEffects.map((effect) => {
        const { startYear, endYear, ...rest } = effect;
        return { ...rest, startMonth: startYear, endMonth: endYear };
      }),
      nextEventMonth: this.nextEventYear,
      sequence: this.sequence,
      hegemonyCandidate: this.hegemonyCandidate ? { ...this.hegemonyCandidate } : undefined,
      hegemonyEmitted: this.hegemonyEmitted,
      unificationEmitted: this.unificationEmitted,
      unifyingFactionId: this.unifyingFactionId,
      unificationMonth: this.unificationMonth,
      fractureUntilMonth: this.fractureUntilMonth,
      lastRebellionCheckMonth: this.lastRebellionCheckYear,
      lastEmpireSplitCheckMonth: this.lastEmpireSplitCheckYear,
      lastCityFoundCheckMonth: this.lastCityFoundCheckYear,
      lastProvisionalPressureMonth: this.lastProvisionalPressureYear,
      cityFoundedMonths: { ...this.cityFoundedYears },
      cityRebellionMonths: { ...this.cityRebellionYears },
      cycleState: { ...this.cycleState },
    };
  }

  importState(state: ReturnType<WorldEventSystem["exportState"]>, worldMonth = 0) {
    this.resetRestorationDiagnostics(worldMonth);
    this.activeEffects = state.activeEffects.map(({ startMonth, endMonth, ...effect }) => ({
      ...effect,
      startYear: startMonth,
      endYear: endMonth,
    }));
    this.nextEventYear = state.nextEventMonth;
    this.sequence = state.sequence;
    this.hegemonyCandidate = state.hegemonyCandidate ? { ...state.hegemonyCandidate } : undefined;
    this.hegemonyEmitted = state.hegemonyEmitted;
    this.unificationEmitted = state.unificationEmitted;
    this.unifyingFactionId = state.unifyingFactionId;
    this.unificationMonth = state.unificationMonth;
    this.fractureUntilMonth = state.fractureUntilMonth;
    this.lastRebellionCheckYear = state.lastRebellionCheckMonth;
    this.lastEmpireSplitCheckYear = state.lastEmpireSplitCheckMonth;
    this.lastCityFoundCheckYear = state.lastCityFoundCheckMonth;
    this.lastProvisionalPressureYear = state.lastProvisionalPressureMonth;
    this.cityFoundedYears = { ...state.cityFoundedMonths };
    this.cityRebellionYears = { ...state.cityRebellionMonths };
    this.cycleState = { ...state.cycleState };
    this.cycleDiagnostics = getWorldCycleDiagnostics(this.cycleState, worldMonth);
  }

  getRuntimeCardinality() {
    return { worldEventActiveEffects: this.activeEffects.length,
      cityFoundedCooldowns: Object.keys(this.cityFoundedYears).length,
      cityRebellionCooldowns: Object.keys(this.cityRebellionYears).length };
  }

  update(year: number, teams: Team[], totalCells: number, profile?: MonthlyPhaseProfiler) {
    this.restorationDiagnostics.endMonth = year;
    measurePhase(profile, "WorldEvent.expired effects", () => {
      this.activeEffects = this.activeEffects.filter((effect) => year < effect.endYear);
    });
    measurePhase(profile, "WorldEvent.observeWorldGoal", () => this.observeWorldGoal(year, teams, totalCells));
    measurePhase(profile, "WorldEvent.checkStateFormation", () => this.checkStateFormation(year, teams, totalCells));
    measurePhase(profile, "WorldEvent.applyProvisionalDissolutionPressure", () => this.applyProvisionalDissolutionPressure(year, teams, totalCells));
    measurePhase(profile, "WorldEvent.checkEmperorProclamation", () => this.checkEmperorProclamation(year, teams, totalCells));
    measurePhase(profile, "WorldEvent.checkRestorations", () => this.checkRestorations(year, teams));
    measurePhase(profile, "WorldEvent.checkEmpireSplit", () => this.checkEmpireSplit(year, teams, totalCells));
    measurePhase(profile, "WorldEvent.checkCityFounding", () => this.checkCityFounding(year, teams));
    if (year < this.nextEventYear) {
      return;
    }
    measurePhase(profile, "WorldEvent.triggerRandomEvent", () => this.triggerRandomEvent(year, teams, totalCells));
    this.nextEventYear = this.rollNextEventYear(year);
  }

  getCurrentPhase(year: number, teams: Team[]) {
    const aliveTeams = teams.filter((team) => !team.isDie);
    return getWorldPhase(aliveTeams.length, this.fractureUntilMonth, year);
  }

  observeWorldGoal(year: number, teams: Team[], totalCells: number) {
    const aliveTeams = teams.filter((team) => !team.isDie);
    const hadDynasticOrder = this.cycleState.dynasticOrderFactionId !== undefined;
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
      const structuralOrderLoss = hadDynasticOrder && this.cycleState.dynasticOrderFactionId === undefined;
      if (this.unifyingFactionId) {
        if (structuralOrderLoss) WorldHistory.addWorldFractured(year, this.unifyingFactionId);
      }
      this.unificationEmitted = false;
      this.unifyingFactionId = undefined;
      this.unificationMonth = undefined;
      this.cycleState = structuralOrderLoss
        ? recordWorldFragmented(this.cycleState, year)
        : recordLiteralUnificationBroken(this.cycleState);
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

  isLiteralMonopolyActive() {
    return this.unificationEmitted;
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
      const count = worldRandom.int(POPULATION_BOOM_MIN, POPULATION_BOOM_MAX);
      const spawned = this.spawnMembers(
        year,
        team,
        count,
        "Prosperity",
        USER_NATURAL_LOYALTY_MIN,
        USER_NATURAL_LOYALTY_MAX,
        { cause: "RANDOM_EVENT", month: year, context: "population-boom" }
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
      USER_GOD_LOYALTY_MAX,
      { cause: "RANDOM_EVENT", month: year, context: "heavenly-reinforcements" }
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

  private checkStateFormation(year: number, teams: Team[], totalCells: number) {
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
      const territoryShare = getFactionTerritoryMetric(calculateTerritoryMetrics(teams, totalCells), team.name).controlledTerritoryShare;
      const deFacto = isDeFactoStateFormationEligible(team, year, this.cycleDiagnostics.fragmentationAge, territoryShare, stability, hasFormalRuler);
      const ordinary = isStateFormationEligible(team, year, stability, hasFormalRuler);
      if (!ordinary && !deFacto) {
        team.stateFormationEligibleSinceMonth = undefined;
        return;
      }
      team.stateFormationEligibleSinceMonth ??= year;
      const requiredMonths = ordinary ? 12 : 24;
      if (year - team.stateFormationEligibleSinceMonth >= requiredMonths) {
          const oldDisplayName = team.displayName;
          const stateName = createStateName({ capitalName: team.capitalCity?.name ?? team.capital, founderCityName: team.cities[0]?.name, houseName: team.houseName }, activeStateNames, historicalStateNames, (max) => worldRandom.pickIndex(max));
          if (team.formState(stateName, year)) {
            activeStateNames.push(stateName);
            historicalStateNames.push(stateName);
            const eventId = WorldHistory.addStateFounded(year, team.name, oldDisplayName, stateName, currentRuler ? DynastyRegistry.getRulerDisplay(team.name) : undefined, currentRuler?.id, team.capitalCity?.id, team.capitalCity?.name);
            DynastyRegistry.recordStateFounded(team.name, stateName, year, eventId);
          }
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
        historicalStateNames,
        (max) => worldRandom.pickIndex(max)
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
    maxLoyalty: number,
    populationMutation: PopulationMutationContext
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
            worldRandom.int(minLoyalty, maxLoyalty)
          ),
          populationMutation
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

    const diagnostics = this.restorationDiagnostics;
    diagnostics.evaluationTicks++;
    diagnostics.endMonth = year;
    const exiled = teams.filter(team => team.status === "EXILED");
    diagnostics.exiledFactions = exiled.length;
    const formalMonths = new Map(teams.filter(team => team.stateFoundedMonth !== undefined).map(team => [team.name, team.stateFoundedMonth!]));
    const teamsById = new Map(teams.map(team => [team.name, team]));
    const zeroRemnantExiles = exiled.filter(t => (WorldRemnants.get(t.name)?.population ?? 0) <= 0);
    const local = diagnostics.localSupport;
    this.observeLocal("countries",zeroRemnantExiles.map(t=>t.name));
    const cities = teams.flatMap(team => team.cities);
    for (const city of cities) {
      if (city.destroyed) continue;
      diagnostics.cityChecks++;
      const owner = city.ownerTeam;
      const founder = city.founderTeam;
      if (!owner) continue;
      const rules = exiled.length ? deriveHistoricalCityRules(city, year, formalMonths) : undefined;
      const localHistoryCount = (rules ?? []).filter(r => zeroRemnantExiles.some(t => t.name === r.factionId) && getHistoricalRestorationBasis(r)).length;
      local.candidateChecks += zeroRemnantExiles.length;
      local.historyEligible += localHistoryCount;
      local.historyBlocked += Math.max(0,zeroRemnantExiles.length-localHistoryCount);
      if(zeroRemnantExiles.length) this.observeLocal("cities",[city.id]);
      const population=localHistoryCount>0 ? assessLocalRestorationPopulation(city) : undefined;
      if(population) {
        local.populationScans++; local.nearbyNormal+=population.nearbyNormal;local.identityInArea+=population.identityBlocked;
        local.outsideArea+=population.outsideArea;local.invalidUnit+=population.invalidUnit;
        this.observeLocal("users",population.observedUnitIds);
      }
      const warTornPath = city.loyalty > REBELLION_LOYALTY_THRESHOLD;
      if (warTornPath && (city.loyalty >= 40 || city.devastation < 70)) {
        local.cityBlocked += localHistoryCount; this.restorationBlock("忠诚度高于叛乱门槛且无战乱旧地机会"); continue;
      }
      const ownerStability = getFactionStability(owner) ?? 100;
      // High-loyalty cities never enter the original revolt/new-rebel path.
      const warEvidence = warTornPath && city.loyalty < 40 && city.devastation >= 70
        ? getWarTornCityEvidence(city, year, ownerStability) : undefined;
      if (warTornPath && !warEvidence?.eligible) {
        local.cityBlocked += localHistoryCount; this.restorationBlock("忠诚度高于叛乱门槛且无战乱旧地机会"); continue;
      }
      if (warTornPath) diagnostics.warTornCityChecks++; else diagnostics.lowLoyaltyCityChecks++;
      const cityBlocks: string[] = [];
      if (city.isInCaptureGrace(year)) cityBlocks.push("占领保护期");
      const lastRebellionYear = this.cityRebellionYears[city.id];
      if (lastRebellionYear !== undefined && year - lastRebellionYear < REBELLION_CITY_COOLDOWN_MONTHS) cityBlocks.push("城市叛乱冷却");
      if (cityBlocks.length) { local.cityBlocked += localHistoryCount; this.restorationBlocks(cityBlocks); continue; }

      const historical: Array<{ team: Team; basis: RestorationBasis; heldMonths: number; chance: number; legacyChance?:number; legacyAvailable?:boolean; supporter?: User }> = [];
      let localUsers: User[] | undefined;
      if (exiled.length) {
        if (!rules) this.restorationBlock("城市历史不足或矛盾");
        for (const rule of rules ?? []) {
          const team = teamsById.get(rule.factionId);
          if (!team || team === owner || (!warTornPath && team === founder && (WorldRemnants.get(team.name)?.population ?? 0) > 0) || team.status !== "EXILED") continue;
          const basis = getHistoricalRestorationBasis(rule);
          if (!basis) { this.restorationBlock("历史统治不足期限"); continue; }
          if (basis === "FORMER_CAPITAL") diagnostics.formerCapitalCandidates++; else diagnostics.longRuleCandidates++;
          diagnostics.historicalCandidates++;
          const exile = WorldExiles.get(team.name);
          const noRemnants = (WorldRemnants.get(team.name)?.population ?? 0) <= 0;
          const blocks: string[] = [];
          if (!exile || exile.legitimacy <= 0) { blocks.push("流亡合法性不足"); if (noRemnants) local.legitimacyBlocked++; }
          if (!DynastyRegistry.hasClaimantAtMonth(team.name, year)) { blocks.push("无合法继统者"); if (noRemnants) local.claimantBlocked++; }
          if (team.terminationReason || !exile) blocks.push("流亡政治资格不足");
          let supporter: User | undefined;
          if (noRemnants) {
            localUsers ??= (population ?? assessLocalRestorationPopulation(city)).users;
            local.populationCandidates += localUsers.length;
            supporter = localUsers[0];
            if (!supporter) { blocks.push("残部耗尽", "无真实旧地响应User"); local.noUser++; }
            if (!getLocalRestorationClaimant(team, year) && !blocks.length) { blocks.push("旧王统身份不足"); local.identityBlocked++; }
          }
          if (blocks.length) { this.restorationBlocks(blocks); continue; }
          if (!noRemnants && !FactionRegistry.canRestoreFaction(team, year)) { this.restorationBlock("政治恢复资格不足"); continue; }
          if (supporter) local.eligible++;
          if (warTornPath) diagnostics.warTornEligible++;
          historical.push({ team, basis, heldMonths: rule.heldMonths, chance: 0, legacyAvailable:!supporter || (population?.legacyEligible ?? 0)>0, ...(supporter ? { supporter } : {}) });
          diagnostics.eligibleChecks++;
          if (basis === "FORMER_CAPITAL") diagnostics.capitalEligible++; else diagnostics.longRuleEligible++;
        }
      }
      const originalPath = !warTornPath && Boolean(founder && city.ownerFactionId !== city.founderFactionId) && !historical.some(row => row.team === founder && row.supporter);
      if (!originalPath && !historical.length) continue;
      const loyaltyPressure = warTornPath ? 0 :
        (REBELLION_LOYALTY_THRESHOLD - city.loyalty) /
        REBELLION_LOYALTY_THRESHOLD;
      const instabilityBonus = (100 - ownerStability) / 100;
      const exileLegitimacy =
        founder?.status === "EXILED"
          ? (WorldExiles.get(founder.name)?.legitimacy ?? 0) / 100
          : 1;
      const restorationWeight =
        founder?.status === "EXILED"
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
      if (originalPath && founder?.status === "EXILED") {
        diagnostics.founderCandidates++;
        if (FactionRegistry.canRestoreFaction(founder, year)) { diagnostics.eligibleChecks++; diagnostics.founderEligible++; }
        else {
          const blocks: string[] = [];
          if ((WorldRemnants.get(founder.name)?.population ?? 0) <= 0) blocks.push("残部耗尽");
          if ((WorldExiles.get(founder.name)?.legitimacy ?? 100) <= 0) blocks.push("流亡合法性不足");
          if (!DynastyRegistry.hasClaimantAtMonth(founder.name, year)) blocks.push("无合法继统者");
          this.restorationBlocks(blocks.length ? blocks : ["建城者残部或继统资格不足"]);
        }
      }
      for (const row of historical) {
        const exile = WorldExiles.get(row.team.name)!;
        const base = REBELLION_BASE_CHANCE * loyaltyPressure * (1 + instabilityBonus) * (exile.legitimacy / 100) *
          getRestorationWeightMultiplier(row.team.sovereigntyRank) * FactionEffects.getRebellionRiskMultiplier(owner.name) * cycleMultiplier;
        row.chance = warTornPath ? warTornRestorationChance({ loyalty: city.loyalty, devastation: city.devastation,
          ownerStability, recentTransfers: warEvidence!.recentTransfers, basis: row.basis, heldMonths: row.heldMonths,
          legitimacy: exile.legitimacy, exileMonths: year - exile.startedMonth }) :
          historicalRestorationChance(base, row.basis, row.heldMonths, year - exile.startedMonth);
        row.legacyChance=row.chance;
        if(row.supporter) row.chance=localResidentRestorationChance({legacyChance:row.chance,loyalty:city.loyalty,
          devastation:city.devastation,ownerStability,recentTransfers:getWarTornCityEvidence(city,year,ownerStability).recentTransfers,
          legitimacy:exile.legitimacy,basis:row.basis,tenure:deriveRestorationTenureEvidence({team:row.team,
            dynasty:DynastyRegistry.get(row.team.name),events:WorldHistory.getEventsForFaction(row.team.name),worldMonth:year})});
      }
      const slots = [
        ...(originalPath ? [{chance,legacyChance:chance,local:false,restoration:founder?.status==="EXILED" && FactionRegistry.canRestoreFaction(founder,year),value:{historical:undefined as typeof historical[number]|undefined}}] : []),
        ...historical.map(row=>({chance:row.chance,legacyChance:row.legacyAvailable ? row.legacyChance! : 0,local:Boolean(row.supporter),restoration:true,value:{historical:row as typeof historical[number]|undefined}})),
      ];
      const riskDistribution=getLocalResponseDrawDistribution(slots,warTornPath?.03:.09);
      const expectedRestoration=riskDistribution.probabilities.reduce((sum,p,i)=>sum+(slots[i].restoration?p:0),0);
      if(historical.some(row=>row.supporter)) {
        local.draws++;
        local.expected+=riskDistribution.probabilities.reduce((sum,p,i)=>sum+(slots[i].local?p:0),0);
      }
      diagnostics.draws++;
      if (expectedRestoration > 0) diagnostics.restorationDraws++;
      diagnostics.expectedRestorations += expectedRestoration;
      const draw = worldRandom.next();
      const opportunitySamples=new Map<typeof historical[number],LocalOpportunitySample>();
      for(const row of historical) if(row.supporter) {
        const sample:LocalOpportunitySample={factionId:row.team.name,cityId:city.id,cityName:city.name,ownerId:owner.name,worldMonth:year,
          supporters:localUsers?.length ?? 0,basis:row.basis,crisis:warTornPath?"战乱旧地":"低忠诚危机",legacyChance:row.legacyChance!,finalChance:row.chance,
          actualChance:riskDistribution.probabilities[slots.findIndex(slot=>slot.value.historical===row)],result:"未命中该旧国"};
        opportunitySamples.set(row,sample);local.recentOpportunities.push(sample);
        if(local.recentOpportunities.length>3) local.recentOpportunities.shift();
      }
      if (historical.length) {
        const selected = selectLocalResponseOpportunity(slots,draw,warTornPath?.03:.09);
        if (!selected) continue;
        const row = selected.historical;
        if (row) {
          diagnostics.attempts++;
          if (row.supporter) {
            local.drawHits++;
            const sample=opportunitySamples.get(row)!; sample.result="抽签命中，执行中";
            const result = FactionRegistry.restoreThroughLocalSupport(row.team, city, year, row.supporter);
            if (result === "RESTORED") {
              sample.result="人口转属与复国成功";
              local.successes++; diagnostics.successes++;
              if (warTornPath) diagnostics.warTornSuccesses++;
              if (row.basis === "FORMER_CAPITAL") diagnostics.capitalSuccesses++; else diagnostics.longRuleSuccesses++;
              this.cityRebellionYears[city.id] = year; return;
            }
            sample.result=result==="TRANSFER_FAILED"?"人口转属失败":"执行资格失效";
            if (result === "TRANSFER_FAILED") local.transferFailures++; else local.executionFailures++;
            diagnostics.failures++; this.restorationBlock("旧地响应执行未成功"); continue;
          }
          const population = WorldRemnants.get(row.team.name)?.population ?? 0;
          if (FactionRegistry.restoreFaction(row.team, city, year, population, "RESTORATION", { basis: row.basis, heldMonths: row.heldMonths, ...(warTornPath ? { trigger: "WAR_TORN_HISTORICAL_CITY" as const } : {}) }, year)) {
            WorldRemnants.consume(row.team.name, population);
            diagnostics.successes++;
            if (warTornPath) diagnostics.warTornSuccesses++;
            if (row.basis === "FORMER_CAPITAL") diagnostics.capitalSuccesses++; else diagnostics.longRuleSuccesses++;
            this.cityRebellionYears[city.id] = year; return;
          }
          diagnostics.failures++; this.restorationBlock("执行未成功"); continue;
        }
        // The selected legacy slot retains its original execution chain and random draw.
      } else if (draw > chance) continue;
      if (warTornPath || !founder) continue;

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
        FactionRegistry.canRestoreFaction(founder, year);
      if (canRestoreFounder) {
        const restoredPopulation = remnants?.population ?? 0;
        diagnostics.attempts++;
        if (FactionRegistry.restoreFaction(founder, city, year, restoredPopulation, "RESTORATION", undefined, year)) {
          WorldRemnants.consume(founder.name, restoredPopulation);
          diagnostics.successes++; diagnostics.founderSuccesses++;
          this.cityRebellionYears[city.id] = year;
          return;
        }
        diagnostics.failures++; this.restorationBlock("建城者恢复执行未成功");
      }

      if (
        teams.filter((team) => !team.isDie).length < MAX_ACTIVE_FACTIONS &&
        ownerStability <= REBEL_OWNER_STABILITY_THRESHOLD_V095 &&
        city.loyalty <= REBEL_LOYALTY_THRESHOLD_V095
      ) {
        const frontier = isFrontierCity(city) && worldRandom.next() <= FRONTIER_REBELLION_CHANCE;
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
          FactionRegistry.canRestoreFaction(founder, year),
          founder.status
        )
      ) {
        const remnants = WorldRemnants.get(founder.name);
        const restoredPopulation = remnants?.population ?? 0;
        if (FactionRegistry.restoreFaction(founder, coreCity, year, restoredPopulation, "RESTORATION", undefined, year)) {
          WorldRemnants.consume(founder.name, restoredPopulation);
          this.fractureUntilMonth = year + 60;
          return;
        }
      }

      const splitCities = selectSplitCities(
        coreCity,
        team.cities,
        EMPIRE_SPLIT_MAX_CITIES,
        Game.BlockSize
      ) as City[];
      const split = FactionRegistry.createSplitFaction(team, splitCities, year);
      if (split) {
        const rebel = split.team;
        const transferredCities = split.transferredCities;
        WorldHistory.addEmpireSplit(
          year,
          team.name,
          rebel.name,
          transferredCities.map((city) => city.name),
          transferredCities.map((city) => city.id),
          DynastyRegistry.getRulerDisplay(rebel.name),
          DynastyRegistry.getCurrentRuler(rebel.name)?.id,
          `founding-${rebel.name}-${year}`,
          transferredCities[0]?.id,
          transferredCities[0]?.name
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
        FactionRegistry.foundCity(team, block, undefined, year);
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
    if (!FactionRegistry.canRestoreFaction(founder, year)) {
      return false;
    }
    const restoredPopulation = remnants.population;
    const restored = FactionRegistry.restoreFaction(
      founder,
      city,
      year,
      restoredPopulation,
      "GOD_ACTION",
      undefined,
      year
    );
    if (restored) {
      WorldRemnants.consume(founder.name, restoredPopulation);
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
    return events[worldRandom.pickIndex(events.length)];
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
    return FactionEffects.getAdministrativeStrainMultiplier(team.name);
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
    FactionEffects.clearAdministrativeStrainMultipliers();
    const unifiedFactionId = this.cycleState.currentUnificationStartMonth !== undefined
      ? this.unifyingFactionId
      : this.cycleState.dynasticOrderFactionId;
    if (unifiedFactionId) {
      FactionEffects.setAdministrativeStrainMultiplier(
        unifiedFactionId,
        getUnifiedImperialStrainMultiplier(this.cycleDiagnostics.unifiedAge)
      );
    }
    const factionId = this.cycleDiagnostics.hegemonicOwnerId ?? this.cycleDiagnostics.consolidationLeaderOwnerId;
    if (!factionId || this.cycleDiagnostics.hegemonicSiegeMultiplier <= 1) {
      return;
    }
    const base = getConsolidationImperialStrainMultiplier(this.cycleDiagnostics.consolidationModifier);
    const momentum = Math.max(this.cycleDiagnostics.hegemonicMomentum, this.cycleDiagnostics.consolidationLeaderMomentum);
    const reduction = Math.min(0.06, this.cycleDiagnostics.lateFragmentationPressure * 0.06 * momentum);
    if (!unifiedFactionId) {
      FactionEffects.setAdministrativeStrainMultiplier(factionId, Math.max(0.72, base - reduction));
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
    let roll = worldRandom.next() * totalWeight;
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
      worldRandom.int(
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
