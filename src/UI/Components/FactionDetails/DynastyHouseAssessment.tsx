import { useEffect, useMemo, useState } from "react";
import type { Dynasty } from "../../../Politics/Dynasty";
import WorldHistory from "../../../History/WorldHistory";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import type { HouseHistoricalFaction, HouseHistoryContext } from "../../../Historiography/DynastyHouseHistoriography";
import { formatWorldDate, formatWorldDuration } from "../../../Simulation/WorldTime";

const states = { CONTINUING: "尚在统治", EXILED: "流亡承统，尚未终结", REPLACED: "旧王统结束，国家继续", EXTINCT: "国家已覆灭，政治王统终结",
  MERGED: "同源合邦终结", SUBMITTED: "纳土归附终结", ENDED: "政治阶段已结束" };
export function DynastyHouseAssessment({ dynasty, faction, factions, worldMonth }: {
  dynasty: Dynasty; faction: HouseHistoricalFaction; factions: HouseHistoryContext["factions"]; worldMonth: number;
}) {
  const [revision, setRevision] = useState(() => WorldHistory.getRevision());
  useEffect(() => WorldHistory.subscribeRevision(setRevision), []);
  const phases = useMemo(() => getHouseAssessments(dynasty, faction, factions, worldMonth), [dynasty, faction, factions, worldMonth, revision]);
  const [selected, setSelected] = useState<string>();
  const phase = phases.find(p => p.key === selected) ?? phases.at(-1);
  if (!phase) return <small>暂无王统阶段记录。</small>;
  return <details open style={{ border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", padding: "0.5rem", overflowWrap: "anywhere", minWidth: 0 }}>
    <summary style={{ cursor: "pointer", fontWeight: 600 }}>王统总评 · {phase.houseName}</summary>
    {phases.length > 1 ? <label style={{ display: "block", marginTop: "0.4rem", fontSize: "0.84rem" }}>
      历史阶段：<select aria-label="选择王统阶段" value={phase.key} onChange={e => setSelected(e.target.value)} style={{ maxWidth: "100%" }}>
        {[...phases].reverse().map(p => <option key={p.key} value={p.key}>{p.houseName} · {formatWorldDate(p.startMonth)}起</option>)}
      </select>
    </label> : null}
    <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.4rem", fontSize: "0.84rem" }}>
      <div>{phase.houseName} · {formatWorldDate(phase.startMonth)}～{phase.endMonth === undefined ? (phase.status === "ENDED" ? "终结月份未载" : "今") : formatWorldDate(phase.endMonth)} · {states[phase.status]}</div>
      <div>王统阶段历时：{formatWorldDuration(Math.max(0, (phase.endMonth ?? worldMonth) - phase.startMonth))}（非正式国祚）</div>
      {phase.transitionMonth !== undefined ? <div>王统交替记录：{formatWorldDate(phase.transitionMonth)}（不推定同月日级先后）</div> : null}
      <div>实际统治者：{phase.rulerCount}位 · 正式国家时期：{phase.formalRulerCount}位</div>
      <div>开创关联人物：{phase.founderName ?? "未能核验"}{phase.currentRulerName ? ` · 当前承统：${phase.currentRulerName}` : ""}</div>
      {phase.terminalRulerName ? <div>终结时承统人物：{phase.terminalRulerName}</div> : null}
      {phase.stateFoundedMonth !== undefined ? <div>国家正式建国：{formatWorldDate(phase.stateFoundedMonth)}（国家事实，不等于本段王统开端）</div> : <div>国家尚无正式建国记录</div>}
      <div><strong>{phase.endMonth === undefined ? "王统概览" : "王统史评"}</strong>{phase.assessment.map((line, i) => <p key={i} style={{ margin: "0.3rem 0" }}>{line}</p>)}</div>
      <div><strong>史家曰：</strong>{phase.voice}</div>
    </div>
  </details>;
}
