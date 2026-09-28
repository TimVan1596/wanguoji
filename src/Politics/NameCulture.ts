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
