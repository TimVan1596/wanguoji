import type { FactionType } from "../Components/Team";
import { NameCulture } from "./NameCulture";
import { recordRuntimeHouse } from "./NameGenerationTelemetry";

export const HAN_SURNAME_WEIGHTS: Record<string, number> = {
  刘: 9, 王: 10, 李: 10, 张: 9, 陈: 9, 杨: 8, 黄: 8, 赵: 8, 吴: 8, 周: 8,
  徐: 7, 孙: 7, 马: 7, 朱: 7, 胡: 7, 郭: 7, 何: 7, 高: 7, 林: 7, 罗: 7,
  郑: 5, 梁: 5, 谢: 5, 宋: 5, 唐: 5, 许: 5, 韩: 5, 冯: 5, 邓: 5, 曹: 5,
  彭: 5, 曾: 5, 萧: 5, 田: 5, 董: 5, 潘: 5, 杜: 5, 叶: 5, 陆: 5, 范: 5,
  尹: 3, 虞: 3, 庞: 3, 温: 3, 顾: 3, 卢: 3, 崔: 3, 贺: 3, 沈: 3, 钟: 3,
  陶: 3, 钱: 3, 严: 3, 薛: 3, 乔: 3, 邵: 3, 戴: 3, 邹: 3, 邢: 3, 侯: 3,
  江: 3, 颜: 3, 柳: 3, 樊: 3, 傅: 3, 雷: 3, 廖: 3, 韦: 3, 石: 3, 白: 3, 孟: 3,
};

const compoundSurnames = ["司马", "公孙", "欧阳", "诸葛", "上官", "夏侯", "东方", "尉迟"];
const cultureClans: Record<Exclude<NameCulture, "HAN">, string[]> = {
  KHITAN: ["耶律"],
  JURCHEN: ["完颜"],
  MONGOL: ["孛儿只斤"],
  MANCHU: ["爱新觉罗"],
};
const minorityCultures: Exclude<NameCulture, "HAN">[] = ["KHITAN", "JURCHEN", "MONGOL", "MANCHU"];
const MINORITY_CULTURE_PERCENT = 4;
const COMPOUND_SURNAME_PERCENT = 4;

export interface DynastySurnameOptions {
  factionType: FactionType;
  existingHouseNames?: Iterable<string | undefined>;
  recentHouseNames?: Iterable<string | undefined>;
  pickIndex?: (max: number) => number;
  compoundRoll?: () => number;
  cultureRoll?: () => number;
  culture?: NameCulture;
}

export function createSuccessorDynastyHouseName(options: DynastySurnameOptions) {
  return createRuntimeDynastyHouseName(options);
}

export function createRuntimeDynastyHouseName(options: DynastySurnameOptions) {
  const pickIndex = options.pickIndex ?? ((max: number) => Phaser.Math.Between(0, max - 1));
  const categoryRoll = options.compoundRoll ?? (() => Phaser.Math.Between(1, 100));
  const cultureRoll = options.cultureRoll ?? (options.compoundRoll ? () => 100 : () => Phaser.Math.Between(1, 100));
  const existing = countHouseNames(options.existingHouseNames ?? []);
  const recent = new Set(normalizeHouseNames(options.recentHouseNames ?? []));

  const selectedCulture = options.culture && options.culture !== "HAN"
    ? options.culture
    : cultureRoll() <= MINORITY_CULTURE_PERCENT
      ? minorityCultures[Math.min(minorityCultures.length - 1, pickIndex(minorityCultures.length))]
      : "HAN";
  if (selectedCulture !== "HAN") {
    const clan = weightedSurnamePick(cultureClans[selectedCulture], existing, recent, pickIndex, 1);
    recordRuntimeHouse(selectedCulture, false, clan);
    return `${clan}氏`;
  }

  const compound = categoryRoll() <= COMPOUND_SURNAME_PERCENT;
  const pool = compound ? compoundSurnames : Object.keys(HAN_SURNAME_WEIGHTS);
  const surname = weightedSurnamePick(pool, existing, recent, pickIndex, compound ? 1 : undefined);
  recordRuntimeHouse("HAN", compound, surname);
  return `${surname}氏`;
}

function weightedSurnamePick(pool: string[], existing: Map<string, number>, recent: Set<string>, pickIndex: (max: number) => number, fixedWeight?: number) {
  const weighted = pool.map((surname, order) => {
    const reusePenalty = Math.pow(0.42, existing.get(`${surname}氏`) ?? 0);
    const recentPenalty = recent.has(`${surname}氏`) ? 0.08 : 1;
    const baseWeight = fixedWeight ?? HAN_SURNAME_WEIGHTS[surname] ?? 1;
    return { surname, order, weight: Math.max(1, Math.round(baseWeight * reusePenalty * recentPenalty)) };
  });
  const knownHistoryCount = [...new Set([...existing.keys(), ...recent])]
    .filter((name) => pool.includes(name.replace(/氏$/, ""))).length;
  const ordered = knownHistoryCount >= 2
    ? weighted.sort((a, b) => b.weight - a.weight || a.order - b.order)
    : weighted;
  const total = ordered.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.max(0, Math.min(total - 1, pickIndex(total)));
  return ordered.find((item) => (roll -= item.weight) < 0)?.surname ?? ordered[ordered.length - 1].surname;
}

export function getRuntimeDynastySurnamePools() {
  return {
    singleSurnames: Object.keys(HAN_SURNAME_WEIGHTS),
    compoundSurnames: [...compoundSurnames],
    minoritySurnames: minorityCultures.flatMap((culture) => cultureClans[culture]),
  };
}

function normalizeHouseNames(values: Iterable<string | undefined>) {
  return [...values].filter((value): value is string => Boolean(value));
}

function countHouseNames(values: Iterable<string | undefined>) {
  const counts = new Map<string, number>();
  normalizeHouseNames(values).forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return counts;
}
