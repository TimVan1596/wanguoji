import type { WorldEvent } from "../../../History/WorldHistory";
import type Team from "../../../Components/Team";
import type { PopulationTransitionAudit, PopulationTransitionRecord } from "../../../Simulation/PopulationTransitionAudit";
import { getPopulationRecoveryContext } from "../../../Simulation/PopulationRecoveryRules";
import { formatWorldDate } from "../../../Simulation/WorldTime";

export function populationCauseLabel(cause: string) {
  return ({ NATURAL_GROWTH: "自然恢复", IMMIGRATION: "外来流民迁入", SPECIAL_EVENT: "特殊外源增员", RANDOM_EVENT: "随机事件增员",
    REBELLION_TRANSFER: "叛乱人口转属", EMPIRE_SPLIT_TRANSFER: "分裂人口转属", SURRENDER_TRANSFER: "战败投降",
    CONQUEST_TRANSFER: "征服转属", FACTION_SUBMISSION: "纳土归附", FACTION_MERGER: "和平合邦", LIVE_TRANSFER: "人口转属",
    LIVE_JOIN: "外来人口加入", SIEGE_LOSS: "战争人口损耗", BATTLE_DEATH: "战斗损失", NATURAL_DEATH: "军政人物自然死亡",
    RESTORATION: "复国人口恢复或居民转属", RULER_LIFECYCLE: "君主地图单位变化", EXTINCTION_REMNANT: "真实人口转为匿名残部",
    EXTINCTION_DISBAND: "失国人口离散", GOD_ACTION: "神力操作", INITIALIZATION: "世界初始人口", UNATTRIBUTED: "尚无法归因的变化" } as Record<string,string>)[cause] ?? "其他已记录变化";
}

export function buildPopulationRecoveryLines(team: Team, month: number, summary: ReturnType<PopulationTransitionAudit["getSummary"]> | undefined,
  last?: PopulationTransitionRecord, climateMultiplier = 1, recentEvents: readonly WorldEvent[] = []) {
  const c = getPopulationRecoveryContext(team, month, recentEvents), lines = [c.state,
    `有效领土${c.territory}格 · 城市${c.cityCount}座 · 受围${c.siegeCount}座 · 近期战乱城市${c.recentWarCities}座${c.recentConflict ? " · 有近期战事记录" : ""}`,
    `城市条件恢复修正${c.multiplier.toFixed(2)}× · 丰收/灾害修正${climateMultiplier.toFixed(2)}×`];
  if (summary) {
    const r = summary.recent;
    lines.push(`最近12个月净变化${r.net >= 0 ? "+" : ""}${r.net}（本次会话已观察${summary.observedMonths}个月，读档重置）`,
      `自然恢复+${r.naturalGrowth} · 外来迁入+${r.external} · 特殊外源+${r.special}`,
      `战争损失−${r.warDeaths} · 自然死亡−${r.naturalDeaths} · 转入+${r.transferIn} · 转出−${r.transferOut}`);
    if (r.otherNet || r.unattributed) lines.push(`君主地图单位、残部转换、离散与神力等其他净变化${r.otherNet >= 0 ? "+" : ""}${r.otherNet}；未归因${r.unattributed}`);
    if (summary.rollingLimited) lines.push("近期国家分项达到诊断上限，不能视为完整记录。");
  }
  if (last) lines.push(`最近有记录的变化：${formatWorldDate(last.month)}，${populationCauseLabel(last.cause)} ${last.delta > 0 ? "+" : ""}${last.delta}`);
  lines.push("国家之间转属不增加世界总人口；自然恢复是离散人口增员，不等于一个婴儿出生。人口趋势见“国势→人口变化”。");
  return lines;
}
