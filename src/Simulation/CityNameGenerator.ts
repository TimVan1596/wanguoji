import { recordCityNameGenerated } from "./CityNamingTelemetry";

export type CityNameCategory = "HISTORICAL_CITY" | "HISTORICAL_REGIONAL" | "STYLIZED" | "GENERATED" | "SINGLE";
export interface CityNameCandidate { name: string; category: CityNameCategory; family?: string; aliasFamily?: string; baseWeight: number }
export type CityNameRng = (maxExclusive: number) => number;

// Traditional city and fortified-settlement names, covering multiple dynastic periods.
const historicalCityNames = [
  "长安", "洛阳", "邺", "成都", "建业", "建康", "金陵", "晋阳", "平城", "襄国",
  "姑臧", "武威", "张掖", "酒泉", "敦煌", "江都", "扬州", "苏州", "杭州", "临安",
  "泉州", "广州", "汴梁", "开封", "应天", "大都", "襄阳", "江陵", "寿春", "南郑",
  "彭城", "下邳", "广陵", "睢阳", "定陶", "即墨", "琅琊", "武安", "宛", "沛",
  "咸阳", "邯郸", "蓟", "临淄", "大梁", "新郑", "郢", "安邑", "陈留", "上党",
  "云中", "平阳", "曲沃", "蒲坂", "高都", "长平", "巨鹿", "信都", "中山", "无终",
  "涿县", "范阳", "渔阳", "卢龙", "柳城", "襄平", "平郭", "安市", "临洮", "上邽",
  "天水", "南安", "略阳", "武都", "阴平", "梓潼", "广汉", "绵竹", "江州", "涪陵",
  "阆中", "汉中", "陈仓", "槐里", "上洛", "武关", "新野", "叶县", "鲁阳", "襄城",
  "许昌", "长社", "阳翟", "荥阳", "成皋", "虎牢", "河阳", "怀县", "野王", "朝歌",
  "黎阳", "白马", "濮阳", "顿丘", "平原", "高唐", "东阿", "历城", "临济", "千乘",
  "昌乐", "莒县", "东海", "郯城", "兰陵", "费县", "开阳", "临沂", "朐县", "盐渎",
  "丹阳", "秣陵", "京口", "姑熟", "历阳", "濡须", "柴桑", "豫章", "南昌", "庐陵",
  "鄱阳", "余干", "会稽", "山阴", "余姚", "句章", "钱塘", "余杭", "富春", "乌程",
  "吴县", "毗陵", "曲阿", "丹徒", "海盐", "嘉兴", "吴兴", "樊城", "江夏", "夏口",
  "武昌", "蒲圻", "公安", "竟陵", "当阳", "夷陵", "长沙", "临湘", "零陵", "桂阳",
  "武陵", "沅陵", "郴县", "衡阳", "始安", "番禺", "合浦", "龙编", "苍梧", "建安",
  "侯官", "晋安", "寿阳", "合肥", "巢县", "庐江", "钟离", "盱眙", "淮阴", "下蔡",
  "陈县", "谯县", "平舆", "上蔡", "汝阴", "安丰", "六安", "舒城", "邓城", "房陵",
  "上庸", "西城", "丹水", "灵州", "平凉", "安定", "高平", "富平", "灵武", "银州",
  "夏州", "延州", "同州", "华州", "耀州", "金城", "河州", "洮州", "岷州", "兰州",
  "瓜州", "沙州", "高昌", "交河", "北庭", "龟兹", "疏勒", "于阗", "襄阳城", "江陵城",
  "姑苏", "平江", "湖州", "宣州", "润州", "常州", "瓜洲", "仪征", "江宁", "上元",
  "金坛", "溧水", "溧阳", "当涂", "芜湖", "池州", "铜陵", "汉阳", "黄州", "蕲春",
  "安陆", "随州", "荆门", "松滋", "枝江", "宜都", "秭归", "巴东", "湘潭", "益阳",
  "岳阳", "巴陵", "永州", "道州", "桂林", "柳州", "梧州", "邕州", "建水", "大理",
  "昆明", "丽江", "贵阳", "遵义", "保宁", "顺庆", "泸州", "嘉州", "眉州", "邛州",
  "雅州", "松州", "重庆", "渝州", "合州", "兴元", "褒城", "沔阳", "成固", "西乡",
  "武林", "永嘉", "东瓯", "海陵", "盐城", "如皋", "江阴", "常熟", "昆山", "吴江",
  "福州", "漳州", "温州", "明州", "越州", "中都", "燕京", "大兴", "真定", "保定",
  "大名", "济南", "归德", "凤阳", "北平", "顺天", "宣府", "宁远", "锦州", "开原",
  "铁岭", "西宁", "固原", "大宁", "上都", "临潢", "辽阳", "盛京", "宁古塔", "乌拉",
];

// Place-based regional names retained as low-weight, period-appropriate alternatives.
const historicalRegionalNames = [
  "巴郡", "蜀郡", "陇西", "北地", "辽西", "河内", "颍川", "汝南", "雁门", "代郡",
  "上谷", "右北平", "辽东郡", "乐浪郡", "南海郡", "桂林郡", "河东", "河西", "弘农", "京兆",
  "冯翊", "扶风", "安定", "天水郡", "武都郡", "汉中郡", "广汉郡", "犍为郡", "巴西郡", "巴东郡",
  "南郡", "江夏郡", "长沙郡", "零陵郡", "桂阳郡", "武陵郡", "会稽郡", "丹阳郡", "吴郡", "豫章郡",
  "庐江郡", "九江郡", "淮南郡", "临淮郡", "广陵郡", "东海郡", "琅琊郡", "北海郡", "济南郡", "齐郡",
  "城阳郡", "东莱郡", "平原郡", "清河郡", "魏郡", "赵郡", "常山郡", "中山郡", "巨鹿郡", "广平郡",
  "河间郡", "渤海郡", "涿郡", "范阳郡", "上党郡", "太原郡", "雁门郡", "西河郡", "上郡", "朔方郡",
  "五原郡", "云中郡", "定襄郡", "张掖郡", "酒泉郡", "敦煌郡", "武威郡", "金城郡", "西平郡", "陇右",
  "河湟", "岭南", "交州", "黔中", "夜郎", "滇池", "南中", "河套", "关中", "中原",
  "江淮", "荆襄", "巴蜀", "三辅", "朔漠",
];

const stylizedNames = ["清溪", "白水", "丹丘", "玄武", "石门", "金堤", "龙渊", "青川", "望舒", "丰泽", "怀远", "昭武", "宁朔", "永丰", "开明", "承安", "宣化", "广武", "武乡", "云梦", "沙丘", "原武", "阳泉", "新丰", "宜春", "建宁", "临川", "曲阳"];
const singleCharacterNames = ["宛", "沛", "鄣", "鄢", "鄚", "鄗", "郫", "郯", "鄄"];
const prefixes = ["安", "平", "宁", "阳", "陵", "原", "河", "川", "武", "兴", "昌", "永", "清", "定", "临", "广", "南", "北", "东", "西", "上", "云", "江", "长", "高", "曲", "蒲", "雁", "丹", "桂"];
const familyTemplates = [
  { family: "river", suffixes: ["津", "浦", "泽", "江", "河"] },
  { family: "frontier", suffixes: ["关", "门", "坂", "台", "亭"] },
  { family: "classic", suffixes: ["邑", "原", "川", "宁", "昌", "兴"] },
  { family: "common-suffix", suffixes: ["陵", "阳", "平", "安", "城"] },
];
export const CITY_NAME_CATEGORY_WEIGHTS: Record<CityNameCategory, number> = { HISTORICAL_CITY: 64, HISTORICAL_REGIONAL: 7, STYLIZED: 14, GENERATED: 13, SINGLE: 2 };
const aliasFamilies: Record<string, string> = {
  "建业": "NANJING", "建康": "NANJING", "金陵": "NANJING", "应天": "NANJING", "南京": "NANJING", "白下": "NANJING", "秣陵": "NANJING", "江宁": "NANJING",
  "大梁": "KAIFENG", "汴梁": "KAIFENG", "开封": "KAIFENG", "汴京": "KAIFENG", "浚仪": "KAIFENG",
  "杭州": "HANGZHOU", "临安": "HANGZHOU", "钱塘": "HANGZHOU", "余杭": "HANGZHOU",
  "长安": "CHANGAN", "西安": "CHANGAN", "京兆": "CHANGAN", "洛阳": "LUOYANG", "洛邑": "LUOYANG",
  "成都": "CHENGDU", "成都府": "CHENGDU", "临淄": "LINZI", "临淄故城": "LINZI",
};
const forbiddenPatterns = [/^新城\d+$/, /^City-?\d+$/i, /^城市\d+$/];

export function createCityName(existingNames: Iterable<string>, recentNames: Iterable<string> = [], rng: CityNameRng = (max) => Math.floor(Math.random() * max)) {
  const used = new Set([...existingNames].map(normalizeCityName));
  const recent = [...recentNames].map(normalizeCityName);
  const available = createCityNameCandidates().filter((candidate) => !used.has(candidate.name) && !isForbiddenCityName(candidate.name));
  if (!available.length) throw new Error("CityNameGenerator exhausted: no non-numeric city name available");

  const categories = [...new Set(available.map((candidate) => candidate.category))];
  const category = weightedPick(categories.map((value) => ({ value, weight: CITY_NAME_CATEGORY_WEIGHTS[value] })), rng);
  const inCategory = available.filter((candidate) => candidate.category === category);
  const selected = weightedPick(inCategory.map((candidate) => ({
    value: candidate,
    weight: getCityNameCandidateWeight(candidate, used, recent),
  })), rng);
  recordCityNameGenerated(selected.name, selected.category);
  return selected.name;
}

export function createCityNameCandidates(): CityNameCandidate[] {
  const candidates: CityNameCandidate[] = [
    ...historicalCityNames.map((name) => makeCandidate(name, "HISTORICAL_CITY", 10)),
    ...historicalRegionalNames.map((name) => makeCandidate(name, "HISTORICAL_REGIONAL", 4)),
    ...stylizedNames.map((name) => makeCandidate(name, "STYLIZED", 4)),
    ...singleCharacterNames.map((name) => makeCandidate(name, "SINGLE", 1)),
  ];
  familyTemplates.forEach((template) => prefixes.forEach((prefix) => template.suffixes.forEach((suffix) => {
    if (prefix !== suffix) candidates.push(makeCandidate(`${prefix}${suffix}`, "GENERATED", 1, template.family));
  })));
  const byName = new Map<string, CityNameCandidate>();
  candidates.forEach((candidate) => {
    const name = normalizeCityName(candidate.name);
    const existing = byName.get(name);
    if (!existing || CITY_NAME_CATEGORY_WEIGHTS[candidate.category] > CITY_NAME_CATEGORY_WEIGHTS[existing.category]) {
      byName.set(name, { ...candidate, name, aliasFamily: aliasFamilies[name] });
    }
  });
  return [...byName.values()];
}

export function getCityNameCandidateWeight(candidate: CityNameCandidate, existingNames: Iterable<string>, recentNames: Iterable<string>) {
  const used = new Set([...existingNames].map(normalizeCityName));
  const recent = [...recentNames].map(normalizeCityName);
  let weight = candidate.baseWeight;
  const alias = candidate.aliasFamily ?? aliasFamilies[candidate.name];
  if (alias && [...used].some((name) => aliasFamilies[name] === alias)) weight *= 0.18;
  if (recent.includes(candidate.name)) weight *= 0.08;
  const candidateFamily = candidate.family ?? inferNameFamily(candidate.name);
  const sameFamilyCount = recent.filter((name) => inferNameFamily(name) === candidateFamily).length;
  if (candidateFamily && sameFamilyCount > 0) weight *= Math.pow(0.72, sameFamilyCount);
  const suffix = [...candidate.name].at(-1) ?? "";
  const sameSuffix = recent.filter((name) => [...name].at(-1) === suffix).length;
  weight *= Math.pow(0.52, sameSuffix);
  if (["阳", "陵", "平", "安", "宁", "江"].includes(suffix)) weight *= 0.72;
  const first = [...candidate.name][0];
  const morphMatches = recent.filter((name) => [...name].length > 1 && [...candidate.name].length > 1 && ([...name][0] === first || [...name].at(-1) === suffix)).length;
  weight *= Math.pow(0.8, morphMatches);
  return Math.max(0.02, weight);
}

function makeCandidate(name: string, category: CityNameCategory, baseWeight: number, family?: string): CityNameCandidate {
  const normalized = normalizeCityName(name);
  return { name: normalized, category, family: family ?? inferNameFamily(normalized), aliasFamily: aliasFamilies[normalized], baseWeight };
}

function inferNameFamily(name: string) {
  const suffix = [...normalizeCityName(name)].at(-1);
  if (!suffix) return undefined;
  if (["津", "浦", "泽", "江", "河"].includes(suffix)) return "river";
  if (["关", "门", "坂", "台", "亭"].includes(suffix)) return "frontier";
  if (["邑", "原", "川", "宁", "昌", "兴"].includes(suffix)) return "classic";
  if (["陵", "阳", "平", "安", "城"].includes(suffix)) return "common-suffix";
  return undefined;
}

function weightedPick<T>(items: Array<{ value: T; weight: number }>, rng: CityNameRng): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  // Draw on a fixed integer scale so Phaser's integer RNG remains valid even
  // when recent-name penalties make the candidate weights fractional.
  const unit = Math.max(0, Math.min(999_999, rng(1_000_000))) / 1_000_000;
  let roll = unit * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function normalizeCityName(name: string) { return name.trim().replace(/\s+/g, ""); }
export function isForbiddenCityName(name: string) { return forbiddenPatterns.some((pattern) => pattern.test(normalizeCityName(name))); }
