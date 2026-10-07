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
