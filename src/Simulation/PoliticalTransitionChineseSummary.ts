import { formatWorldDate } from "./WorldTime";
import type { PoliticalTransitionObservations } from "./PoliticalTransitionObservations";
type Snapshot = ReturnType<PoliticalTransitionObservations["snapshot"]>;
const labels: Record<string,string> = {
  NOT_SAME_ORIGIN:"无政治同源关系",NO_ACTIVE_STATE:"无有效正式建制",TREATY_EXPIRED:"条约已到期",
  NON_AGGRESSION_TOO_SHORT:"互不侵犯不足十年",NOT_ADJACENT:"领土不接壤",POWER_GAP_TOO_SMALL:"实力差距不足",
  WEAKER_TOO_MANY_CITIES:"弱方城市超过限制",PEACE_EVIDENCE_INSUFFICIENT:"十年和平证据不足或存在战事",
  NO_PRESSURE_TRIGGER:"无可信共同压力且不符合极弱条件",ALLIANCE_TOO_SHORT:"战略同盟或和平期限不足",
  RECENT_BILATERAL_WAR:"近期双边战争",CITY_RATIO_TOO_HIGH:"城市比例过高",EQUAL_TERRITORY_STRENGTH:"领土实力相等",
  NO_DURABLE_RELATION:"无有效长期外交关系",RELATION_TOO_SHORT:"外交关系期限不足",STRONGER_TOO_WEAK:"强方规模不足",
  WEAKER_TOO_LARGE:"弱方规模过大",STABILITY_TOO_HIGH:"弱方稳定度过高",SAME_ORIGIN_USES_STRATEGIC_UNION:"同源应走合邦路径",
  NOT_ACTIVE_STATE:"双方不是有效正式国家",
};
export function formatPoliticalTransitionChineseSummary(report: {
  worldMonth:number; peacefulReunification:Snapshot;strategicUnion:Snapshot;peacefulSubmission:Snapshot;
  retainedCanonicalHistory:{submittedEvents:number;mergedEvents:number};
}) {
  const nap = report.peacefulReunification.sessionCumulative, ally = report.strategicUnion.sessionCumulative;
  const blockers = (s:Snapshot) => Object.entries(s.sessionCumulative.blockerCounts)
    .sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5)
    .map(([key,n]) => `${labels[key] ?? "其他资格限制"}：${n}`).join("；") || "暂无阻断样本";
  return ["和平政治转型诊断",`当前世界年月：${formatWorldDate(report.worldMonth)}`,
    `会话起点：${formatWorldDate(report.peacefulReunification.sessionStartMonth)}（读取或新建时重置）`,
    `本次实际观察：${nap.observedWorldMonths}个月，约${(nap.observedWorldMonths/12).toFixed(2)}年`,
    `同源长期互不侵犯候选检查：${nap.preliminaryEligiblePairs}（年度重复检查，非独立国家对）`,
    `满足完整归并资格：${nap.fullyEligibleChecks}`,
    `互不侵犯路径执行尝试：${nap.selectedAttempts}；失败：${nap.executionFailures}`,
    `长期互不侵犯归并次数：${nap.successfulTransitions}`,
    `正式战略同盟合邦次数：${ally.successfulTransitions}`,
    `本次纳土归附次数：${report.peacefulSubmission.sessionCumulative.successfulTransitions}`,
    `互不侵犯路径资格阻断：${blockers(report.peacefulReunification)}`,
    `战略同盟路径资格阻断：${blockers(report.strategicUnion)}`,
    `纳土归附资格阻断：${blockers(report.peacefulSubmission)}`,
    `存档保留历史：同源合邦${report.retainedCanonicalHistory.mergedEvents}次，纳土归附${report.retainedCanonicalHistory.submittedEvents}次`,
    "历史区间完整性未证明，不计算历史发生率；旧历史资格不可回溯。详细统计仅在调试模式启用。",
  ].join("\n");
}
