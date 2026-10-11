import type { HouseAssessment } from "../../../Historiography/DynastyHouseHistoriography";
import type { Ruler } from "../../../Politics/Dynasty";
import { formatWorldDate } from "../../../Simulation/WorldTime";

export const houseStates = { CONTINUING: "尚在延续", EXILED: "流亡承统，尚在延续", REPLACED: "旧王统结束，国家继续",
  EXTINCT: "国家覆灭，王统终结", MERGED: "同源合邦", SUBMITTED: "纳土归附", ENDED: "政治阶段已结束" };
export function formatHouseRange(p: HouseAssessment) {
  if (p.startMonth === p.endMonth) return `${formatWorldDate(p.startMonth)}开始并于同月终结`;
  return `${formatWorldDate(p.startMonth)}～${p.endMonth === undefined ? (["CONTINUING", "EXILED"].includes(p.status) ? "今" : "终结月份未载") : formatWorldDate(p.endMonth)}`;
}
export function formatHouseOpening(p: HouseAssessment) {
  return p.usurpationProven ? "篡朝夺统" : p.startReason === "NATURAL_HOUSE_SUCCESSION" ? "自然易姓续统" :
    p.startReason === "RESTORATION" ? "复国开启政治阶段" : "开创王统";
}
/** Only a verified holder whose term covers state founding, within this phase. */
export function getHouseStateFounder(p: HouseAssessment, rulers: readonly Ruler[]) {
  const month = p.stateFoundedMonth;
  if (month === undefined || month < p.startMonth || (p.endMonth !== undefined && month > p.endMonth)) return undefined;
  const event = p.milestones.find(m => m.type === "state-founded" && m.month === month && m.rulerId);
  const holders = rulers.filter(r => p.rulerIds.includes(r.id) && r.accessionYear !== undefined && r.accessionYear <= month && (r.endYear ?? Infinity) >= month);
  const holder = event ? holders.find(r => r.id === event.rulerId) : holders.length === 1 ? holders[0] : undefined;
  return { month, name: holder ? `${holder.houseName.replace(/氏$/, "")}${holder.givenName}` : undefined };
}
/** Transmission only: no national peaks, campaign recap or a second historian voice. */
export function getHouseArchiveSummary(p: HouseAssessment, next?: HouseAssessment, phaseCount = 1) {
  const opening = p.usurpationProven ? `${p.founderName ?? p.houseName}以篡朝开启此段王统。` :
    p.startReason === "NATURAL_HOUSE_SUCCESSION" ? `${p.founderName ?? p.houseName}自然承继，开启易姓后的政治阶段。` :
    p.startReason === "RESTORATION" ? `${p.houseName}在复国时开启这一政治阶段。` : `${p.founderName ?? p.houseName}开创此统。`;
  const ending = p.status === "REPLACED" ? `${next?.houseName ?? "后继王统"}${next?.usurpationProven ? "篡朝接掌王统" : "承接王统"}，本国建制继续。` :
    p.status === "MERGED" ? `${p.terminalRulerName ?? "末代承统者"}因同源合邦结束独立统治。` :
    p.status === "SUBMITTED" ? `${p.terminalRulerName ?? "末代承统者"}纳土退位，独立统治结束。` :
    p.status === "EXTINCT" ? `${p.terminalRulerName ? `最后由${p.terminalRulerName}承统，` : ""}此统随国家政治终结而结束。` :
    p.status === "EXILED" ? `${p.currentRulerName ? `${p.currentRulerName}当前` : "当前"}在流亡中承统。` :
    p.status === "CONTINUING" ? `${p.currentRulerName ? `现由${p.currentRulerName}承统，` : ""}王统仍在延续。` : "这一政治阶段已经结束。";
  return phaseCount === 1 ? [ending] : [opening, ending];
}
