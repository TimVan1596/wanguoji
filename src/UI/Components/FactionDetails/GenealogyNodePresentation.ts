import {unresolvedSuccessionAct} from '../../../Politics/RoyalSuccessionStanding';
import {royalHonorHeading} from '../../../Politics/RoyalHonorPresentation';
import {royalHonorLabel} from './RoyalHonorPanel';
import { formatRulerLifeAge } from "./RoyalPresentation";
import type { Dynasty, Ruler } from "../../../Politics/Dynasty";
import type { WorldEvent } from "../../../History/WorldHistory";
import type { HouseHistoricalFaction } from "../../../Historiography/DynastyHouseHistoriography";
import { hasRecordedRulerDeath } from "../../../Politics/RulerLifeState";
import { getRulerTerminalRole } from "../../../History/PoliticalTerminalChronicle";

export type GenealogyRole = "当前君主" | "储君" | "势力创始" | "正式开国" | "称帝" | "篡朝开统" | "宗室废立继位" | "被宗室废黜" | "复国" | "末代承统" | "合邦退位" | "纳土退位";
export type GenealogyTheme = "neutral" | "monarch" | "current" | "heir" | "foundation" | "usurpation" | "restoration" | "terminal" | "disqualified" | "military";
export interface GenealogyNodePresentation {
  politicalLabel?:string;
  posthumousLabels?:string[];
  honor?:ReturnType<typeof royalHonorHeading>;
  roles: GenealogyRole[];
  labels: string[];
  theme: GenealogyTheme;
  details: string[];
  hasPosthumousTitle: boolean;
  evidence: { role: GenealogyRole; source: string }[];
}
const order: GenealogyRole[] = ["当前君主", "储君", "宗室废立继位", "被宗室废黜", "篡朝开统", "纳土退位", "合邦退位", "末代承统", "正式开国", "称帝", "势力创始", "复国"];
/** A single indexed faction window; no mutation, bloodline changes or per-node history searches. */
export function deriveGenealogyNodePresentations(dynasty: Dynasty, faction: HouseHistoricalFaction,
  events: readonly WorldEvent[], worldMonth: number): Map<string, GenealogyNodePresentation> {
  const revoked=new Map<string,number>();for(const e of events)if(e.type==='military-title-revoked')try{const h=JSON.parse(String(e.metadata?.honor)),key=`${h.personId}/${h.factionId}/${h.epochFounderId}`;revoked.set(key,Math.min(revoked.get(key)??Infinity,h.month));}catch{}
  const byId = new Map(dynasty.rulers.map(r => [r.id, r]));
  const evidence = new Map(dynasty.rulers.map(r => [r.id, [] as GenealogyNodePresentation["evidence"]]));
  const add = (r: Ruler | undefined, role: GenealogyRole, source: string) => {
    if (r && !evidence.get(r.id)!.some(e => e.role === role)) evidence.get(r.id)!.push({ role, source });
  };
  const holds = (r: Ruler, month: number) => r.accessionYear !== undefined && r.accessionYear <= month &&
    (r.endYear ?? worldMonth) >= month;
  const holder = (id: unknown, month: number) => {
    if (typeof id === "string") { const r = byId.get(id); return r && holds(r, month) ? r : undefined; }
    const candidates = dynasty.rulers.filter(r => holds(r, month));
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  if (faction.status !== "EXTINCT") {
    const current = byId.get(dynasty.currentRulerId ?? "");
    if (current && ["ruling", "exiled"].includes(current.status)) add(current, "当前君主", "currentRulerId");
    const heir = byId.get(dynasty.designatedHeirId ?? "");
    if (heir && !unresolvedSuccessionAct(heir,worldMonth) && ["heir", "kin"].includes(heir.status)) add(heir, "储君", "designatedHeirId");
  }
  const first = dynasty.houseEpochs?.[0];
  const founder = first?.startReason === "FOUNDING" ? byId.get(first.foundingRulerId) : undefined;
  if (first && founder?.relationType === "FOUNDER" && holds(founder, first.startMonth)) add(founder, "势力创始", `epoch:${first.startMonth}:${first.foundingRulerId}`);
  for (const event of events) {
    const month = event.monthIndex ?? event.year;
    if (month > worldMonth) continue;
    const m = event.metadata ?? {};
    if (event.actorFactionId === faction.name && ["state-founded", "emperor-proclaimed", "faction-restored", "dynasty-usurped"].includes(event.type)) {
      const r = holder(event.rulerId ?? m.rulerId ?? m.foundingRulerId, month);
      if (event.type === "state-founded" && month === faction.stateFoundedMonth) add(r, "正式开国", event.id);
      if (event.type === "emperor-proclaimed") add(r, "称帝", event.id);
      if (event.type === "faction-restored") add(r, "复国", event.id);
      if (event.type === "dynasty-usurped" && r?.relationType === "USURPER" && dynasty.houseEpochs?.some(p =>
        p.startReason === "USURPATION" && p.startMonth === month && p.foundingRulerId === r.id)) add(r, "篡朝开统", event.id);
    }
    if (event.type === "ruler-deposed" && event.actorFactionId === faction.name) {
      const predecessor = holder(typeof m.previousRulerId === "string" ? m.previousRulerId : undefined, month);
      const successor = holder(typeof m.nextRulerId === "string" ? m.nextRulerId : undefined, month);
      add(predecessor, "被宗室废黜", event.id);
      add(successor, "宗室废立继位", event.id);
    }
    if (faction.status === "EXTINCT" && (event.type === "faction-merged" || event.type === "faction-submitted")) {
      for (const r of dynasty.rulers) if (r.accessionYear !== undefined && r.status === "abdicated" && r.endYear === month &&
        month === (faction.terminationMonth ?? faction.extinctionYear) &&
        faction.terminationReason === (event.type === "faction-merged" ? "MERGED" : "SUBMITTED") &&
        getRulerTerminalRole(event, { ...r, accessionYear: r.accessionYear }, faction.name) === "SOURCE") {
        add(r, event.type === "faction-merged" ? "合邦退位" : "纳土退位", event.id);
      }
    }
  }
  const end = faction.terminationMonth ?? faction.extinctionYear;
  if (faction.status === "EXTINCT" && (faction.terminationReason ?? "EXTINCT") === "EXTINCT" && end !== undefined) {
    const actual = dynasty.rulers.filter(r => r.reignOrdinal !== undefined && r.accessionYear !== undefined &&
      r.accessionYear <= end).sort((a, b) => b.reignOrdinal! - a.reignOrdinal!);
    const last = actual[0];
    // State termination plus the last recorded political holder. Never infer death from this role.
    if (last && actual[1]?.reignOrdinal !== last.reignOrdinal && last.endYear !== undefined && last.endYear <= end &&
      (last.status === "politically-ended" || hasRecordedRulerDeath(last))) add(last, "末代承统", `termination:${end}`);
  }
  return new Map(dynasty.rulers.map(r => {
    const disqualified=unresolvedSuccessionAct(r,worldMonth);
    const restored=r.successionHistory?.some(a=>a.kind==='RESTORED'&&a.month<=worldMonth);
    const politicalLabel=disqualified?'承统资格已废':restored?'承统资格已恢复':undefined;
    const posthumousLabels=hasRecordedRulerDeath(r)&&r.deathMonth!<=worldMonth?[r.templeName?`庙号：${r.templeName}`:'',r.posthumousEpithet?`谥号：${r.posthumousEpithet}`:''].filter(Boolean):[];
    const proof = evidence.get(r.id)!;
    const roles = order.filter(role => proof.some(e => e.role === role));
    const theme: GenealogyTheme = roles.includes("当前君主") ? "current" : disqualified ? "disqualified" : roles.includes("储君") ? "heir" :
      roles.includes("篡朝开统") ? "usurpation" : roles.some(x => ["正式开国", "称帝", "势力创始"].includes(x)) ? "foundation" :
      roles.includes("复国") ? "restoration" : roles.some(x => ["末代承统", "合邦退位", "纳土退位"].includes(x)) ? "terminal" : r.reignOrdinal!==undefined&&r.accessionYear!==undefined ? "monarch" : r.militaryIdentity ? "military" : "neutral";
    const details = [...roles,politicalLabel??'',...posthumousLabels, royalHonorLabel(r,dynasty,worldMonth,faction.status), r.reignOrdinal !== undefined ? `第${r.reignOrdinal}代` : "宗室成员",
      !disqualified && dynasty.heirIds.includes(r.id) && !roles.includes("储君") ? "宗室候选" : "",
      r.displacedByUsurpationMonth !== undefined ? "旧朝宗亲" : "", r.endReason ?? "",
      formatRulerLifeAge(r, worldMonth),
      r.status === "kin" && r.accessionYear === undefined ? "未曾承统" : "",
      byId.get(dynasty.currentRulerId ?? "")?.parentId === r.id ? "当今君主的父辈" : "",
      r.status === "politically-ended" ? "生死未载" : r.status === "exiled" ? "流亡承统" : r.status === "deposed" ? "被宗室废黜" : ""].filter(Boolean);
    return [r.id, {politicalLabel,posthumousLabels,honor:royalHonorHeading(r,dynasty,worldMonth,{revoked:g=>(revoked.get(`${r.militaryIdentity?.personId}/${g.factionId}/${g.epochFounderId}`)??Infinity)<=worldMonth,factionId:dynasty.factionId,status:faction.status}), roles, labels: (politicalLabel?[politicalLabel,...roles]:roles).slice(0,2), theme, details, evidence: proof,
      hasPosthumousTitle: posthumousLabels.length>0 }];
  }));
}

/** Restrained palette: ordinary nodes remain neutral; bloodline edges keep their existing style. */
export const genealogyThemeStyles: Record<GenealogyTheme, { borderColor: string; backgroundColor: string; color: string }> = {
  disqualified: {borderColor:"#985f59",backgroundColor:"#f7eeee",color:"#7c453f"},
  military: {borderColor:"#638596",backgroundColor:"#eff4f6",color:"#3b5f70"},
  neutral: { borderColor: "var(--gg-border)", backgroundColor: "var(--gg-panel)", color: "var(--gg-text)" },
  monarch: {borderColor:"#9d917a",backgroundColor:"#f5f2eb",color:"#665c49"},
  current: { borderColor: "#9b731d", backgroundColor: "#fff3cf", color: "#63470d" },
  heir: { borderColor: "#587c92", backgroundColor: "#edf5f9", color: "#35556b" },
  foundation: { borderColor: "#ad9460", backgroundColor: "#faf4e6", color: "#6e5729" },
  usurpation: { borderColor: "#97666c", backgroundColor: "#f8edef", color: "#75454c" },
  restoration: { borderColor: "#638375", backgroundColor: "#edf5ef", color: "#406452" },
  terminal: { borderColor: "#8b8491", backgroundColor: "#f2f0f4", color: "#62596e" },
};
