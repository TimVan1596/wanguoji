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
  text("危机证据", formatRevolutionEvidence(String(m.vulnerabilityEvidence ?? "").split(",")));
  text("旧王统", m.oldHouseName); text("新王统", m.newHouseName);
  text("被排除合法继承人", m.displacedSuccessorName);
  text("继承人档案 ID", m.displacedSuccessorId);
  if (typeof m.oldStateName === "string" && typeof m.newStateName === "string" && m.oldStateName !== m.newStateName)
    lines.push(`国号变化：${m.oldStateName} → ${m.newStateName}`);
  if (typeof m.oldColor === "number" && typeof m.newColor === "number" && m.oldColor !== m.newColor)
    lines.push(`易帜：#${m.oldColor.toString(16).padStart(6, "0")} → #${m.newColor.toString(16).padStart(6, "0")}`);
  return lines;
}


/** Frozen event evidence only; never infer court actors, motives or kinship. */
export function composeRevolutionNarrative(m: Record<string, string | number | undefined>) {
  const evidence = formatRevolutionEvidence(String(m.vulnerabilityEvidence ?? "").split(","));
  const ending = m.successionReason === "combat" ? "战死" : m.successionReason === "captured" ? "被俘处死" : m.successionReason === "natural" ? "去世" : "";
  const predecessor = typeof m.previousRulerTitle === "string" ? m.previousRulerTitle : m.predecessorRulerName;
  const backgroundFacts = typeof m.crisisCapitalCityName === "string" && typeof m.crisisCapitalMonth === "number" && typeof m.crisisSplitMonth === "number"
    && typeof m.crisisCapitalEventId === "string" && typeof m.crisisSplitEventId === "string"
    ? [{ month: m.crisisCapitalMonth, text: `失去${m.crisisCapitalCityName}` },
       { month: m.crisisSplitMonth, text: "另有重大帝国分裂" }].sort((a, b) => a.month - b.month) : [];
  const background = backgroundFacts.length ? `此前${backgroundFacts.map(row => `${formatWorldDate(row.month)}${row.text}`).join("，")}；` : "";
  const death = predecessor && ending ? `${predecessor}${ending}，` : "";
  return `${background}${death}${evidence ? `${evidence}，` : ""}继统之际${m.newRulerName ?? m.newHouseName}夺取王统，${m.newHouseName}取代${m.oldHouseName}。合法继承人${m.displacedSuccessorName}被排除于继统序列${m.oldStateName !== m.newStateName ? `，国号改为${m.newStateName}` : ""}${m.oldColor !== m.newColor ? "，并易帜" : ""}。`;
}
