const curatedAncientNames = [
  "安邑",
  "广陵",
  "武安",
  "临江",
  "江陵",
  "云中",
  "上党",
  "陈留",
  "北地",
  "新安",
  "永宁",
  "清河",
  "定陶",
  "长平",
  "河内",
  "平原",
  "雁门",
  "辽西",
  "巨鹿",
  "会稽",
  "丹阳",
  "寿春",
  "宛城",
  "番禺",
  "桂阳",
  "零陵",
  "汉中",
  "巴郡",
  "蜀郡",
  "临洮",
  "陇西",
  "高平",
  "阳翟",
  "曲沃",
  "蒲坂",
  "即墨",
  "琅琊",
  "下邳",
  "彭城",
  "睢阳",
  "颍川",
  "汝南",
  "襄阳",
  "江夏",
  "长沙",
  "衡阳",
  "庐江",
  "会宁",
  "武昌",
  "临湘",
  "平阳",
  "武陵",
  "河阳",
  "晋阳",
  "南阳",
  "安陵",
  "平陵",
  "昌平",
  "安平",
  "东阳",
  "西陵",
];

const compoundNames = [
  "清溪",
  "白水",
  "丹丘",
  "玄武",
  "石门",
  "金堤",
  "龙渊",
  "青川",
  "望舒",
  "建宁",
  "丰泽",
  "怀远",
  "宜春",
  "昭武",
  "宁朔",
  "永丰",
  "开明",
  "承安",
  "宣化",
  "济北",
  "广武",
  "临川",
  "武乡",
  "曲阳",
  "云梦",
  "沙丘",
  "高都",
  "原武",
  "新丰",
  "阳泉",
];

const singleCharacterNames = ["宛", "沛", "鄣", "鄢", "鄚", "鄗", "郫", "郯", "鄄"];

const prefixes = [
  "安",
  "平",
  "宁",
  "阳",
  "陵",
  "原",
  "河",
  "川",
  "武",
  "兴",
  "昌",
  "永",
  "清",
  "定",
  "临",
  "广",
  "南",
  "北",
  "东",
  "西",
  "上",
  "云",
  "江",
  "长",
  "高",
  "曲",
  "蒲",
  "雁",
  "丹",
  "桂",
];

const familyTemplates = [
  { family: "river", suffixes: ["津", "浦", "泽", "江", "河"] },
  { family: "frontier", suffixes: ["关", "门", "坂", "台", "亭"] },
  { family: "classic", suffixes: ["邑", "原", "川", "宁", "昌", "兴"] },
  { family: "common-suffix", suffixes: ["陵", "阳", "平", "安", "城"] },
];

const forbiddenPatterns = [/^新城\d+$/, /^City-?\d+$/i, /^城市\d+$/];

interface Candidate {
  name: string;
  family: string;
}

export function createCityName(
  existingNames: Iterable<string>,
  recentNames: Iterable<string> = []
) {
  const used = new Set([...existingNames].map(normalizeCityName));
  const candidates = createCityNameCandidates();
  const recent = [...recentNames].map(normalizeCityName);
  const ranked = candidates
    .filter((candidate) => !used.has(candidate.name) && !isForbiddenCityName(candidate.name))
    .sort((a, b) => scoreCandidate(a, recent) - scoreCandidate(b, recent));

  if (ranked[0]) {
    return ranked[0].name;
  }

  throw new Error("CityNameGenerator exhausted: no non-numeric city name available");
}

export function createCityNameCandidates(): Candidate[] {
  const candidates: Candidate[] = [
    ...curatedAncientNames.map((name) => ({ name, family: "curated" })),
    ...compoundNames.map((name) => ({ name, family: "compound" })),
    ...singleCharacterNames.map((name) => ({ name, family: "single" })),
  ];

  familyTemplates.forEach((template) => {
    prefixes.forEach((prefix) => {
      template.suffixes.forEach((suffix) => {
        if (prefix === suffix) {
          return;
        }
        candidates.push({
          name: `${prefix}${suffix}`,
          family: template.family,
        });
      });
    });
  });

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = normalizeCityName(candidate.name);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    candidate.name = normalized;
    return true;
  });
}

function scoreCandidate(candidate: Candidate, recentNames: string[]) {
  const lastChar = candidate.name.slice(-1);
  const recentLastChars = recentNames.map((name) => name.slice(-1));
  const suffixPenalty = recentLastChars.filter((char) => char === lastChar).length * 24;
  const commonSuffixPenalty = ["陵", "阳", "平"].includes(lastChar) ? 6 : 0;
  const familyPenalty =
    candidate.family === "common-suffix"
      ? 18
      : candidate.family === "single"
      ? 10
      : candidate.family === "compound"
      ? 2
      : 0;
  return suffixPenalty + commonSuffixPenalty + familyPenalty;
}

export function normalizeCityName(name: string) {
  return name.trim().replace(/\s+/g, "");
}

export function isForbiddenCityName(name: string) {
  const normalized = normalizeCityName(name);
  return forbiddenPatterns.some((pattern) => pattern.test(normalized));
}
