export type NameCulture = "HAN" | "KHITAN" | "JURCHEN" | "MONGOL" | "MANCHU";

export function deriveNameCulture(houseName?: string): NameCulture {
  const house = houseName?.replace(/氏$/, "");
  if (house === "耶律") return "KHITAN";
  if (house === "完颜") return "JURCHEN";
  if (house === "孛儿只斤") return "MONGOL";
  if (house === "爱新觉罗") return "MANCHU";
  return "HAN";
}

export interface AtomicGivenNamePool {
  atomicNames: string[];
}

/** Shared vocabulary, not historical people's identities or kinship evidence. */
export const hanGivenNamePool = {
  singleNames: [..."安昭武文景烈成康惠襄平宣靖威怀玄昶恪恭恺弘琰珩琮璋瑾弼谦衡朔钧湛惟承允宸绍曜澄翊彦修仪朗谌祐穆珣琬敦晏桓桢棣楷植溥济渊泓澈温谅恂慎端毅敏睿达适逵逊融泰雍翰韶颂骞骥璟珏珽璨琨璞璠瑜琦琛珪玠璆琚琇晟晖昱晔旻旸旭昂昉晁晤暄晞昀奕弈卓伦俨侃俭偲佑儒傅任信忠孝廉礼义仁勇刚健启定宁远和甫实直固厚宽肃敬"],
  doubleNamePrefixes: ["子", "伯", "仲", "元", "明", "承", "景", "玄", "怀", "彦", "君", "文", "德", "思", "世", "维", "守", "宗", "廷", "修", "绍", "令", "允", "敬", "崇", "秉", "季", "庭", "孟", "克", "惟", "致"],
  doubleNameSuffixes: ["安", "衡", "宣", "平", "宁", "成", "昭", "远", "和", "恭", "允", "珩", "澄", "绍", "甫", "礼", "义", "仁", "谦", "仪", "达", "之", "卿", "正", "信", "诚", "忠", "贤", "良", "修", "毅", "敬", "济", "康", "佑", "泰", "清", "温", "宽", "睦"],
  doubleNameChancePercent: 55,
};

const commonSurnames = [..."赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕张孔曹严华金魏陶姜戚谢邹喻柏窦章苏潘葛范彭鲁韦马苗方俞任袁柳鲍史唐费薛雷贺倪汤殷罗毕郝邬安常乐于傅皮齐康伍余顾孟黄萧尹姚邵汪毛狄米贝臧计成戴宋茅庞熊纪舒屈项董梁杜阮蓝闵席季贾路娄江童颜郭邱骆高夏蔡田樊胡霍万卢莫房解应宗丁宣邓单洪包左石崔吉龚程邢裴陆荣翁荀羊甄曲封储靳段巫焦侯宁仇栾甘厉祖武刘景詹束龙叶司黎薄白蒲鄂赖卓谭申冉桑桂牛寿边燕温庄晏柴瞿阎连茹习艾向古易廖庾居耿满文寇广禄阙东欧曾关聂晁勾敖辛冷简饶游权盖桓公"];
const compoundSurnames = ["司马", "欧阳", "上官", "夏侯", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "令狐", "宇文"];
const cultureSurnames: Record<Exclude<NameCulture, "HAN">, string[]> = {
  KHITAN: ["耶律", "萧"], JURCHEN: ["完颜", "徒单", "纥石烈", "蒲察"],
  MONGOL: ["孛儿只斤", "弘吉剌", "扎剌亦儿", "兀良合"], MANCHU: ["爱新觉罗", "瓜尔佳", "钮祜禄", "富察"],
};

function identityHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Once at first appointment; independent of WorldRandom position and future polity names. */
export function generateMilitaryPersonalName(input: {
  seed: string; personId: string; sourceUserId: number; bornMonth: number; originalName: string; culture: NameCulture;
}) {
  const key = JSON.stringify([input.seed, input.personId, input.sourceUserId, input.bornMonth, input.originalName]);
  const pick = (salt: string, pool: string[]) => pool[identityHash(`${key}/${salt}`) % pool.length];
  if (input.culture !== "HAN") return pick("surname", cultureSurnames[input.culture]) + pick("given", cultureGivenNamePools[input.culture].atomicNames);
  const surname = pick("surname", identityHash(`${key}/compound`) % 100 < 3 ? compoundSurnames : commonSurnames);
  const given = identityHash(`${key}/length`) % 100 < hanGivenNamePool.doubleNameChancePercent
    ? pick("prefix", hanGivenNamePool.doubleNamePrefixes) + pick("suffix", hanGivenNamePool.doubleNameSuffixes.filter(suffix => suffix !== pick("prefix", hanGivenNamePool.doubleNamePrefixes)))
    : pick("given", hanGivenNamePool.singleNames);
  return surname + given;
}

export const cultureGivenNamePools: Record<Exclude<NameCulture, "HAN">, AtomicGivenNamePool> = {
  KHITAN: { atomicNames: ["乙辛", "只没", "延禧", "罨撒葛", "涅鲁古", "敌烈", "喜隐", "药师奴", "撒剌", "重元", "阿琏", "阿思"] },
  JURCHEN: { atomicNames: ["乌雅束", "讹里朵", "宗干", "宗贤", "希尹", "阿鲁补", "蒲鲁虎", "斡带", "阿懒", "勗", "胡沙虎", "阿离合懑"] },
  MONGOL: { atomicNames: ["察合台", "术赤", "拖雷", "旭烈兀", "阿里不哥", "海都", "脱脱", "月即别", "也速该", "合赞", "答失蛮", "不花"] },
  MANCHU: { atomicNames: ["代善", "多尔衮", "多铎", "阿济格", "莽古尔泰", "济尔哈朗", "岳托", "豪格", "福全", "常宁", "胤祥", "胤禩"] },
};

export const historicalEchoAffinity: Partial<Record<NameCulture, string>> = {
  HAN: "",
  KHITAN: "辽",
  JURCHEN: "金",
  MONGOL: "元",
  MANCHU: "清",
};

export const hanEchoAffinity: Record<string, string> = {
  刘: "汉", 司马: "晋", 杨: "隋", 李: "唐", 赵: "宋", 朱: "明", 曹: "魏", 孙: "吴",
};

/** Split an already established generated name; never generate or change it at a political transition. */
export function splitEstablishedPersonalName(name:string){
 const surnames=[...compoundSurnames,...commonSurnames,...Object.values(cultureSurnames).flat()].sort((a,b)=>b.length-a.length||a.localeCompare(b));
 const surname=surnames.find(s=>name.startsWith(s)&&name.length>s.length);
 return surname?{houseName:`${surname}氏`,givenName:name.slice(surname.length)}:undefined;
}
