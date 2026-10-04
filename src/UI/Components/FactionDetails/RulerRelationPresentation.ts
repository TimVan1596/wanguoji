import { RulerRelationType } from "../../../Politics/Dynasty";

export function formatRulerRelation(
  relation: RulerRelationType | undefined,
  identityStage?: string,
  parentRecorded = true,
  foundedStateEvidence?: boolean
) {
  if (relation === "FOUNDER") return foundedStateEvidence === undefined
    ? identityStage === "PROVISIONAL" ? "首任首领" : "开国君主"
    : foundedStateEvidence ? "开国君主" : "首任首领 / 势力创始人";
  if (relation === "DIRECT_CHILD") return parentRecorded ? "前君之子" : "直系继承（父名未记录）";
  if (relation === "GRANDCHILD") return "前君之孙";
  if (relation === "SIBLING") return "前君之兄弟";
  if (relation === "NEPHEW") return "前君之侄";
  if (relation === "UNCLE") return "前君之伯叔";
  if (relation === "COUSIN") return "前君之堂兄弟";
  if (relation === "COLLATERAL_KIN") return "宗室旁支";
  if (relation === "NEW_HOUSE") return "易姓 / 新家族继位";
  if (relation === "LEADER_SUCCESSOR") return "非世袭首领继任";
  return "继任关系未记录";
}

export function formatRulerLineage(
  relation: RulerRelationType | undefined,
  parentName?: string,
  identityStage?: string,
  foundedStateEvidence?: boolean
) {
  if (relation === "LEADER_SUCCESSOR") return "无直系世系记录";
  if (parentName) return `父：${parentName}`;
  if (relation === "FOUNDER" && (foundedStateEvidence === false || foundedStateEvidence === undefined && identityStage === "PROVISIONAL")) {
    return "首任首领";
  }
  return formatRulerRelation(relation, identityStage, false, foundedStateEvidence);
}
