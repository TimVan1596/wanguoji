import type { RulerReignTrajectory } from "../../../Politics/RulerReignTrajectory";
import { summarizeRulerPoliticalFacts } from "../../../Politics/RulerPoliticalFacts";
import type { Ruler } from "../../../Politics/Dynasty";
import { hasRecordedRulerDeath } from "../../../Politics/RulerLifeState";
import type { DynastyHouseEpoch } from "../../../Politics/DynasticRevolution";
import type { RulerChronicle } from "../../../Politics/RulerChronicle";
import type { RulerPoliticalFact } from "../../../Politics/RulerHistoriography";
import { formatWorldDate } from "../../../Simulation/WorldTime";

const reasonLabels: Record<DynastyHouseEpoch["startReason"], string> = {
  FOUNDING: "开创", NATURAL_HOUSE_SUCCESSION: "易姓续统", USURPATION: "篡朝", RESTORATION: "复国",
};
/** EXILED is still politically continuous; all terminal reasons use EXTINCT status. */
export function getHouseEpochHeading(status: string) {
  return status === "EXTINCT" ? "末代王统" : "当前王统";
}
export function getHouseEpochPresentation(epochs: readonly DynastyHouseEpoch[]) {
  const latest = epochs.at(-1);
  return { current: latest ? { key: latest.foundingRulerId,
    text: `${latest.houseName} · ${formatWorldDate(latest.startMonth)}起 · ${reasonLabels[latest.startReason]}` } : undefined,
    historical: epochs.slice(0, -1).reverse().map(epoch => ({ key: epoch.foundingRulerId,
      text: `${epoch.houseName} · ${formatWorldDate(epoch.startMonth)}～${epoch.endMonth === undefined ? "今" : formatWorldDate(epoch.endMonth)} · ${reasonLabels[epoch.startReason]}` })) };
}
export function getSignificantReignStats(chronicle: Pick<RulerChronicle,
  "citiesCapturedPersonally" | "citiesLostDuringReign" | "rebellionsDuringReign" | "restorationsDuringReign">,
  politicalFacts: RulerPoliticalFact[] = []) {
  const stats: Array<[string, number]> = [["亲征夺城", chronicle.citiesCapturedPersonally],
    ["失城", chronicle.citiesLostDuringReign], ["内乱", chronicle.rebellionsDuringReign], ["复国", chronicle.restorationsDuringReign]];
  const count = (predicate: (fact: RulerPoliticalFact) => boolean) =>
    new Set(politicalFacts.filter(predicate).map((fact) => fact.historyGroupId ?? fact.eventId)).size;
  const summary = summarizeRulerPoliticalFacts(politicalFacts);
  stats.push(["治下攻陷普通城市", summary.nationalCityCaptures], ["治下攻陷当时敌都", summary.nationalCapitalCaptures],
    ["本人亲征攻陷敌都", summary.personalCapitalCaptures], ["治下政权彻底灭亡", summary.nationalExtinctions],
    ["本人直接参与灭国", summary.personalExtinctions], ["本国失都", summary.capitalLosses],
    ["失国", summary.stateLosses], ["国难过程（按历史组）", summary.crisisEpisodes],
    ["任内国家签约（无本人签署证据）", summary.nationalDiplomacy], ["外交关系续约", summary.renewals]);
  stats[0][1] = Math.max(stats[0][1], summary.personalCityCaptures);
  stats[3][1] = Math.max(stats[3][1], summary.restorations);
  stats.push(["本人签署外交协议", count((fact) => fact.role === "DIRECT_ACTOR" &&
    ["truce-signed", "non-aggression-signed", "alliance-signed"].includes(fact.type))]);
  stats.push(["国家正式政治终结", count(f => f.terminalOutcome === "EXTINCT" && f.militaryRole === "DEFENDER")],
    ["遭宗室废立", count(f => f.depositionRole === "DEPOSED_RULER")], ["宗室废立夺位", count(f => f.depositionRole === "DEPOSING_SUCCESSOR")]);
  stats.push(["任内重大分裂", count((fact) => fact.type === "empire-split")]);
  stats.push(["被迫迁都", count((fact) => fact.type === "capital-relocated")]);
  stats.push(["本人篡朝开统", count((fact) => fact.type === "dynasty-usurped" && fact.role === "DIRECT_ACTOR")]);
  stats.push(["继承候选先逝", count((fact) => fact.type === "heir-died")]);
  return stats.filter(([, value]) => value > 0).map(([label, value]) => `${label}：${value}`).join(" · ") || "暂无显著在位统计";
}

/** endYear ends a reign; V13 dead status requires an actual recorded death. */
export function formatRulerAge(status: string, age: number) {
  return `${status === "dead" ? "享年" : status === "abdicated" ? "退位时" : status === "deposed" ? "废位时" : status === "politically-ended" ? "政治任期终结时" : "当前年龄"}${age}岁`;
}

export function rulerPortraitAge(ruler: Pick<Ruler,"status"|"bornYear"|"deathMonth"|"deathReason"> & Partial<Pick<Ruler,"naturalDeathYear"|"residentIdentity"|"militaryIdentity">>, worldMonth:number, managedRoyalOffice=true) {
  if(hasRecordedRulerDeath(ruler))return Math.max(0,Math.floor((Math.min(worldMonth,ruler.deathMonth!)-ruler.bornYear)/12));
  const living=managedRoyalOffice&&["ruling","exiled","heir","kin"].includes(ruler.status)||
    (ruler.status==="deposed"||Boolean(ruler.residentIdentity||ruler.militaryIdentity))&&ruler.naturalDeathYear!==undefined&&worldMonth<ruler.naturalDeathYear;
  return living?Math.max(0,Math.floor((worldMonth-ruler.bornYear)/12)):undefined;
}

/** A political end is not a death. Only a managed life or explicit runtime evidence permits current age. */
export function formatRulerLifeAge(ruler: Pick<Ruler, "status" | "bornYear" | "endYear" | "deathMonth" | "deathReason"> & Partial<Pick<Ruler,"naturalDeathYear"|"residentIdentity"|"militaryIdentity">>, worldMonth: number, verifiedLive = false, managedRoyalOffice = true) {
  if (hasRecordedRulerDeath(ruler)) return `享年${Math.max(0,Math.floor((ruler.deathMonth!-ruler.bornYear)/12))}岁`;
  const managed = managedRoyalOffice && ["ruling","exiled","heir","kin"].includes(ruler.status) ||
    (ruler.status === "deposed" || Boolean(ruler.residentIdentity||ruler.militaryIdentity)) && ruler.naturalDeathYear !== undefined && worldMonth < ruler.naturalDeathYear;
  if (ruler.status !== "dead" && (verifiedLive || managed)) return `当前年龄${Math.max(0,Math.floor((worldMonth-ruler.bornYear)/12))}岁`;
  if(ruler.endYear===undefined) return "生死未载 · 终结年龄未载";
  return formatRulerAge(ruler.status==="dead"?"politically-ended":ruler.status,Math.max(0,Math.floor((ruler.endYear-ruler.bornYear)/12))) + " · 生死未载";
}

export function formatRulerDepositionFact(fact: RulerPoliticalFact, ruler: Ruler, rulers: Ruler[]) {
  if (fact.type !== "ruler-deposed" || !fact.depositionRole || !fact.relatedRulerId || !fact.relatedRulerName || !fact.recordedKinRelation) return undefined;
  const other = rulers.find((candidate) => candidate.id === fact.relatedRulerId);
  if (!other) return undefined;
  const relation = fact.recordedKinRelation;
  const siblingRelation = ruler.bornYear < other.bornYear ? "弟" : ruler.bornYear > other.bornYear ? "兄" : "兄弟";
  if (fact.depositionRole === "DEPOSING_SUCCESSOR") {
    const target = relation === "DIRECT_CHILD" ? "父" : relation === "GRANDCHILD" ? "祖父" :
      relation === "SIBLING" ? siblingRelation : relation === "NEPHEW" ? "叔伯" :
      relation === "UNCLE" ? "侄" : "堂亲";
    return `宗室废立，废${target}${fact.relatedRulerName}而继位`;
  }
  const subject = relation === "DIRECT_CHILD" ? "其子" : relation === "GRANDCHILD" ? "其孙" :
    relation === "SIBLING" ? `其${siblingRelation}` : relation === "NEPHEW" ? "其侄" :
    relation === "UNCLE" ? "其叔伯" : "其堂亲";
  return `${formatWorldDate(fact.month)}被${subject}${fact.relatedRulerName}废黜`;
}


/** Percentage points, not relative percentages; retain real sub-display differences. */
export function formatReignTerritoryChange(start: number, end: number) {
  const delta = (end - start) * 100;
  let digits = 1;
  while (digits < 6 && start !== end && (start * 100).toFixed(digits) === (end * 100).toFixed(digits)) digits++;
  const amount = Math.abs(delta).toFixed(digits);
  const change = delta === 0 ? "持平" : Number(amount) === 0 ? `约持平（实际微${delta > 0 ? "升" : "降"}，不足0.000001个百分点）` : `${delta > 0 ? "+" : "−"}${amount}个百分点`;
  return `${(start * 100).toFixed(digits)}% → ${(end * 100).toFixed(digits)}%（${change}）`;
}

export function getReignTrajectoryPresentation(t: RulerReignTrajectory, finalized = true) {
  const label = t.expandedThenRetreated ? "扩张后显著回撤" : t.inheritedDecline ? "承接高位后显著收缩" :
    t.expandedAndRetained ? "扩张成果大部保有" : t.recoveredAfterWarfare ? "城邑反复得失，末期恢复" :
    t.majorTerritoryRetreat ? "峰值后显著回落" : "首末与记录峰值分列，不推定全程无事";
  return `疆域：即位${(t.accessionTerritory * 100).toFixed(1)}% → 记录峰值${(t.peakTerritory * 100).toFixed(1)}% → ${finalized ? "终局" : "目前"}${(t.endTerritory * 100).toFixed(1)}%；${label}。`;
}
