import type { FactionHistoricalEvidence } from "./FactionHistoriography";
import type { FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import type { HouseAssessment } from "./DynastyHouseHistoriography";
import { getCapitalCaptureEvidence } from "./FactionHistoricalArguments";
import { historianNumber, historianSpan, historianTerritory } from "./HistorianVoiceLanguage";

/** Evidence-bearing themes for the unified article only, never gameplay scores. */
export interface ChronicleArgument {
  key: string; score: number; eventIds: string[]; metricKeys: string[]; months: number[]; text: string;
}
export function deriveChronicleArguments(f: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[],
  phases: readonly HouseAssessment[], end: number): ChronicleArgument[] {
  const out: ChronicleArgument[] = [];
  const actor = (e: FactionNarrativeEvidence) => e.factionRole === "ACTOR" || e.factionRole === "CONQUEROR";
  const add = (key: string, score: number, supports: readonly FactionNarrativeEvidence[], metricKeys: string[], months: number[], text: string) =>
    out.push({ key, score, eventIds: [...new Set(supports.map(e => e.eventId))], metricKeys,
      months: [...new Set([...supports.map(e => e.month), ...months])].sort((a, b) => a - b), text });
  const exiles = events.filter(e => e.type === "faction-exiled" && e.factionRole === "TARGET");
  const restores = events.filter(e => e.type === "faction-restored" && actor(e));
  const latestLoss = exiles.at(-1);
  const loss = latestLoss && !restores.some(e => e.month > latestLoss.month) ? latestLoss : undefined;
  const usurps = events.filter(e => e.type === "dynasty-usurped" && actor(e) && phases.some(p =>
    p.usurpationProven && p.founderId === e.rulerId && p.startMonth === e.month));
  const last = phases.at(-1), previous = phases.at(-2);
  const political = f.ending === "MERGED" || f.ending === "SUBMITTED";
  const terminal = events.filter(e => e.month === f.endMonth && (e.type === "faction-extinct" && e.factionRole === "TARGET" ||
    e.type === "faction-merged" && e.factionRole === "ABSORBED" || e.type === "faction-submitted" && e.factionRole === "SUBMITTED"));
  if (f.terminal && last?.startReason === "NATURAL_HOUSE_SUCCESSION" && last.startMonth === end && previous) {
    add("LONG_HOUSE_SAME_MONTH_END", 135, terminal, ["houseEpochs", "terminationMonth"], [previous.startMonth, last.startMonth],
      `${previous.houseName}相承${historianSpan(last.startMonth - previous.startMonth)}，至${last.founderName ?? last.houseName}自然接统，国家建制却于同月收束。一家传位与一国终局在此交会：新姓虽已承其位，未及展开新的政治阶段；漫长旧统与短暂接续，都属于${f.name}的同一部历史。`);
  }
  const boundaryUsurp = loss && usurps.find(e => e.month === loss.month);
  if (!political && boundaryUsurp && loss) add("USURPATION_FINAL_LOSS", 138, [boundaryUsurp, loss], ["houseEpochs"], [],
    `${phases.find(p => p.startMonth === boundaryUsurp.month && p.founderId === boundaryUsurp.rulerId)?.houseName ?? "新王统"}方夺王统，${loss.cityName ?? "最后据点"}又于同月失守。易代所得是一家之位，失土所改是一国之局；二者相接，使这段历史的转折格外急促${end > loss.month ? `，其后承统仍在流亡中延续${historianSpan(end - loss.month)}` : ""}。`);
  const capitals = getCapitalCaptureEvidence(events);
  const attacks = capitals.filter(actor);
  const attack = attacks.find(e => e.targetFactionId && e.targetFactionId !== f.factionId);
  const defense = attack && capitals.find(e => e.factionRole === "TARGET" && e.month > attack.month);
  if (f.ending === "MERGED" && f.targetFactionId) {
    const former = attacks.find(e => e.targetFactionId === f.targetFactionId && e.month < end);
    if (former) add("FORMER_OPPONENT_UNION", 130, [former, ...terminal], ["terminationTargetFactionId"], [end],
      `${former.factionName}昔曾攻取${former.targetName ?? "对方"}都${former.cityName ?? "城邑"}，${historianSpan(end - former.month)}之后，却以同源合邦并入${f.targetName}。前者是攻守胜负，后者是独立建制的合流；曾经的进取与后来的并入，写在同一国史中，政治分合终非一场战事便能定下。`);
  }
  const splits = events.filter(e => e.type === "empire-split" && e.factionRole === "TARGET");
  // Only directly related splits in three successive calendar years form this contrast.
  const byYear = new Map<number, FactionNarrativeEvidence>();
  splits.forEach(e => { if (!byYear.has(Math.floor(e.month / 12))) byYear.set(Math.floor(e.month / 12), e); });
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const firstYear = years.find(y => byYear.has(y + 1) && byYear.has(y + 2));
  const cluster = firstYear === undefined ? [] : [byYear.get(firstYear)!, byYear.get(firstYear + 1)!, byYear.get(firstYear + 2)!];
  const laterUsurp = cluster.length ? usurps.find(e => e.month > cluster[2].month) : undefined;
  if (cluster.length && laterUsurp) add("SPLITS_AND_LATER_USURPATION", 124, [...cluster, laterUsurp], ["houseEpochs"], [],
    `${cluster[0].factionName}曾在连续三年中屡生分裂，${historianSpan(laterUsurp.month - cluster[2].month)}后，${laterUsurp.rulerName ?? "新的统治者"}又夺王统。疆域分合与王室易代发生于不同阶段，国名相续之下，政治面貌并非始终如一。${f.terminal ? "这些更替共同构成了其独立建制的经历。" : "眼前仍延续的建制，承接的正是这段多次变化的旧史。"}`);
  const peak = f.lifetime.peakTerritoryBlocks;
  if (!political && loss && peak.value > 0 && f.peakAbsoluteWorldShare >= .25 && peak.month < loss.month) {
    const share = f.peakAbsoluteWorldShare >= .5 ? historianTerritory(f.peakAbsoluteWorldShare) : `天下${historianNumber(Math.floor(f.peakAbsoluteWorldShare * 10))}成${Math.abs(f.peakAbsoluteWorldShare * 10 - Math.floor(f.peakAbsoluteWorldShare * 10)) < 1e-9 ? "" : "有余"}`;
    add("PEAK_LAND_AND_EXILE", 120, [loss], ["lifetime.peakTerritoryBlocks", "totalWorldBlocks", "endMonth"], [peak.month, end],
      `盛时曾据${share}，从记录的疆域之峰到${loss.cityName ?? "最后据点"}失守，相距${historianSpan(loss.month - peak.month)}。城土尽失${end > loss.month ? `后，王统仍无土而续${historianSpan(end - loss.month)}` : "与政治终结同在一月"}；拓土之盛与传位之久，原是不同的历史尺度。${f.terminal ? "其国的终篇，既有疆域的丧失，也有土地之外仍延续的承统。" : "流亡尚未成为终篇，昔日强盛与今日无土的对照，仍是截至此时的处境。"}`);
  }
  if (attack && defense && !political) add("ATTACK_DEFENSE_REVERSAL", 112, [attack, defense], [], [],
    `${attack.rulerName ?? attack.factionName}曾攻取${attack.targetName ?? "他国"}都${attack.cityName ?? ""}，${historianSpan(defense.month - attack.month)}后，己都${defense.cityName ?? ""}又失于${defense.actorName ?? "他国"}。进兵所得与守城所失，使攻守两面在此倒转；能取人之都，并不等于能长守己都。${loss && loss.month > defense.month ? `但失都之后，国家至${loss.cityName ?? "最后据点"}再失才转入流亡，前后仍有另一段承续。` : ""}`);
  if (restores.length) add("REAL_RESTORATION", 110, restores, [], [],
    `${restores.map(e => e.cityName).filter(Boolean).slice(0, 2).join("、") || "失去的城土"}曾见独立建制重立，${restores.length > 1 ? "复国不止一次，" : ""}失国遂不只是一条走向终局的直线。能从流亡回到在国承统，是这段历史真正的转折${f.terminal ? "；后来的终结，并不能抹去此前的恢复。" : "；截至此时，延续之中已有失而复续的经历。"}`);
  const landmark = events.find(e => actor(e) && ["emperor-proclaimed", "world-unification", "world-hegemony"].includes(e.type));
  if (landmark && loss && !political) add("POLITICAL_HEIGHT_AND_LOSS", 118, [landmark, loss], [], [],
    `${landmark.factionName}${landmark.type === "emperor-proclaimed" ? "曾称帝" : landmark.type === "world-unification" ? "曾统一天下" : "曾确立霸权"}，及至${loss.cityName ?? "最后据点"}失守，政治地位的高峰已与无土的处境相隔。盛时的名位是真实的，后来失土也同样真实；国史的分量，在这两端之间的转折，而不只在曾经拥有的称号。`);
  if (political) add(f.ending!, 105, terminal, ["ending", "terminationTargetFactionId", "houseEpochs"], [end],
    f.ending === "MERGED" ? `${f.name}曾有独立建制，至终局并入${f.targetName ?? "同源政权"}。合邦所结束的是独立承统，所治城土则转入另一政权；这一结局属于政治合流，与失城流亡的覆灭有别。`
      : `${f.name}以纳土归附${f.targetName ?? "接受国"}结束独立建制，末君以退位收束任期。城土与统治权一同转出，末君退位与国家归附构成同一场政治退场。和平纳土，留下的是与兵争绝统不同的终篇。`);
  if (phases.length > 1) add("HOUSE_CONTINUITY", 90, usurps, ["houseEpochs"], phases.map(p => p.startMonth),
    `一国先后历${historianNumber(phases.length)}段王统，${usurps.length ? "其中确有篡朝夺统，" : "自然承继与政治阶段的变化，"}家姓的传承与国家的延续并非一事。${last?.houseName ?? "后起王统"}承接的是前代已经展开的国家历史${f.terminal ? "，终局亦为各段承统共同的收束。" : "，截至此时仍在续写，而非另起一部与前代无关的国史。"}`);
  if (loss && !political) add("EXILE_CONTINUITY", 85, [loss], ["endMonth"], [end],
    `${loss.factionName}失${loss.cityName ?? "最后据点"}，城池已无，承统${end > loss.month ? `却仍延续${historianSpan(end - loss.month)}` : "亦于同月终结"}。${f.terminal ? "失国与政治终结各有其时；流亡所留下的，是土地丧失之后仍未立即结束的一段国史。" : "失国尚不是这部历史的终篇；如今延续的是流亡王统，而非在国治理。"}`);
  if (!out.length) add("LIMITED_RECORD", 10, [], ["formal", "houseEpochs"], [f.foundedMonth, end],
    f.terminal ? f.formal ? `从正式建国到独立建制结束，${f.name}历${historianNumber(f.rulerCount)}位统治者。现存材料所见，以承接一国之位为主；未见足以另论扩张或中兴的政治转折。`
      : `${f.foundedName}起势后未及正式建国，独立势力便告终结；有开创之名，尚未形成可以长期承接的国家建制。`
      : `${f.name}${f.formal ? "已经立国" : "尚在势力阶段"}，${last?.houseName ?? "现有王统"}仍在延续。眼前可见的是开创与承接，未来的兴亡尚不属于这段已成的历史。`);
  return out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
