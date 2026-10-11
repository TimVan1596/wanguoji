import type { Ruler } from "../Politics/Dynasty";
import type { HistoricalFaction } from "./FactionHistoriography";
import { resolveHistoricalRulerDisplay } from "../Politics/HistoricalRulerDisplay";
import { hasRecordedRulerDeath } from "../Politics/RulerLifeState";
import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate } from "../Simulation/WorldTime";

export type ChronicleKind = "ORIGIN" | "STATE" | "PEAK" | "POLITICS" | "CAMPAIGN" | "MOVE" | "EXILE" | "RESTORE" | "TERMINAL";
export interface ChroniclePassage { key: string; month: number; order: number; priority: number; text: string; required?: boolean; kind: ChronicleKind }

/** Resolve names only for retained passages, so omitted events don't consume first mention. */
export function createChroniclePeople(factions: ReadonlyMap<string, HistoricalFaction>, throughMonth: number) {
  const refs: { ruler: Ruler; factionId: string; month: number }[] = [];
  const seen = new Set<string>();
  return {
    ref(ruler: Ruler, factionId: string, month: number) { refs.push({ ruler, factionId, month }); return `⟦人物${refs.length - 1}⟧`; },
    render(text: string) {
      return text.replace(/⟦人物(\d+)⟧/g, (_, index: string) => {
        const { ruler, factionId, month } = refs[Number(index)];
        const personal = `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
        const key = `${factionId}:${ruler.id}`;
        if (seen.has(key)) return personal;
        seen.add(key);
        const faction = factions.get(factionId);
        const rank = faction?.sovereigntyHistory.slice().reverse().find(h => h.startMonth <= month && (h.endMonth === undefined || h.endMonth >= month))?.rank;
        const validRank = rank === "LEADER" || rank === "KING" || rank === "EMPEROR" ? rank : undefined;
        const name = faction ? getFactionDisplayNameAtMonth(faction, month) : "";
        // Event-time identity must not turn a later epithet into a contemporary title.
        const contemporary = resolveHistoricalRulerDisplay({ ...ruler, templeName: undefined, posthumousEpithet: undefined }, name, "compact", { historicalRank: validRank });
        const recalled = hasRecordedRulerDeath(ruler) && ruler.deathMonth! <= throughMonth &&
          resolveHistoricalRulerDisplay(ruler, name, "full", { historicalRank: validRank }) !== contemporary;
        return contemporary + (recalled ? `（${[ruler.posthumousEpithet && `后谥${ruler.posthumousEpithet}`, ruler.templeName && `后世庙号${ruler.templeName}`].filter(Boolean).join("，")}）` : "");
      });
    }
  };
}

/** Group related political phases, not fixed character/year buckets. */
export function composeChronicleParagraphs(passages: readonly ChroniclePassage[], render: (s: string) => string,
  tail: string, judgment: string, terminal: boolean): string[] {
  const blocks: { parts: string[]; month: number; kind: ChronicleKind }[] = [];
  const turning = new Set<ChronicleKind>(["POLITICS", "EXILE", "RESTORE", "TERMINAL"]);
  for (let i = 0; i < passages.length; i++) {
    const p = passages[i], previous = passages[i - 1];
    const sameMonth = previous?.month === p.month;
    let block = blocks.at(-1);
    const originEnded = block && block.kind === "STATE" && !["STATE", "ORIGIN"].includes(p.kind);
    const newPhase = block && turning.has(p.kind) && block.kind !== p.kind && block.parts.length >= 2;
    if (!block || !sameMonth && (originEnded || newPhase || block.parts.length >= 3)) {
      block = { parts: [], month: p.month, kind: p.kind }; blocks.push(block);
    }
    const text = render(p.text);
    if (sameMonth && block.parts.length) {
      block.parts[block.parts.length - 1] = block.parts.at(-1)!.replace(/。$/, "") + `；${text}。`;
    } else block.parts.push(`${formatWorldDate(p.month)}，${text}。`);
    block.month = p.month; block.kind = p.kind;
  }
  if (!blocks.length) blocks.push({ parts: [], month: 0, kind: "ORIGIN" });
  blocks.at(-1)!.parts.push(render(tail));
  // Reserve the opening, actual terminal and argument; omit whole optional sentences.
  const ending = judgment.length <= 1600 ? judgment : "";
  const paragraphs = blocks.map(b => b.parts.join(""));
  const keep = new Set<number>(); let used = ending.length;
  const preserve = (i: number) => { if (!keep.has(i) && used + paragraphs[i].length <= 1600) { keep.add(i); used += paragraphs[i].length; } };
  preserve(0); if (terminal && paragraphs.length > 1) preserve(paragraphs.length - 1);
  paragraphs.forEach((_, i) => preserve(i));
  const result = paragraphs.filter((_, i) => keep.has(i));
  if (ending) result.push(ending);
  return result;
}
