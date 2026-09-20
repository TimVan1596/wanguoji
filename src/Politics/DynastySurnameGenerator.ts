import type { FactionType } from "../Components/Team";

const singleSurnames = [
  "刘", "陈", "杨", "李", "王", "孙", "吴", "郑", "宋", "卫",
  "许", "徐", "陆", "顾", "卢", "崔", "谢", "萧", "沈", "范",
  "贺", "杜", "钟", "陶", "潘", "林", "周", "罗", "高", "何",
  "郭", "马", "朱", "胡", "赵", "钱", "严", "薛", "叶", "乔",
  "尹", "邵", "戴", "邹", "邢", "侯", "虞", "江", "颜", "柳",
  "温", "庞", "樊", "傅", "雷", "廖", "韦", "石", "白", "孟",
];

const compoundSurnames = [
  "司马",
  "公孙",
  "欧阳",
  "诸葛",
  "上官",
  "夏侯",
  "东方",
  "尉迟",
];

export interface DynastySurnameOptions {
  factionType: FactionType;
  existingHouseNames?: Iterable<string | undefined>;
  recentHouseNames?: Iterable<string | undefined>;
  pickIndex?: (max: number) => number;
  compoundRoll?: () => number;
}

export function createRuntimeDynastyHouseName(options: DynastySurnameOptions) {
  const pickIndex = options.pickIndex ?? ((max) => Phaser.Math.Between(0, max - 1));
  const compoundRoll = options.compoundRoll ?? (() => Phaser.Math.Between(1, 100));
  const existing = countHouseNames(options.existingHouseNames ?? []);
  const recent = new Set(normalizeHouseNames(options.recentHouseNames ?? []));
  const preferredPool = compoundRoll() <= 14 ? compoundSurnames : singleSurnames;
  const allCandidates = [...preferredPool, ...singleSurnames, ...compoundSurnames];
  const fresh = allCandidates.filter(
    (surname) => !existing.has(`${surname}氏`) && !recent.has(`${surname}氏`)
  );
  const lowFrequency = allCandidates
    .filter((surname) => !recent.has(`${surname}氏`))
    .sort(
      (a, b) =>
        (existing.get(`${a}氏`) ?? 0) - (existing.get(`${b}氏`) ?? 0) ||
        a.localeCompare(b, "zh-Hans-CN")
    );
  const pool = fresh.length > 0 ? fresh : lowFrequency.length > 0 ? lowFrequency : allCandidates;
  return `${pool[pickIndex(pool.length)]}氏`;
}

export function getRuntimeDynastySurnamePools() {
  return {
    singleSurnames: [...singleSurnames],
    compoundSurnames: [...compoundSurnames],
  };
}

function normalizeHouseNames(values: Iterable<string | undefined>) {
  return [...values].filter((value): value is string => Boolean(value));
}

function countHouseNames(values: Iterable<string | undefined>) {
  const counts = new Map<string, number>();
  normalizeHouseNames(values).forEach((name) => {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return counts;
}
