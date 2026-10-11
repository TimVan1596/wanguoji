import { useEffect, useMemo, useState } from "react";
import type { Dynasty } from "../../../Politics/Dynasty";
import WorldHistory from "../../../History/WorldHistory";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import type { HouseAssessment, HouseHistoricalFaction, HouseHistoryContext } from "../../../Historiography/DynastyHouseHistoriography";
import { getFactionAssessment } from "../../../Historiography/FactionAssessmentArchive";
import { FactionAssessmentContent } from "../FactionAssessment";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { formatHouseOpening, formatHouseRange, getHouseArchiveSummary, getHouseStateFounder, houseStates } from "./RoyalArchivePresentation";

type NationalAssessment = NonNullable<ReturnType<typeof getFactionAssessment>>;
export type RoyalArchiveView = "national" | "house";
export function getRoyalArchiveDefaultView(phaseCount: number, hasNationalAssessment: boolean): RoyalArchiveView {
  return phaseCount <= 1 && hasNationalAssessment ? "national" : "house";
}
export function DynastyHouseAssessment({ dynasty, faction, factions, worldMonth, nationalAssessment }: {
  dynasty: Dynasty; faction: HouseHistoricalFaction; factions: HouseHistoryContext["factions"]; worldMonth: number;
  nationalAssessment?: NationalAssessment;
}) {
  const [revision, setRevision] = useState(() => WorldHistory.getRevision());
  useEffect(() => WorldHistory.subscribeRevision(setRevision), []);
  const phases = useMemo(() => getHouseAssessments(dynasty, faction, factions, worldMonth), [dynasty, faction, factions, worldMonth, revision]);
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<RoyalArchiveView>(() => getRoyalArchiveDefaultView(phases.length, Boolean(nationalAssessment)));
  return <RoyalArchiveBody phases={phases} dynasty={dynasty} selected={selected} onSelect={setSelected}
    view={view} onView={setView} nationalAssessment={nationalAssessment} />;
}
/** One visible text pane; selection stays local across pane changes. */
export function RoyalArchiveBody({ phases, dynasty, selected, onSelect, view, onView, nationalAssessment }: {
  phases: readonly HouseAssessment[]; dynasty: Pick<Dynasty, "rulers">; selected?: string; onSelect: (key: string) => void;
  view: RoyalArchiveView; onView: (view: RoyalArchiveView) => void; nationalAssessment?: NationalAssessment;
}) {
  const phase = phases.find(p => p.key === selected) ?? phases.at(-1);
  if (!phase && !nationalAssessment) return <small>暂无王统阶段记录。</small>;
  const currentView = (view === "national" || !phase) && nationalAssessment ? "national" : "house";
  const founder = phase ? getHouseStateFounder(phase, dynasty.rulers) : undefined;
  return <details open style={{ border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", padding: "0.5rem", overflowWrap: "anywhere", minWidth: 0, maxWidth: "100%" }}>
    <summary style={{ cursor: "pointer", fontWeight: 600 }}>国史与王统</summary>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem" }}>
      {nationalAssessment ? <button type="button" aria-pressed={currentView === "national"} onClick={() => onView("national")}>国家国评</button> : null}
      {phase ? <button type="button" aria-pressed={currentView === "house"} onClick={() => onView("house")}>王统摘要</button> : null}
    </div>
    {phase ? <div style={{ display: "grid", gap: "0.3rem", margin: "0.5rem 0", fontSize: "0.84rem", minWidth: 0 }}>
      {phases.length > 1 ? <label>历史王统：<select aria-label="选择王统阶段" value={phase.key} onChange={e => { onSelect(e.target.value); onView("house"); }} style={{ maxWidth: "100%", minWidth: 0 }}>
        {[...phases].reverse().map(p => <option key={p.key} value={p.key}>{p.houseName} · {formatWorldDate(p.startMonth)}起</option>)}
      </select></label> : null}
      <strong>王统一览 · {phase.houseName}</strong>
      <div>{formatHouseRange(phase)} · {houseStates[phase.status]}</div>
      <div>{phase.startMonth === phase.endMonth ? `当月${phase.rulerCount}位君主承统` : `历任统治者：${phase.rulerCount}位`}</div>
      <div>开创人物：{phase.founderName ?? "未载"} · {formatHouseOpening(phase)}</div>
      {phase.transitionMonth !== undefined ? <div>王统交替：{formatWorldDate(phase.transitionMonth)}</div> : null}
      {founder ? <div>正式建国：{formatWorldDate(founder.month)}{founder.name ? ` · ${founder.name}在位时` : ""}</div> : null}
      {phase.currentRulerName ? <div>当前承统：{phase.currentRulerName}</div> : null}
      {phase.terminalRulerName ? <div>最后承统：{phase.terminalRulerName}</div> : null}
    </div> : null}
    {currentView === "national" && nationalAssessment ? <FactionAssessmentContent assessment={nationalAssessment} /> :
      phase ? <div data-archive-pane="house" style={{ fontSize: "0.84rem" }}>
        {getHouseArchiveSummary(phase, phases[phases.indexOf(phase) + 1], phases.length).map((line, i) => <p key={i} style={{ margin: "0.3rem 0" }}>{line}</p>)}
      </div> : null}
  </details>;
}
