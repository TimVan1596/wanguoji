import { formatWorldDate } from "../Simulation/WorldTime";
import type { WorldEvent } from "./WorldHistory";
import { formatRevolutionEvidence } from "../Politics/DynasticRevolution";

/** Only recorded event-time facts; current faction/ruler state is irrelevant. */
export function getRevolutionEventDetails(event: WorldEvent) {
  if (event.type !== "dynasty-usurped" || !event.metadata) return [];
  const m = event.metadata, lines: string[] = [];
  const text = (label: string, value: unknown) => { if (typeof value === "string" && value) lines.push(`${label}：${value}`); };
  text("前君", m.previousRulerTitle ?? m.predecessorRulerName);
  text("前君结局", m.successionReason === "combat" ? "战死" : m.successionReason === "captured" ? "被俘处死" : m.successionReason === "natural" ? "去世" : undefined);
  if (typeof m.stability === "number") lines.push(`当时稳定度：${m.stability}`);
  if(typeof m.stability==='number'&&m.stability>60)lines.push('民心稳定度与王统继承危机分别核验；高稳定度不自动排除有来源的继承危机。');
  lines.push(typeof m.militaryParticipation==='string'?'军事参与者须另查军权来源，参与废立／易代不等于本人登基。':'本条未记录军权参与证据，不据此推断新君曾任将领或率军。');
  text("危机证据", formatRevolutionEvidence(String(m.vulnerabilityEvidence ?? "").split(",")));
  text("旧王统", m.oldHouseName); text("新王统", m.newHouseName);
  text("被排除合法继承人", m.displacedSuccessorName);
  text("继承人档案 ID", m.displacedSuccessorId);
  if (typeof m.displacedSuccessorAge === "number") lines.push(`继承人当时年龄：${m.displacedSuccessorAge}岁`);
  text("前君档案 ID", m.predecessorRulerId);
  text("新君档案 ID", event.rulerId);
  text("旧王统开统者 ID", m.oldHouseFoundingRulerId);
  text("新王统开统者 ID", m.newHouseFoundingRulerId);
  if (typeof m.oldStateName === "string" && typeof m.newStateName === "string" && m.oldStateName !== m.newStateName)
    lines.push(`国号变化：${m.oldStateName} → ${m.newStateName}`);
  if (typeof m.oldColor === "number" && typeof m.newColor === "number" && m.oldColor !== m.newColor)
    lines.push(`易帜：#${m.oldColor.toString(16).padStart(6, "0")} → #${m.newColor.toString(16).padStart(6, "0")}`);
  return lines;
}


/** Frozen event evidence only; never infer court actors, motives or kinship. */
export function composeRevolutionNarrative(m: Record<string, string | number | undefined>) {
  const evidenceKeys = String(m.vulnerabilityEvidence ?? "").split(",");
  const ending = m.successionReason === "combat" ? "战死" : m.successionReason === "captured" ? "被俘处死" : m.successionReason === "natural" ? "去世" : "";
  const predecessor = typeof m.previousRulerTitle === "string" ? m.previousRulerTitle : m.predecessorRulerName;
  const storedEvidence = typeof m.crisisEvidence === "string" ? (() => { try { return JSON.parse(m.crisisEvidence); } catch { return []; } })() : [];
  const backgroundFacts: Array<{ month: number; eventId: string; evidenceKey: string; text: string }> = Array.isArray(storedEvidence)
    ? storedEvidence.filter((row: any) => row && typeof row.eventId === "string" && row.eventId && Number.isSafeInteger(row.month) && row.month >= 0 && (typeof m.month !== "number" || row.month <= m.month) &&
      (row.kind === "CAPITAL_LOSS" || row.kind === "EMPIRE_SPLIT") && Array.isArray(row.cityIds) && row.cityIds.every((id: unknown) => typeof id === "string"))
      .map((row: any) => ({ month: row.month, eventId: row.eventId,
        evidenceKey: row.kind === "CAPITAL_LOSS" ? "RECENT_CAPITAL_LOSS" : "RECENT_EMPIRE_SPLIT",
        text: row.kind === "CAPITAL_LOSS" ? `失去${Array.isArray(row.cityNames) && typeof row.cityNames[0] === "string" ? row.cityNames[0] : "都城"}` : `发生重大分裂${Array.isArray(row.cityNames) && row.cityNames.length && row.cityNames.every((name: unknown) => typeof name === "string") ? `，${row.cityNames.join("、")}脱离` : ""}` }))
    : [];
  if (!backgroundFacts.length && typeof m.crisisCapitalCityName === "string" && typeof m.crisisCapitalMonth === "number" && typeof m.crisisSplitMonth === "number"
    && typeof m.crisisCapitalEventId === "string" && typeof m.crisisSplitEventId === "string"
  ) {
    backgroundFacts.push({ month: m.crisisCapitalMonth, eventId: m.crisisCapitalEventId, evidenceKey: "RECENT_CAPITAL_LOSS", text: `失去${m.crisisCapitalCityName}` },
      { month: m.crisisSplitMonth, eventId: m.crisisSplitEventId, evidenceKey: "RECENT_EMPIRE_SPLIT", text: "发生重大帝国分裂" });
  }
  const seenEvidence = new Set<string>();
  for (let index = 0; index < backgroundFacts.length;) {
    const row = backgroundFacts[index];
    if (seenEvidence.has(row.eventId) || typeof m.month === "number" && row.month > m.month) backgroundFacts.splice(index, 1);
    else { seenEvidence.add(row.eventId); index++; }
  }
  backgroundFacts.sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId));
  const background = backgroundFacts.length ? `此前${backgroundFacts.map(row => `${formatWorldDate(row.month)}${row.text}`).join("，")}；` : "";
  const evidence = formatRevolutionEvidence(evidenceKeys.filter(key =>
    !(ending && (key === "PREDECESSOR_COMBAT_DEATH" || key === "PREDECESSOR_CAPTURED")) &&
    !(background && backgroundFacts.some(row => row.evidenceKey === key))
  )).replace("少城且稳定度低", "国中城土所余不多，政局不稳");
  const death = predecessor && ending ? `${predecessor}${ending}，` : "";
  const successor = typeof m.displacedSuccessorName === "string" && m.displacedSuccessorName
    ? `合法继承人${m.displacedSuccessorName}${typeof m.displacedSuccessorAge === "number" && m.displacedSuccessorAge < 16 ? `（时年${m.displacedSuccessorAge}岁）` : ""}被排除于继统序列` : "";
  const house = typeof m.newHouseName === "string" && typeof m.oldHouseName === "string"
    ? `${m.newHouseName}取代${m.oldHouseName}` : "";
  const changes = [successor,
    typeof m.oldStateName === "string" && typeof m.newStateName === "string" && m.oldStateName !== m.newStateName ? `国号由${m.oldStateName}改为${m.newStateName}` : "",
    typeof m.oldColor === "number" && typeof m.newColor === "number" && m.oldColor !== m.newColor ? "并易帜" : ""].filter(Boolean);
  const actor = typeof m.newRulerName === "string" ? m.newRulerName : typeof m.newHouseName === "string" ? m.newHouseName : "新君";
  return `${background}${death}${evidence ? `${evidence}，` : ""}继统之际${actor}夺取王统${house ? `，${house}` : ""}。${changes.length ? `${changes.join("，")}。` : ""}`;
}
