import type Team from "../Components/Team";
import { getFactionDisplayNameAtMonth, getSovereigntyRankAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate } from "../Simulation/WorldTime";
import type { Ruler } from "./Dynasty";
import { evaluateReignOutcome } from "./ReignOutcomeRules";

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
  const rank = getSovereigntyRankAtMonth(faction, Math.max(ruler.accessionYear, monthIndex));
  if (rank === "LEADER") {
    return emptyEvaluation();
  }

  const chronicle = ruler.chronicle;
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
  const reignMonths = Math.max(0, ruler.endYear - ruler.accessionYear);
  const territoryDelta = end.territoryShare - chronicle.accessionSnapshot.territoryShare;
  const cityDelta = end.cityCount - chronicle.accessionSnapshot.cityCount;
  const stabilityDelta = end.stability - chronicle.accessionSnapshot.stability;
  const outcome = evaluateReignOutcome(chronicle.accessionSnapshot, end);
  const tragicEnd =
    ruler.endReason === "被俘处死" ||
    chronicle.deathCause === "被俘处死" ||
    ruler.endReason === "彻底灭亡";
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
  if (territoryDelta >= 0.18 || cityDelta >= 3) {
    score += 28;
    reasons.push("开疆");
  } else if (territoryDelta >= 0.1 || cityDelta >= 2) {
    score += 18;
    reasons.push("扩张");
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
  if (tragicEnd || stabilityDelta <= -30 || territoryDelta <= -0.12 || cityDelta <= -2) {
    score += 24;
    reasons.push("国难");
  }

  const hasSubstantiveFact = reasons.some((reason) => reason !== "长治" && reason !== "稳定");
  const epithetEvaluation =
    score >= 22 && hasSubstantiveFact
      ? chooseEpithet(ruler, dynastyRulers, territoryDelta, cityDelta, reignMonths)
      : undefined;
  const templeEvaluation =
    score >= 70
      ? chooseTempleName(ruler, dynastyRulers, territoryDelta, cityDelta, reignMonths)
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
}

function chooseEpithet(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  territoryDelta: number,
  cityDelta: number,
  reignMonths: number
) {
  const chronicle = ruler.chronicle;
  if (!chronicle) {
    return undefined;
  }
  const candidates: NameCandidate[] = [];
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
  const stabilityDelta = end.stability - chronicle.accessionSnapshot.stability;
  const tragicEnd =
    ruler.endReason === "被俘处死" ||
    chronicle.deathCause === "被俘处死" ||
    ruler.endReason === "彻底灭亡";
  if (tragicEnd) {
    candidates.push({
      name: "愍",
      reasons: ["在王朝危局中遭遇悲剧性结局"],
    });
  }
  if (
    reignMonths <= 4 * 12 &&
    (territoryDelta <= -0.12 || cityDelta <= -2 || tragicEnd)
  ) {
    candidates.push({
      name: "哀",
      reasons: ["短祚并遭遇严重国难"],
    });
  }
  const hasDisorderEvidence =
    territoryDelta <= -0.12 ||
    cityDelta <= -2 ||
    chronicle.rebellionsDuringReign > 0 ||
    end.population <= chronicle.accessionSnapshot.population * 0.6 ||
    ruler.endReason === "彻底灭亡";
  if (reignMonths >= LONG_REIGN_MONTHS && stabilityDelta <= -25 && hasDisorderEvidence) {
    candidates.push({
      name: "灵",
      reasons: ["长期稳定恶化，并有明显失序证据"],
    });
  }
  if (chronicle.proclaimedEmperorMonth !== undefined || chronicle.completedUnification) {
    addCandidates(
      candidates,
      territoryDelta >= 0.12 || cityDelta >= 2
        ? ["武", "昭", "宣", "明"]
        : ["昭", "明", "文"],
      chronicle.proclaimedEmperorMonth !== undefined
        ? "建立帝号，提升王朝格局"
        : "完成一统，奠定天下秩序"
    );
  }
  if (chronicle.foundedStateName) {
    addCandidates(
      candidates,
      territoryDelta >= 0.08 || cityDelta >= 1
        ? ["武", "昭", "烈", "成"]
        : ["昭", "成", "文"],
      "正式建国，奠定政权基业"
    );
  }
  if (chronicle.deathCause === "战死" && (territoryDelta >= 0.08 || cityDelta >= 1)) {
    addCandidates(candidates, ["烈", "武", "襄", "威"], "亲历战事并以身殉国");
  }
  if (
    chronicle.deathCause === "战死" &&
    chronicle.citiesCapturedPersonally >= 2 &&
    (territoryDelta >= 0.03 || cityDelta >= 1)
  ) {
    addCandidates(candidates, ["庄"], "亲征有战果并战死");
  }
  if (chronicle.restorationsDuringReign > 0) {
    addCandidates(
      candidates,
      territoryDelta >= 0.08 || cityDelta >= 1
        ? ["宣", "成", "康", "昭"]
        : ["成", "康", "简"],
      "完成复国，重建王朝"
    );
  }
  if (territoryDelta >= 0.16 || cityDelta >= 3) {
    addCandidates(candidates, ["武", "襄", "烈", "威"], "在位期间显著扩张疆域");
  }
  const outcome = evaluateReignOutcome(chronicle.accessionSnapshot, end);
  if (
    reignMonths >= VERY_LONG_REIGN_MONTHS &&
    chronicle.endSnapshot?.stability !== undefined &&
    (outcome.outcome === "IMPROVEMENT" || outcome.outcome === "EXPANSION")
  ) {
    addCandidates(
      candidates,
      chronicle.endSnapshot.stability >= 75
        ? ["文", "康", "穆", "定"]
        : ["景", "穆", "惠", "定"],
      "长期统治且国势保持向上"
    );
  }
  if (territoryDelta >= 0.1 || cityDelta >= 2) {
    addCandidates(candidates, ["明", "襄", "宣", "武"], "国势有所扩张");
  }
  if (
    reignMonths >= LONG_REIGN_MONTHS &&
    end.stability >= 78 &&
    Math.abs(territoryDelta) < 0.04 &&
    cityDelta === 0
  ) {
    addCandidates(candidates, ["穆", "惠", "康", "简", "定"], "长期稳定守成");
  }
  return pickSoftUniqueEpithet(uniqueCandidates(candidates), dynastyRulers, ruler.id);
}

function chooseTempleName(
  ruler: Ruler,
  dynastyRulers: Ruler[],
  territoryDelta: number,
  cityDelta: number,
  reignMonths: number
) {
  const chronicle = ruler.chronicle;
  if (!chronicle) {
    return undefined;
  }
  const candidates: NameCandidate[] = [];
  if (chronicle.foundedStateName && chronicle.proclaimedEmperorMonth !== undefined) {
    addCandidates(candidates, ["太祖", "高祖"], "开国并建立帝号");
  } else if (chronicle.foundedStateName) {
    addCandidates(candidates, ["太祖", "高祖"], "正式建国，奠定基业");
  } else if (chronicle.proclaimedEmperorMonth !== undefined) {
    addCandidates(candidates, ["高祖", "太祖"], "首次建立帝号");
  }
  if (chronicle.restorationsDuringReign > 0) {
    addCandidates(candidates, ["世祖", "世宗"], "完成复国，重建王朝");
  }
  if (chronicle.completedUnification || territoryDelta >= 0.22 || cityDelta >= 4) {
    addCandidates(candidates, ["太宗"], "承继基业并大幅扩张");
  }
  if (reignMonths >= VERY_LONG_REIGN_MONTHS && (territoryDelta >= 0.08 || cityDelta >= 2)) {
    addCandidates(candidates, ["世宗"], "长治久安并推动中兴");
  }
  const used = new Set(
    dynastyRulers
      .filter((item) => item.id !== ruler.id)
      .map((item) => item.templeName)
      .filter(Boolean) as string[]
  );
  return uniqueCandidates(candidates).find((candidate) => !used.has(candidate.name));
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
  return candidates.find((candidate) => !recentSet.has(candidate.name)) ?? candidates[0];
}

function addCandidates(candidates: NameCandidate[], names: string[], reason: string) {
  names.forEach((name) => candidates.push({ name, reasons: [reason] }));
}

function uniqueCandidates(values: NameCandidate[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.name)) {
      return false;
    }
    seen.add(value.name);
    return true;
  });
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
