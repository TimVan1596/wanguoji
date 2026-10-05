import type { WorldEvent } from "./WorldHistory";
import type { WorldEra } from "../Simulation/WorldEra";
import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type Team from "../Components/Team";
import { getFactionDisplayNameAtMonth, getSovereigntyRankAtMonth } from "../Simulation/FactionIdentity";
import { resolveHistoricalRulerDisplay } from "../Politics/HistoricalRulerDisplay";
import { resolveEraDisplayLabel } from "../Simulation/WorldEra";
import { deriveRulerHistoricalEvidence, type RulerHistoricalEvidence } from "../Politics/RulerHistoriography";
import { formatWorldDate } from "../Simulation/WorldTime";

export type WorldRecordSection = "CORE" | "RULER" | "POLITY" | "ERA";
export interface WorldRecord {
  id: string;
  section: WorldRecordSection;
  label: string;
  value: string;
  detail?: string;
  importance?: number;
}

type RecordFaction = Pick<Team, "name" | "displayName" | "nameHistory" | "firstFoundedYear" | "sovereigntyRank" | "sovereigntyHistory"> & {
  getCumulativeActiveYears: (worldMonth: number) => number;
  identityStage: "PROVISIONAL" | "STATE";
  stateFoundedMonth?: number;
  origin?: { foundingRulerId?: string };
};

interface RulerEntry {
  dynasty: Dynasty;
  ruler: Ruler;
  factionId: string;
  formalStart: number;
  reignMonths: number;
  evidence: RulerHistoricalEvidence;
}

const CITY_TRANSITION_TYPES = new Set<WorldEvent["type"]>([
  "city-captured", "city-recovered", "city-revolt", "capital-fallen",
]);
const RECORD_IMPORTANCE: Record<string, number> = {
  "peak-expansion": 120, "territory-loss": 115, "peak-retreat": 110,
  "capital-losses": 100, rebellions: 95, "cities-lost": 90,
  "heir-troubles": 85, "shortest-reign": 80, "most-relocations": 120,
  "most-restorations": 115, "most-city-turnover": 110, "most-capital-falls": 105,
  "most-generations": 90, "densest-era": 110, "longest-era": 80,
};

export function getMaxRecordHolders<T>(items: T[], score: (item: T) => number, stableKey: (item: T) => string = String) {
  return getRecordHolders(items, score, stableKey, "max");
}

export function getMinRecordHolders<T>(items: T[], score: (item: T) => number, stableKey: (item: T) => string = String) {
  return getRecordHolders(items, score, stableKey, "min");
}

function getRecordHolders<T>(items: T[], score: (item: T) => number, stableKey: (item: T) => string, mode: "min" | "max") {
  const eligible = items.filter((item) => Number.isFinite(score(item)));
  if (!eligible.length) return [];
  const best = eligible.reduce((value, item) => mode === "max" ? Math.max(value, score(item)) : Math.min(value, score(item)), score(eligible[0]));
  return eligible.filter((item) => score(item) === best).sort((a, b) => stableKey(a).localeCompare(stableKey(b), "zh-CN"));
}

export function formatRecordHolders<T>(holders: T[], format: (holder: T) => string, metric: string, unit = "", groupNoun = "人") {
  if (!holders.length) return "";
  const names = holders.slice(0, 3).map(format).join("、");
  const suffix = holders.length > 3 ? `${names}等${holders.length}${groupNoun}` : names;
  return `${suffix} · ${holders.length > 1 ? "各" : ""}${metric}${unit}`;
}

export function deriveWorldRecords(
  dynasties: Dynasty[], teams: RecordFaction[], events: WorldEvent[], eras: WorldEra[], worldMonth = 0
): WorldRecord[] {
  const factions = new Map(teams.map((team) => [team.name, team]));
  const rulerById = new Map(dynasties.flatMap((dynasty) => dynasty.rulers.map((ruler) => [ruler.id, ruler] as const)));
  const entries: RulerEntry[] = dynasties.flatMap((dynasty) => dynasty.rulers
    .filter((ruler) => ruler.accessionYear !== undefined && ruler.reignOrdinal !== undefined && ruler.chronicle !== undefined)
    .filter((ruler) => ruler.accessionYear! >= ruler.bornYear && isFormalFaction(factions.get(dynasty.factionId), ruler.accessionYear!))
    .map((ruler) => {
      const faction = factions.get(dynasty.factionId);
      const formalStart = Math.max(ruler.accessionYear!, faction?.stateFoundedMonth ?? ruler.accessionYear!);
      return {
        dynasty, ruler, factionId: dynasty.factionId, formalStart,
        reignMonths: Math.max(0, (ruler.endYear ?? worldMonth) - formalStart),
        evidence: deriveRulerHistoricalEvidence({ ruler, dynasty, faction: faction ?? { name: dynasty.factionId }, events, worldMonth }),
      };
    }));
  const rulerLabel = (entry: RulerEntry) => {
    const faction = factions.get(entry.factionId);
    const month = entry.ruler.endYear ?? worldMonth;
    const stateName = faction ? getFactionDisplayNameAtMonth(faction, month) : entry.factionId;
    return resolveHistoricalRulerDisplay(entry.ruler, stateName, "compact", {
      historicalRank: faction ? getSovereigntyRankAtMonth(faction, month) : undefined,
    });
  };
  const factionLabel = (id: string, month = worldMonth) => {
    const faction = factions.get(id);
    return faction ? getFactionDisplayNameAtMonth(faction, month) : id;
  };
  const records: WorldRecord[] = [];
  const addRulerMax = (id: string, label: string, candidates: RulerEntry[], score: (entry: RulerEntry) => number, value: (entry: RulerEntry) => string, detail?: (entry: RulerEntry) => string, min = false) => {
    const eligible = candidates.filter((entry) => score(entry) > 0);
    const holders = min
      ? getMinRecordHolders(eligible, score, (entry) => `${entry.formalStart}:${entry.ruler.id}`)
      : getMaxRecordHolders(eligible, score, (entry) => `${entry.formalStart}:${entry.ruler.id}`);
    if (!holders.length) return;
    const metric = value(holders[0]);
    records.push({ id, section: "RULER", label, value: formatRecordHolders(holders, rulerLabel, metric, ""), detail: detail?.(holders[0]), importance: RECORD_IMPORTANCE[id] ?? 0 });
  };

  addRulerMax("longest-reign", "最长正式在位", entries, (e) => e.reignMonths, (e) => duration(e.reignMonths));
  addRulerMax("youngest-accession", "最年幼正式即位", entries, (e) => e.formalStart - e.ruler.bornYear, (e) => age(e.formalStart - e.ruler.bornYear), undefined, true);
  addRulerMax("personal-captures", "亲征夺城最多", entries, (e) => e.evidence.personalCityCaptures, (e) => `${e.evidence.personalCityCaptures}座`);

  addRulerMax("longest-life", "最长寿君主", entries.filter((e) => e.ruler.endYear !== undefined && e.evidence.finalAge !== undefined), (e) => e.evidence.finalAge ?? 0, (e) => `${e.evidence.finalAge}岁`);
  addRulerMax("oldest-accession", "最高龄即位", entries, (e) => e.formalStart - e.ruler.bornYear, (e) => `${Math.floor((e.formalStart - e.ruler.bornYear) / 12)}岁`);
  addRulerMax("shortest-reign", "最短正式在位", entries.filter((e) => e.ruler.endYear !== undefined && e.reignMonths >= 1), (e) => e.reignMonths, (e) => duration(e.reignMonths), undefined, true);
  addRulerMax("peak-expansion", "最大峰值扩张", entries, (e) => e.evidence.territorialPeakGain, (e) => `+${pp(e.evidence.territorialPeakGain)}`, (e) => `即位${percent(e.evidence.startTerritory)} → 峰值${percent(e.evidence.peakTerritory)}`);
  addRulerMax("territory-loss", "最大失土", entries, (e) => e.evidence.startTerritory - e.evidence.endTerritory, (e) => `-${pp(e.evidence.startTerritory - e.evidence.endTerritory)}`);
  addRulerMax("peak-retreat", "盛极而衰最剧", entries, (e) => e.evidence.territorialPeakRetreat, (e) => `峰值回落${pp(e.evidence.territorialPeakRetreat)}`);
  addRulerMax("cities-lost", "失城最多", entries, (e) => e.evidence.citiesLost, (e) => `${e.evidence.citiesLost}座`);
  addRulerMax("rebellions", "内乱最多", entries, (e) => e.evidence.rebellions, (e) => `${e.evidence.rebellions}次`);
  addRulerMax("capital-losses", "失都最多", entries, (e) => e.evidence.forcedCapitalRelocationsDuringReign, (e) => `${e.evidence.forcedCapitalRelocationsDuringReign}次`);
  addRulerMax("heir-troubles", "储嗣多舛", entries.filter((e) => e.evidence.predeceasedHeirCount >= 2), (e) => e.evidence.predeceasedHeirCount, (e) => `${e.evidence.predeceasedHeirCount}名继承人先亡`);

  const formalFactions = teams.filter((team) => isFormalFaction(team, team.stateFoundedMonth ?? 0));
  const longestFaction = getMaxRecordHolders(formalFactions, (team) => formalFactionMonths(team, worldMonth), (team) => team.name);
  addFactionRecord(records, "longest-state", "最长国祚", longestFaction, factions, worldMonth, (team) => duration(formalFactionMonths(team, worldMonth)));

  const emperorEvents = events.filter((event) => event.type === "emperor-proclaimed");
  addEarliestEventRecord(records, "earliest-emperor", "最早称帝", emperorEvents, rulerById, factionLabel, factions);
  const unificationEvents = events.filter((event) => event.type === "world-unification");
  addEarliestEventRecord(records, "first-unification", "首次统一天下", unificationEvents, rulerById, factionLabel, factions);

  const relocations = dedupeGroupedFactionEvents(events.filter((e) => e.type === "capital-relocated" && e.actorFactionId));
  addFactionEventMax(records, "most-relocations", "迁都最多", tallyByFaction(relocations, (event) => event.actorFactionId!), factions, worldMonth, "次");
  const restorations = dedupeGroupedFactionEvents(events.filter((e) => e.type === "faction-restored" && e.actorFactionId));
  addFactionEventMax(records, "most-restorations", "复国最多", tallyByFaction(restorations, (event) => event.actorFactionId!), factions, worldMonth, "次");
  const generations = dynasties.map((dynasty) => ({
    factionId: dynasty.factionId,
    count: entries.filter((entry) => entry.factionId === dynasty.factionId).length,
    lastMonth: Math.max(0, ...entries.filter((entry) => entry.factionId === dynasty.factionId).map((entry) => entry.formalStart)),
  })).filter((entry) => entry.count > 0);
  addFactionCountMax(records, "most-generations", "君主世代最多", generations, factions, worldMonth, "代");

  const transitions = dedupeCityTransitions(events.filter((event) => CITY_TRANSITION_TYPES.has(event.type)));
  const turnoverCounts = tallyByCity(transitions);
  addCityMax(records, "most-city-turnover", "易手最多城市", turnoverCounts, "次");
  const capitalFalls = dedupeCityTransitions(events.filter((event) => event.type === "capital-fallen"));
  addCityMax(records, "most-capital-falls", "首都陷落最多", tallyByCity(capitalFalls), "次");

  const eraDurations = eras.map((era) => ({ era, months: Math.max(0, (era.endMonth ?? worldMonth) - era.startMonth) }));
  const longestEra = getMaxRecordHolders(eraDurations, (item) => item.months, (item) => `${item.era.startMonth}:${item.era.id}`);
  if (longestEra.length) {
    records.push({
      id: "longest-era", section: "ERA", label: "最长时代",
      value: formatRecordHolders(longestEra, (item) => safeEraLabel(item.era, factions), duration(longestEra[0].months), "", "时代"),
    });
  }
  const denseEras = eraDurations.filter((item) => item.months >= 120).map(({ era, months }) => {
    const inEra = events.filter((event) => {
      const month = event.monthIndex ?? event.year;
      return month >= era.startMonth && month <= (era.endMonth ?? worldMonth) && event.importance === "major";
    });
    const groups = new Set(inEra.map((event) => event.historyGroupId ?? event.id));
    return { era, months, density: groups.size / months * 1200, count: groups.size };
  });
  const densest = getMaxRecordHolders(denseEras.filter((item) => item.count > 0), (item) => item.density, (item) => `${item.era.startMonth}:${item.era.id}`);
  if (densest.length) records.push({
    id: "densest-era", section: "ERA", label: "重大事件最密集时代",
    value: formatRecordHolders(densest, (item) => safeEraLabel(item.era, factions), `每百年${formatDecimal(densest[0].density)}件重大事件`, "", "时代"),
    detail: `按时代持续${duration(densest[0].months)}归一化；同一历史分组只计一次。`,
  });

  // Keep the original seven core records visible while preserving the richer records by subject.
  const originalCore = records.filter((record) => ["longest-reign", "youngest-accession", "personal-captures", "longest-state", "earliest-emperor", "first-unification"].includes(record.id));
  originalCore.forEach((record) => { record.section = "CORE"; });
  records.forEach((record) => { record.importance ??= RECORD_IMPORTANCE[record.id] ?? 0; });
  return records.sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section) || (b.importance ?? 0) - (a.importance ?? 0) || a.id.localeCompare(b.id));
}

function addEarliestEventRecord(records: WorldRecord[], id: string, label: string, events: WorldEvent[], rulers: Map<string, Ruler>, factionLabel: (id: string, month?: number) => string, factions: Map<string, RecordFaction>) {
  if (!events.length) return;
  const earliest = events.reduce((minimum, event) => Math.min(minimum, event.monthIndex ?? event.year), Infinity);
  const holders = events.filter((event) => (event.monthIndex ?? event.year) === earliest).sort((a, b) => a.id.localeCompare(b.id));
  const names = holders.slice(0, 3).map((event) => {
    const month = event.monthIndex ?? event.year;
    const factionId = event.actorFactionId ?? event.factionIds?.[0];
    const faction = factionId ? factions.get(factionId) : undefined;
    const ruler = event.rulerId ? rulers.get(event.rulerId) : undefined;
    if (ruler && faction) return resolveHistoricalRulerDisplay(ruler, factionLabel(faction.name, month), "compact", { historicalRank: getSovereigntyRankAtMonth(faction, month) });
    return factionId ? factionLabel(factionId, month) : event.title;
  });
  const suffix = holders.length > 3 ? `等${holders.length}方` : names.join("、");
  records.push({ id, section: "CORE", label, value: `${formatWorldDate(earliest)} · ${suffix}` });
}

function addFactionRecord(records: WorldRecord[], id: string, label: string, holders: RecordFaction[], factions: Map<string, RecordFaction>, month: number, metric: (team: RecordFaction) => string) {
  if (!holders.length) return;
  records.push({ id, section: "POLITY", label, value: formatRecordHolders(holders, (team) => factions.has(team.name) ? getFactionDisplayNameAtMonth(team, month) : team.displayName ?? team.name, metric(holders[0]), "", "势力") });
}

function addFactionEventMax(records: WorldRecord[], id: string, label: string, counts: Map<string, number>, factions: Map<string, RecordFaction>, month: number, unit: string) {
  const holders = getMaxRecordHolders([...counts].map(([factionId, count]) => ({ factionId, count })), (item) => item.count, (item) => item.factionId);
  if (!holders.length || holders[0].count <= 0) return;
  const names = holders.slice(0, 3).map((item) => factionName(item.factionId, factions, month));
  const subject = holders.length > 3 ? `${names.join("、")}等${holders.length}势力` : names.join("、");
  records.push({ id, section: "POLITY", label, value: `${subject} · ${holders.length > 1 ? "各" : ""}${holders[0].count}${unit}` });
}

function addFactionCountMax(records: WorldRecord[], id: string, label: string, items: { factionId: string; count: number; lastMonth: number }[], factions: Map<string, RecordFaction>, month: number, unit: string) {
  const holders = getMaxRecordHolders(items, (item) => item.count, (item) => `${item.lastMonth}:${item.factionId}`);
  if (!holders.length || holders[0].count <= 0) return;
  const names = holders.slice(0, 3).map((item) => factionName(item.factionId, factions, month));
  records.push({ id, section: "POLITY", label, value: `${holders.length > 3 ? `${names.join("、")}等${holders.length}势力` : names.join("、")} · ${holders.length > 1 ? "各" : ""}${holders[0].count}${unit}` });
}

function addCityMax(records: WorldRecord[], id: string, label: string, counts: Map<string, { name: string; count: number }>, unit: string) {
  const holders = getMaxRecordHolders([...counts.values()], (item) => item.count, (item) => item.name);
  if (!holders.length || holders[0].count <= 0) return;
  const names = holders.slice(0, 3).map((item) => item.name);
  records.push({ id, section: "POLITY", label, value: `${holders.length > 3 ? `${names.join("、")}等${holders.length}城` : names.join("、")} · ${holders.length > 1 ? "各" : ""}${holders[0].count}${unit}` });
}

function dedupeGroupedFactionEvents(events: WorldEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.actorFactionId}:${event.historyGroupId ?? event.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeCityTransitions(events: WorldEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const city = event.cityId ? `id:${event.cityId}` : `name:${event.cityName ?? "unknown"}`;
    const key = `${city}:${event.historyGroupId ?? event.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tallyByFaction(events: WorldEvent[], faction: (event: WorldEvent) => string) {
  const counts = new Map<string, number>();
  events.forEach((event) => counts.set(faction(event), (counts.get(faction(event)) ?? 0) + 1));
  return counts;
}

function tallyByCity(events: WorldEvent[]) {
  const counts = new Map<string, { name: string; count: number }>();
  events.forEach((event) => {
    const key = event.cityId ? `id:${event.cityId}` : `name:${event.cityName ?? "未知城市"}`;
    const current = counts.get(key) ?? { name: event.cityName ?? "未知城市", count: 0 };
    current.count += 1;
    counts.set(key, current);
  });
  return counts;
}

function factionName(id: string, factions: Map<string, RecordFaction>, month: number) {
  const faction = factions.get(id);
  return faction ? getFactionDisplayNameAtMonth(faction, month) : id;
}

function safeEraLabel(era: WorldEra, factions: Map<string, RecordFaction>) {
  return resolveEraDisplayLabel(era, factions) || era.name || era.type;
}

function isFormalFaction(faction: RecordFaction | undefined, month: number) {
  return Boolean(faction && (faction.identityStage !== "PROVISIONAL" || faction.stateFoundedMonth !== undefined && faction.stateFoundedMonth <= month));
}

function formalFactionMonths(faction: RecordFaction, worldMonth: number) {
  const start = faction.stateFoundedMonth ?? faction.firstFoundedYear;
  return Math.max(0, faction.getCumulativeActiveYears(worldMonth) - Math.max(0, start - faction.firstFoundedYear));
}

function sectionOrder(section: WorldRecordSection) { return ({ CORE: 0, RULER: 1, POLITY: 2, ERA: 3 })[section]; }
function duration(months: number) { const years = Math.floor(months / 12); const remainder = months % 12; return remainder === 0 ? `${years}年` : `${years}年${remainder}个月`; }
function age(months: number) { return `${Math.floor(months / 12)}岁${months % 12}个月`; }
function percent(value: number) { return `${formatDecimal(value * 100)}%`; }
function pp(value: number) { return `${formatDecimal(value * 100)}pp`; }
function formatDecimal(value: number) { return Number(value.toFixed(1)).toString(); }
