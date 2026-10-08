import type { FactionHistoricalEvidence } from "./FactionHistoriography";
import type { FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import { formatWorldDate as date, formatWorldDuration as duration } from "../Simulation/WorldTime";

export interface FactionHistoricalArgument {
  argumentKey: string;
  supportingEventIds: string[];
  supportingMetricKeys: string[];
  relevantMonths: number[];
  relevanceScore: number;
  reason: string;
  axis: "POLITICAL_END" | "WAR_REVERSAL" | "LONGEVITY" | "POWER" | "CAPITALS" | "HOUSE" | "RESTORATION" | "EXILE" | "SCALE";
  judgment: string;
  voice: string;
}
export function getFinalFactionLoss(events: readonly FactionNarrativeEvidence[]) {
  const loss = events.filter(x => x.type === "faction-exiled" && x.factionRole === "TARGET")
    .sort((a, b) => b.month - a.month || a.eventId.localeCompare(b.eventId))[0];
  if (!loss || events.some(x => x.month > loss.month && ["faction-restored", "dynasty-restored"].includes(x.type) && x.factionRole === "ACTOR")) return undefined;
  const capture = events.filter(x => ["capital-fallen", "city-captured"].includes(x.type) && x.factionRole === "TARGET" && x.month === loss.month &&
    ((loss.historyGroupId && loss.historyGroupId === x.historyGroupId) || (loss.cityId && loss.cityId === x.cityId)))
    .sort((a, b) => Number(Boolean(b.rulerName)) - Number(Boolean(a.rulerName)) || a.eventId.localeCompare(b.eventId))[0];
  return { loss, capture };
}
export function getCapitalCaptureEvidence(events: readonly FactionNarrativeEvidence[]) {
  const captures = events.filter(x => x.type === "capital-fallen" || x.type === "city-captured" && x.metadata.wasCapital === 1);
  const seen = new Set<string>();
  return captures.slice().sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId)).filter(x => {
    const key = `${x.month}:${x.historyGroupId ?? `${x.actorFactionId}:${x.targetFactionId}`}:${x.cityId ?? x.cityName}:${x.factionRole}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// Scores select prose only. Every argument names its evidence; none is a simulation rule.
export function deriveFactionHistoricalArguments(e: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[]): FactionHistoricalArgument[] {
  const arguments_: FactionHistoricalArgument[] = [];
  const add = (argumentKey: string, axis: FactionHistoricalArgument["axis"], relevanceScore: number,
    supports: readonly FactionNarrativeEvidence[], supportingMetricKeys: string[], months: number[], reason: string, judgment: string, voice: string) => {
    arguments_.push({ argumentKey, axis, relevanceScore, supportingEventIds: [...new Set(supports.map(x => x.eventId))],
      supportingMetricKeys, relevantMonths: [...new Set([...supports.map(x => x.month), ...months])].sort((a, b) => a - b), reason, judgment, voice });
  };
  const finalLoss = e.ending === "EXTINCT" ? getFinalFactionLoss(events) : undefined;
  const loss = finalLoss?.loss;
  const city = loss?.cityName ?? finalLoss?.capture?.cityName ?? "最后据点";
  const gap = loss ? Math.max(0, e.endMonth! - loss.month) : 0;
  const capitals = getCapitalCaptureEvidence(events);
  const attacks = capitals.filter(x => ["ACTOR", "CONQUEROR"].includes(x.factionRole));
  const defenses = capitals.filter(x => x.factionRole === "TARGET");
  // Captures are chronological: the earliest real attack is sufficient to
  // find the earliest later defensive loss, without a cross-product scan.
  const attack = attacks.find(x => x.targetFactionId !== e.factionId);
  const defense = attack && defenses.find(x => x.month > attack.month && x.eventId !== attack.eventId);
  if (attack && defense) {
    add("ATTACK_DEFENSE_REVERSAL", "WAR_REVERSAL", 108, [attack, defense], [], [], "先攻取他国首都，后自身首都被攻取；两件事件的行动角色与月份不同",
      `${date(attack.month)}曾取${attack.targetName ?? "他国"}都${attack.cityName ?? ""}，${date(defense.month)}又失己都${defense.cityName ?? ""}于${defense.actorName ?? "敌国"}；攻守之势在同一国史中倒转。`,
      `昔日兵锋抵${attack.cityName ?? "他国之都"}，后来${defense.cityName ?? "己都"}亦不能守；夺城之力，终未成为保国之固。`);
  }
  if (loss && e.formalMonths !== undefined && e.formalMonths >= 6000 && e.formalRulerCount >= 10 && gap >= 120) {
    add("LONG_RULE_COLLAPSE", "LONGEVITY", 103, [loss], ["formalMonths", "formalRulerCount", "endMonth"], [e.stateFoundedMonth!, e.endMonth!], "至少500年正式国祚、十位君主与失国后十年以上延续相对照",
      `正式国祚${duration(e.formalMonths)}，历${e.formalRulerCount}君，累世延续最终止于${city}失守后的末路；长统并未消去最后一代的危局。`,
      `${e.formalRulerCount}君相承，足以成就一部长史，却不能替末世留住一城；国祚之长与终局之窘，反相映照。`);
  }
  const landmark = events.filter(x => ["world-unification", "world-hegemony", "emperor-proclaimed"].includes(x.type) && x.factionRole === "ACTOR" && loss && x.month < loss.month)[0];
  if (landmark && loss) {
    const label = landmark.type === "world-unification" ? "统一天下" : landmark.type === "world-hegemony" ? "确立霸权" : "称帝";
    add(landmark.type === "emperor-proclaimed" ? "EMPIRE_COLLAPSE" : "HEGEMONY_REVERSED", "POWER", 97, [landmark, loss], [], [], "真实帝制/霸权/统一节点先于最终失国",
      `${date(landmark.month)}${label}，至${date(loss.month)}失去最后据点；政治地位的极盛与土地尽失，构成其国势最深的落差。`,
      `${label}之名曾立，${city}之土终失；盛名可以传后，不能代城池自守。`);
  }
  const moves = events.filter(x => x.type === "capital-relocated" && x.factionRole === "ACTOR");
  if (moves.length >= 2) {
    add("REPEATED_CAPITAL_MOVES", "CAPITALS", loss ? 100 : 82, [...moves, ...(loss ? [loss] : [])], [], [], "至少两件有记录的迁都，不从国名或终结领土推断迁徙",
      `先后迁都${moves.length}次${loss ? `，最后仍失${city}` : ""}，政权的延续屡次伴随政治中心转移。`,
      `${moves.map(x => x.cityName ?? x.metadata.newCapitalName).filter((x): x is string => typeof x === "string").filter((x, i, all) => all.indexOf(x) === i).slice(0, 3).join("、") || "数处都城"}相继为都；${loss ? "可移其治所，未能永保其疆土。" : "国号可以相续，都城却非一处长守。"}`);
  }
  if (loss && e.peakAbsoluteWorldShare >= 0.5 && e.lifetime.peakTerritoryBlocks.month < loss.month) {
    add("HALF_WORLD_LOSS", "POWER", 92, [loss], ["peakAbsoluteWorldShare", "lifetime.peakTerritoryBlocks"], [e.lifetime.peakTerritoryBlocks.month], "世界过半疆域峰值在最终失国之前；不据终结零领土断言渐进衰落",
      `${date(e.lifetime.peakTerritoryBlocks.month)}曾据世界${(e.peakAbsoluteWorldShare * 100).toFixed(1)}%，其后连${city}亦失；半壁之盛与无土之局，使其兴亡远非寻常守成可比。`,
      `据地曾及天下之半以上，结局却无一城可凭；疆域之广与建制之固，原来不是同一份保障。`);
  }
  if (e.restorationCount >= 2) {
    const restores = events.filter(x => x.type === "faction-restored" && x.factionRole === "ACTOR");
    add("REPEATED_RESTORATION", "RESTORATION", 99, restores, ["restorationCount"], [], "canonical复国次数至少2，区别于仅有还都",
      `复国${e.restorationCount}次，失而复得并非一时回光，而成为其政治生命反复展开的方式。`,
      `一失未便成终局，再立也未便成定局；${e.restorationCount}次复国，尽见建制可续而城土难常。`);
  }
  const usurps = events.filter(x => x.type === "dynasty-usurped" && x.factionRole === "ACTOR");
  const boundaryUsurp = loss && usurps.find(x => x.month === loss.month);
  if (boundaryUsurp && loss) {
    const oldHouse = typeof boundaryUsurp.metadata.oldHouseName === "string" ? boundaryUsurp.metadata.oldHouseName : undefined;
    const newHouse = typeof boundaryUsurp.metadata.newHouseName === "string" ? boundaryUsurp.metadata.newHouseName : undefined;
    const change = oldHouse && newHouse ? `${newHouse}取代${oldHouse}` : "新王统取代旧王统";
    add("SAME_MONTH_USURPATION_LOSS", "HOUSE", 126, [boundaryUsurp, loss], [], [],
      "真实篡朝与最终失国同月；ACTIVE有城硬门决定叙事依赖，不构成因果证据",
      `${date(boundaryUsurp.month)}${change}，发生篡朝；同月${city}失陷，政权失去最后据点。易代与失国相接，构成王统变化与国家处境的鲜明反差。`,
      `${newHouse ?? "新王统"}方接王统，同月便处无土之境；所得为一家之位，未能留住一国之土。`);
  }
  if (e.houseCount > 1) {
    add("HOUSE_STATE_CONTINUITY", "HOUSE", usurps.length ? 106 : e.formalMonths !== undefined && e.formalMonths >= 6000 && e.peakAbsoluteWorldShare >= 0.5 ? 104 : 87, [...usurps, ...(loss ? [loss] : [])],
      ["houseCount", "epochCount", "usurpationCount"], [], "不同王统epoch属于同一faction；只按已记录次数说篡朝",
      `历${e.houseCount}姓、${e.epochCount}段王统${e.usurpationCount ? `，其中篡朝${e.usurpationCount}次` : "，并无篡朝记录"}；王室易姓而国家史相续，国之存亡不等于一家得失。`,
      `历${e.houseCount}姓而仍为一国，${e.usurpationCount ? "王统曾争，" : "易姓未必即是篡夺，"}${loss ? `${city}失守才将王统相续置于无土之境。` : "一家可以退场，国家之名却不必随之终结。"}`);
  }
  if (loss && gap > 0) {
    add("EXILE_CONTINUITY", "EXILE", 69, [loss], ["endMonth"], [e.endMonth!], "最终失国到终结的真实月份差，不等同累计流亡月份",
      `${city}失守后仍延续${duration(gap)}，流亡不是国史之外的空白，而是土地已失、建制未终的一段。`,
      `城池尽失而仍延其统，国之所系，遂不独在城垣；流亡能续一时，却终不能代替立国之土。`);
  }
  if (e.ending === "MERGED" || e.ending === "SUBMITTED") {
    const merged = e.ending === "MERGED";
    const endingEvent = events.filter(x => x.month === e.endMonth && x.factionRole === (merged ? "ABSORBED" : "SUBMITTED"));
    add(merged ? "COMMON_ORIGIN_UNION" : "PEACEFUL_SUBMISSION", "POLITICAL_END", 120, endingEvent,
      ["ending", "targetName", "formalMonths"], [e.endMonth!], merged ? "MERGED仅表示同源政权行政合邦，不证明王室血缘" : "SUBMITTED表示和平纳土和末王退位",
      merged ? `曾独立建国，最终并入${e.targetName ?? "同源政权"}（同源合邦）；独立建制终止，城市与疆域则转入另一政权的延续之中。`
        : `以纳土退位结束独立建制，归附${e.targetName ?? "接受国"}；终局所失为国家独立，末王则以退位结束政治任期。`,
      merged ? `自立与合邦，原是政治分合的两端；${e.name}之名止于独立建制，所治之土则续入${e.targetName ?? "接受国"}。`
        : `舍其独立而存其王室，纳土之终与兵败绝统不同；退位留下的，是另一种政治退场。`);
  }
  if (e.ending === "MERGED" && e.targetFactionId) {
    const formerAttack = attacks.find(x => x.targetFactionId === e.targetFactionId && x.month < e.endMonth! && x.cityName);
    if (formerAttack) {
      const union = events.filter(x => x.type === "faction-merged" && x.factionRole === "ABSORBED" && x.month === e.endMonth);
      add("FORMER_OPPONENT_UNION", "POLITICAL_END", 125, [formerAttack, ...union],
        ["ending", "targetFactionId", "endMonth"], [e.endMonth!],
        "同一稳定接受方ID：曾攻其真实首都，后行政并入；不推断和解动机或血缘",
        `${date(formerAttack.month)}${formerAttack.factionName}曾攻陷${formerAttack.targetName ?? "接受国"}都${formerAttack.cityName}；至${date(e.endMonth!)}，却并入${e.targetName ?? "该国"}（同源合邦）。昔日攻都的一方，最终成为行政并入的一方，政治分合与战事胜负并非同一种结局。`,
        `昔取${formerAttack.targetName ?? "其国"}都${formerAttack.cityName}，终又并入${e.targetName ?? "其国"}；一时兵争之得，不能定后来政治之分合。`);
    }
  }
  if ((e.ending === "MERGED" || e.ending === "SUBMITTED") && e.lifetime.terminal?.cityCount === 1 && e.lifetime.peakCityCount.value >= 3) {
    add("MANY_CITIES_ONE_END", "SCALE", 81, [], ["lifetime.peakCityCount", "lifetime.terminal.cityCount"], [e.lifetime.peakCityCount.month, e.endMonth!], "行政转移前实际仅一城，对比曾经至少三城",
      `盛时拥有${e.lifetime.peakCityCount.value}城，行政终结前仅余一城；最终政治选择发生在国力已远逊昔日的阶段。`,
      `昔日诸城相属，末路只余一城；土地先已收缩，独立建制终又收束。`);
  }
  if (e.formal && e.formalMonths! <= 120) add("SHORT_FORMAL_STATE", "LONGEVITY", 60, [], ["formalMonths", "formalRulerCount"], [e.stateFoundedMonth!, e.endMonth!], "正式国祚不超过十年",
    `正式立国仅${duration(e.formalMonths!)}，建制方立便告终结，开创未能转为长久的承续。`, "成国有其名，承国未有其久；建立建制与守住建制，是两件事。");
  if (e.activeMonths >= 600 && e.lifetime.peakCityCount.value === 1) add("LONG_ONE_CITY", "SCALE", 58, [], ["activeMonths", "lifetime.peakCityCount"], [], "至少50年在国，实测城市峰值仅1，不推测人口与疆域不曾增长",
    "在国历时至少五十年，城市记录却未超过一座；其历史偏于延续一处建制，而非扩展城邑。", "一城足以载数代之史，却未必能开更广之局；所长在续存，所限亦在规模。");
  if (!e.formal && e.lifetimeMonths <= 60) add("SHORT_PROVISIONAL", "LONGEVITY", 65, [], ["lifetimeMonths", "formal"], [e.foundedMonth, e.endMonth!], "未正式建国且存续不超过5年",
    `势力历时${duration(e.lifetimeMonths)}，未及正式建国；兴起与终结挨得很近，尚未形成长久建制。`, "骤起骤终，未及成国；一时之势，终未化为可传之统。");
  if (!arguments_.length) add("RECORDED_DURATION", "LONGEVITY", 10, [], ["lifetimeMonths", "rulerCount", "formal", ...(e.formal ? ["formalMonths", "formalRulerCount"] : [])], [e.foundedMonth, e.endMonth!], "材料不足以支持更具体的盛衰/因果判断",
    e.formal ? `立国${duration(e.formalMonths!)}，历${e.formalRulerCount}君；其可见之业首先是独立建制的承续。` : `未正式建国，势力历时${duration(e.lifetimeMonths)}；一时起势终未化为正式国家。`,
    e.formal ? "成国而能传其位，自有延续之实；终局仍至，建制之存从非永定。" : "势力可以骤起，成国却非仅有其名；独立之势终未长成国家之制。");
  return arguments_.sort((a, b) => b.relevanceScore - a.relevanceScore || a.argumentKey.localeCompare(b.argumentKey));
}
export function selectFactionHistoricalArguments(arguments_: readonly FactionHistoricalArgument[]) {
  const selected: FactionHistoricalArgument[] = [];
  for (const candidate of arguments_) {
    if (selected.length >= 2) break;
    if (selected.some(x => x.axis === candidate.axis)) continue;
    // Avoid saying the same loss/long exile twice in judgment and voice.
    if (candidate.axis === "EXILE" && selected.some(x => ["POWER", "WAR_REVERSAL", "LONGEVITY", "CAPITALS", "HOUSE"].includes(x.axis))) continue;
    selected.push(candidate);
  }
  return selected;
}
