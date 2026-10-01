import { RulerRelationType } from "../../../Politics/Dynasty";

export function formatRulerRelation(
  relation: RulerRelationType | undefined,
  identityStage?: string,
  parentRecorded = true
) {
  if (relation === "FOUNDER") return identityStage === "PROVISIONAL" ? "首任首领" : "开国君主";
  if (relation === "DIRECT_CHILD") return parentRecorded ? "前君之子" : "直系继承（父名未记录）";
  if (relation === "COLLATERAL_KIN") return "宗室旁支";
  if (relation === "NEW_HOUSE") return "易姓 / 新家族继位";
  if (relation === "LEADER_SUCCESSOR") return "非世袭首领继任";
  return "继任关系未记录";
}

export function formatRulerLineage(
  relation: RulerRelationType | undefined,
  parentName?: string,
  identityStage?: string
) {
  if (relation === "LEADER_SUCCESSOR") return "无直系世系记录";
  if (parentName) return `父：${parentName}`;
  return formatRulerRelation(relation, identityStage, false);
}
