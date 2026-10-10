import type { Ruler } from "../../../Politics/Dynasty";
import { hasRecordedRulerDeath } from "../../../Politics/RulerLifeState";
import type { DynastyHouseEpoch } from "../../../Politics/DynasticRevolution";
import type { RulerChronicle } from "../../../Politics/RulerChronicle";
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
  "citiesCapturedPersonally" | "citiesLostDuringReign" | "rebellionsDuringReign" | "restorationsDuringReign">) {
  const stats: Array<[string, number]> = [["亲征夺城", chronicle.citiesCapturedPersonally],
    ["失城", chronicle.citiesLostDuringReign], ["内乱", chronicle.rebellionsDuringReign], ["复国", chronicle.restorationsDuringReign]];
  return stats.filter(([, value]) => value > 0).map(([label, value]) => `${label}：${value}`).join(" · ") || "暂无显著在位统计";
}

/** endYear ends a reign; V13 dead status requires an actual recorded death. */
export function formatRulerAge(status: string, age: number) {
  return `${status === "dead" ? "享年" : status === "abdicated" ? "退位时" : status === "politically-ended" ? "政治任期终结时" : "当前年龄"}${age}岁`;
}

/** Freeze ended-person ages at the recorded event, never at today's month. */
export function formatRulerLifeAge(ruler: Pick<Ruler, "status" | "bornYear" | "endYear" | "deathMonth" | "deathReason">, worldMonth: number) {
  const death = hasRecordedRulerDeath(ruler);
  const month = death ? ruler.deathMonth! : ruler.endYear ?? worldMonth;
  const age = Math.max(0, Math.floor((month - ruler.bornYear) / 12));
  const status = death ? "dead" : ruler.status === "abdicated" ? "abdicated" :
    ruler.endYear !== undefined ? "politically-ended" : ruler.status;
  return formatRulerAge(status, age) + (status === "politically-ended" ? " · 生死未载" : "");
}
