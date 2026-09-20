interface StateNameSource {
  capitalName?: string;
  founderCityName?: string;
  houseName?: string;
}

const classicalStateNames = [
  "周",
  "晋",
  "宋",
  "卫",
  "鲁",
  "陈",
  "蔡",
  "吴",
  "越",
  "蜀",
  "巴",
  "凉",
  "夏",
  "唐",
  "岐",
  "代",
  "许",
  "徐",
  "梁",
  "郑",
  "汉",
  "商",
  "宁",
  "成",
  "安",
  "平",
  "康",
  "定",
  "襄",
  "衡",
  "邢",
  "邓",
  "虞",
  "虢",
  "郜",
  "莒",
  "滕",
  "薛",
  "郯",
  "江",
  "淮",
  "洛",
  "雍",
  "辽",
  "楚",
  "燕",
  "赵",
  "齐",
  "魏",
  "韩",
  "秦",
];

const directionalPrefixes = ["东", "西", "南", "北", "中", "后", "新"];

export function createStateName(
  source: StateNameSource,
  activeStateNames: Iterable<string> = [],
  historicallyUsedStateNames: Iterable<string> = []
) {
  const active = new Set(activeStateNames);
  const historical = new Set(historicallyUsedStateNames);
  const candidates = createStateNameCandidates(source);
  const firstNeverUsed = candidates.find(
    (name) => !active.has(name) && !historical.has(name)
  );
  if (firstNeverUsed) {
    return firstNeverUsed;
  }
  const expandedNeverUsed = findExpandedName(candidates, active, historical);
  if (expandedNeverUsed) {
    return expandedNeverUsed;
  }
  const firstNonActive = candidates.find((name) => !active.has(name));
  if (firstNonActive) {
    return firstNonActive;
  }
  const expandedNonActive = findExpandedName(candidates, active);
  if (expandedNonActive) {
    return expandedNonActive;
  }
  throw new Error("StateNameGenerator exhausted: no non-numeric state name available");
}

function findExpandedName(
  candidates: string[],
  activeNames: Set<string>,
  historicalNames?: Set<string>
) {
  for (const base of candidates) {
    const expanded = directionalPrefixes
      .map((prefix) => `${prefix}${base}`)
      .find(
        (name) =>
          !activeNames.has(name) &&
          (!historicalNames || !historicalNames.has(name))
      );
    if (expanded) {
      return expanded;
    }
  }
  return undefined;
}

export function createStateNameCandidates(source: StateNameSource) {
  return unique([
    ...cityNameCandidates(source.capitalName),
    ...cityNameCandidates(source.founderCityName),
    houseNameCandidate(source.houseName),
    ...classicalStateNames,
  ]).filter(Boolean);
}

function cityNameCandidates(cityName?: string) {
  if (!cityName) {
    return [];
  }
  const chars = [...cityName].filter((char) => !["新", "大", "小", "城", "都"].includes(char));
  const candidates: string[] = [];
  const last = chars.at(-1);
  const first = chars[0];
  if (last) {
    candidates.push(last);
  }
  if (first && first !== last) {
    candidates.push(first);
  }
  if (chars.length >= 2) {
    const middle = chars[Math.floor((chars.length - 1) / 2)];
    if (middle && middle !== first && middle !== last) {
      candidates.push(middle);
    }
  }
  return candidates;
}

function houseNameCandidate(houseName?: string) {
  return houseName?.replace(/氏$/, "");
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}
