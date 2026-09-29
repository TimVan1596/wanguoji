import type Team from "../Components/Team";
import { getFactionDisplayNameAtMonth, getSovereigntyRankAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate } from "../Simulation/WorldTime";
import type { Ruler } from "./Dynasty";
import { evaluateReignOutcome } from "./ReignOutcomeRules";
import { getRulerEffectiveSnapshot } from "./RulerChronicle";
import { buildRulerLegacyEvidence, type RulerLegacyEvidence } from "./RulerLegacyEvidence";

export interface PosthumousEvaluation {
  posthumousEpithet?: string;
  epithetReasons: string[];
  templeName?: string;
  templeReasons: string[];
  score: number;
  reasons: string[];
}

const LONG_REIGN_MONTHS = 18 * 12;
const VERY_LONG_REIGN_MONTHS = 28 * 12;
const RECENT_EPITHET_LOOKBACK = 8;

export function finalizeRulerPosthumousNames(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  faction: Team,
  monthIndex: number
) {
  if (ruler.endYear === undefined || ruler.accessionYear === undefined || !ruler.chronicle) {
    return;
  }
  const evaluation = evaluatePosthumousNames(ruler, dynastyRulers, faction, monthIndex);
  ruler.posthumousEpithet = evaluation.posthumousEpithet;
  ruler.posthumousEpithetReasons = evaluation.epithetReasons;
  ruler.templeName = evaluation.templeName;
  ruler.templeNameReasons = evaluation.templeReasons;
}

export function evaluatePosthumousNames(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  faction: Pick<Team, "displayName" | "name" | "nameHistory" | "identityStage" | "stateFoundedMonth" | "sovereigntyRank" | "sovereigntyHistory">,
  monthIndex: number
): PosthumousEvaluation {
  if (ruler.endYear === undefined || ruler.accessionYear === undefined || !ruler.chronicle) {
    return emptyEvaluation();
  }
  const rank = getSovereigntyRankAtMonth(faction, Math.min(ruler.endYear, monthIndex));
  if (rank === "LEADER") {
    return emptyEvaluation();
  }

  const chronicle = ruler.chronicle;
  const end = getRulerEffectiveSnapshot(chronicle);
  const reignMonths = Math.max(0, ruler.endYear - ruler.accessionYear);
  const territoryDelta = end.territoryShare - chronicle.accessionSnapshot.territoryShare;
  const cityDelta = end.cityCount - chronicle.accessionSnapshot.cityCount;
  const stabilityDelta = end.stability - chronicle.accessionSnapshot.stability;
  const evidence = buildRulerLegacyEvidence(chronicle, ruler.accessionYear, ruler.endYear, ruler.endReason);
  const outcome = evaluateReignOutcome(chronicle.accessionSnapshot, end);
  const tragicEnd = evidence.terminalCollapse || ruler.endReason === "被俘处死";
  const reasons: string[] = [];
  let score = 0;

  if (chronicle.foundedStateName) {
    score += 55;
    reasons.push("开国");
  }
  if (chronicle.proclaimedEmperorMonth !== undefined) {
    score += 55;
    reasons.push("称帝");
  }
  if (chronicle.completedUnification) {
    score += 45;
    reasons.push("一统");
  }
  if (chronicle.restorationsDuringReign > 0) {
    score += 36;
    reasons.push("复国");
  }
  if (evidence.majorExpansion) {
    score += 28;
    reasons.push("开疆");
  } else if (territoryDelta >= 0.08 || cityDelta >= 2) {
    score += 18;
    reasons.push("扩张");
  }
  if (evidence.personallyCapturedCities > 0) {
    score += Math.min(28, evidence.personallyCapturedCities * 7);
    reasons.push("亲征战功");
  }
  if (
    reignMonths >= VERY_LONG_REIGN_MONTHS &&
    end.stability >= 72 &&
    (outcome.outcome === "IMPROVEMENT" || outcome.outcome === "EXPANSION")
  ) {
    score += 16;
    reasons.push("长治");
  } else if (
    reignMonths >= LONG_REIGN_MONTHS &&
    end.stability >= 76 &&
    stabilityDelta >= 8
  ) {
    score += 8;
    reasons.push("稳定");
  }
  if (chronicle.deathCause === "战死" && (territoryDelta >= 0.08 || cityDelta >= 1)) {
    score += 10;
    reasons.push("烈终");
  }
  if (tragicEnd || evidence.stabilityDeterioration || evidence.territorialCollapse || evidence.cityCollapse) {
    score += 24;
    reasons.push("国难");
  }

  const hasSubstantiveFact = reasons.some((reason) => reason !== "长治" && reason !== "稳定");
  const epithetEvaluation =
    score >= 22 && hasSubstantiveFact
      ? chooseEpithet(ruler, dynastyRulers, evidence)
      : undefined;
  const templeEvaluation = isTempleNameEligible(evidence, rank)
    ? chooseTempleName(ruler, dynastyRulers, evidence, rank)
    : undefined;

  return {
    posthumousEpithet: epithetEvaluation?.name,
    epithetReasons: epithetEvaluation?.reasons ?? [],
    templeName: templeEvaluation?.name,
    templeReasons: templeEvaluation?.reasons ?? [],
    score,
    reasons,
  };
}

export function formatPosthumousRulerName(
  ruler: Ruler,
  faction: Pick<Team, "displayName" | "name" | "nameHistory" | "identityStage" | "stateFoundedMonth" | "sovereigntyRank" | "sovereigntyHistory">,
  monthIndex: number
) {
  const personalName = `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  const polityName = getFactionDisplayNameAtMonth(faction, monthIndex);
  const rank = getSovereigntyRankAtMonth(faction, monthIndex);
  const epithetSuffix = rank === "EMPEROR" ? "帝" : "王";
  const parts: string[] = [];
  if (ruler.templeName) {
    parts.push(`${polityName}${ruler.templeName}`);
  }
  if (ruler.posthumousEpithet) {
    parts.push(`${ruler.posthumousEpithet}${epithetSuffix}`);
  }
  parts.push(personalName);
  return parts.join(" · ");
}

export function getPosthumousLabelLines(
  ruler: Ruler,
  faction: Pick<Team, "displayName" | "name" | "nameHistory" | "identityStage" | "stateFoundedMonth" | "sovereigntyRank" | "sovereigntyHistory">,
  monthIndex: number
) {
  if (!ruler.templeName && !ruler.posthumousEpithet) {
    return [];
  }
  return [
    ruler.templeName
      ? `庙号：${ruler.templeName}${formatReasonSuffix(ruler.templeNameReasons)}`
      : undefined,
    ruler.posthumousEpithet
      ? `谥号：${ruler.posthumousEpithet}${formatReasonSuffix(ruler.posthumousEpithetReasons)}`
      : undefined,
    `史称：${formatPosthumousRulerName(ruler, faction, monthIndex)}`,
  ].filter(Boolean) as string[];
}

export function getNotablePosthumousRulers(
  rulers: Ruler[],
  faction: Pick<Team, "displayName" | "name" | "nameHistory" | "identityStage" | "stateFoundedMonth" | "sovereigntyRank" | "sovereigntyHistory">,
  limit = 6
) {
  return rulers
    .filter((ruler) => ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet))
    .map((ruler) => ({
      ruler,
      displayName: formatPosthumousRulerName(ruler, faction, ruler.endYear ?? 0),
      start: ruler.accessionYear !== undefined ? formatWorldDate(ruler.accessionYear) : "—",
      end: ruler.endYear !== undefined ? formatWorldDate(ruler.endYear) : "—",
    }))
    .slice(-limit)
    .reverse();
}

interface NameCandidate {
  name: string;
  reasons: string[];
  score?: number;
}

export function isTempleNameEligible(evidence: RulerLegacyEvidence, historicalRank: "LEADER" | "KING" | "EMPEROR") {
  if (evidence.foundedState || evidence.proclaimedEmperor || evidence.completedUnification) return true;
  if (evidence.restoration && (evidence.majorExpansion || evidence.longStableReign || evidence.stableGovernance)) return true;
  if (historicalRank === "EMPEROR" && evidence.reignMonths >= LONG_REIGN_MONTHS && (evidence.majorExpansion || evidence.longStableReign || evidence.institutionalAchievement)) return true;
  return historicalRank === "KING" && evidence.reignMonths >= VERY_LONG_REIGN_MONTHS && evidence.territoryDelta >= 0.28 && evidence.cityDelta >= 5 && (evidence.stableGovernance || evidence.militaryAchievement);
}

function chooseEpithet(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  evidence: RulerLegacyEvidence
) {
  const chronicle = ruler.chronicle;
  if (!chronicle) {
    return undefined;
  }
  const candidates: NameCandidate[] = [];
  const add = (name: string, score: number, reason: string) => addScoredCandidate(candidates, name, score, reason);
  const terminalCrisis = evidence.terminalCollapse || ruler.endReason === "被俘处死";
  if (terminalCrisis) add("愍", 92, evidence.exileOrExtinction ? "国祚终结或王室流亡" : "遭遇被俘处死的国难");
  if (evidence.reignMonths <= 4 * 12 && terminalCrisis) add("哀", 78, "短祚并遭遇严重国难");

  if (evidence.majorExpansion) {
    add("襄", 58, evidence.territoryDelta >= 0.12 ? "疆域显著拓展" : "治下城市显著增加");
    if (evidence.militaryAchievement) add("武", 34, "有亲征夺城或统一战功");
  } else if (evidence.territoryDelta >= 0.08 || evidence.cityDelta >= 2) {
    add("襄", 36, "国势有所扩张");
  }
  if (chronicle.citiesCapturedPersonally >= 2) add("武", 38 + Math.min(18, chronicle.citiesCapturedPersonally * 4), "亲征夺城有据");
  if (chronicle.citiesCapturedPersonally >= 4) add("烈", 38, "亲征战功显著");
  if (chronicle.deathCause === "战死" && evidence.militaryAchievement) add("烈", 48, "有战功而战死");
  if (evidence.institutionalAchievement) add("昭", 36, chronicle.completedUnification ? "完成一统并改变天下格局" : "建立或提升国家制度格局");
  if (evidence.foundedState) add("成", 34, "正式建国，建立国家秩序");
  if (evidence.restoration) {
    add("宣", 62, "复国并恢复政权延续");
    add("成", 38, "完成复国，重建王朝");
  }
  if (evidence.completedUnification) add("武", 34, "完成大规模征服并一统天下");
  if (evidence.stableGovernance) add("景", 38, "稳定度提升且在位末仍维持高位");
  if (evidence.longStableReign) {
    add("康", 40, "长期执政且治理稳定");
    add("穆", 34, "长期平稳守成");
  }
  if (evidence.stabilityDeterioration && evidence.reignMonths >= LONG_REIGN_MONTHS && (evidence.territorialCollapse || evidence.cityCollapse || evidence.majorDisorder || evidence.terminalCollapse)) {
    add("灵", 66 + (evidence.majorDisorder ? 8 : 0) + (evidence.demographicCollapse ? 6 : 0), "长期稳定恶化，并有疆土、城市、内乱或终局失序证据");
  }
  if (evidence.territorialCollapse || evidence.cityCollapse) add("愍", 32, "任内疆土或城市严重丧失");
  if (evidence.territorialCollapse && evidence.cityCollapse && evidence.stabilityDeterioration) add("哀", 42, "疆土、城市与稳定均显著衰退");
  if (evidence.reignMonths >= VERY_LONG_REIGN_MONTHS && evidence.stableGovernance && evidence.majorExpansion) add("景", 42, "长期统治兼有扩张与稳定治理");
  if (chronicle.rebellionsDuringReign > 0 && evidence.stableGovernance) add("定", 30, "任内有内乱记录，末期稳定度仍保持高位");

  return pickSoftUniqueEpithet(uniqueCandidates(candidates), dynastyRulers, ruler.id);
}

function chooseTempleName(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  evidence: RulerLegacyEvidence,
  historicalRank: "LEADER" | "KING" | "EMPEROR"
) {
  const chronicle = ruler.chronicle;
  if (!chronicle) {
    return undefined;
  }
  const candidates: NameCandidate[] = [];
  const add = (name: string, score: number, reason: string) => addScoredCandidate(candidates, name, score, reason);
  if (evidence.foundedState) {
    add("太祖", 100, chronicle.proclaimedEmperorMonth !== undefined ? "开国并建立帝号，奠定王朝基业" : "开国建制，奠定王朝基业");
    add("高祖", 92, "开创国家并建立统治根基");
  }
  if (evidence.proclaimedEmperor && !evidence.foundedState) {
    add("世祖", 92, "建立帝号，开创新的帝制格局");
    add("高祖", 78, "首次建立帝号并奠定帝统");
  }
  if (evidence.restoration) {
    add("世祖", 100, "复国并重新奠定王朝秩序");
    add("中宗", 88, "王朝中断后恢复政权延续");
    add("世宗", 72, "复国后推动恢复与扩张");
    if (evidence.proclaimedEmperor && evidence.territoryDelta >= 0.3 && evidence.cityDelta >= 5 && ruler.reignOrdinal !== undefined && ruler.reignOrdinal > 1) {
      add("成祖", 220, "复国后完成第二次创业级的帝制重建与扩张");
    }
  }
  if (evidence.completedUnification) {
    add(ruler.reignOrdinal === 2 ? "太宗" : "世宗", 96, "承继基业并完成天下一统");
    add("高宗", 74, "完成统一并巩固帝国秩序");
  }
  if (historicalRank === "EMPEROR" && ruler.reignOrdinal === 2 && (evidence.majorExpansion || evidence.completedUnification)) {
    add("太宗", 96, "承继开创者并大幅巩固扩张");
    add("高宗", 72, "承继基业并取得显著功业");
    add("世宗", 68, "早期王朝扩张与巩固");
  }
  if (historicalRank === "EMPEROR" && evidence.reignMonths >= VERY_LONG_REIGN_MONTHS && (evidence.majorExpansion || evidence.longStableReign)) {
    add("高宗", 94, "成熟王朝长期强盛并有持续功业");
    add("成宗", 84, "长期巩固秩序并维持稳定治理");
    add("世宗", 78, "推动王朝中期恢复与扩张");
  }
  if (historicalRank === "EMPEROR" && evidence.militaryAchievement && ruler.reignOrdinal !== 1 && chronicle.citiesCapturedPersonally >= 4) {
    add("武宗", 86, "个人亲征与军事征服特征突出");
  }
  if (historicalRank === "EMPEROR" && evidence.stableGovernance && evidence.majorExpansion) {
    add("景宗", 70, "兼有国势改善与稳定治理");
    add("宣宗", 68, "治理恢复并延续国家秩序");
  }
  if (historicalRank === "KING" && evidence.territoryDelta >= 0.28 && evidence.cityDelta >= 5) {
    add("太宗", 62, "以显著扩张与秩序巩固建立重要王朝角色");
    add("世宗", 54, "长期拓展并巩固国家秩序");
  }
  const used = new Set(
    dynastyRulers
      .filter((item) => item.id !== ruler.id)
      .map((item) => item.templeName)
      .filter(Boolean) as string[]
  );
  return uniqueCandidates(candidates)
    .filter((candidate) => !used.has(candidate.name))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

function pickSoftUniqueEpithet(
  candidates: NameCandidate[],
  dynastyRulers: Ruler[],
  rulerId: string
) {
  if (candidates.length === 0) {
    return undefined;
  }
  const recent = dynastyRulers
    .filter((item) => item.id !== rulerId && item.posthumousEpithet)
    .slice(-RECENT_EPITHET_LOOKBACK)
    .map((item) => item.posthumousEpithet);
  const recentSet = new Set(recent);
  return [...candidates].sort((a, b) => {
    const scoreA = (a.score ?? 0) - (recentSet.has(a.name) ? 6 : 0);
    const scoreB = (b.score ?? 0) - (recentSet.has(b.name) ? 6 : 0);
    return scoreB - scoreA;
  })[0];
}

function addScoredCandidate(candidates: NameCandidate[], name: string, score: number, reason: string) {
  candidates.push({ name, score, reasons: [reason] });
}

function uniqueCandidates(values: NameCandidate[]) {
  const merged = new Map<string, NameCandidate>();
  values.forEach((value) => {
    const existing = merged.get(value.name);
    if (existing) {
      existing.reasons.push(...value.reasons);
      existing.score = (existing.score ?? 0) + (value.score ?? 0);
    } else {
      merged.set(value.name, { ...value, reasons: [...value.reasons] });
    }
  });
  return [...merged.values()].map((value) => ({ ...value, reasons: [...new Set(value.reasons)] }));
}

function formatReasonSuffix(reasons?: string[]) {
  const reason = reasons?.[0];
  return reason ? `（${reason}）` : "";
}

function emptyEvaluation(): PosthumousEvaluation {
  return {
    score: 0,
    reasons: [],
    epithetReasons: [],
    templeReasons: [],
  };
}
