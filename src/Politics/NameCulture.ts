export type NameCulture = "HAN" | "KHITAN" | "JURCHEN" | "MONGOL" | "MANCHU";

export function deriveNameCulture(houseName?: string): NameCulture {
  const house = houseName?.replace(/氏$/, "");
  if (house === "耶律") return "KHITAN";
  if (house === "完颜") return "JURCHEN";
  if (house === "孛儿只斤") return "MONGOL";
  if (house === "爱新觉罗") return "MANCHU";
  return "HAN";
}

export const cultureGivenNamePools: Record<Exclude<NameCulture, "HAN">, { singleNames: string[]; doubleNamePrefixes: string[]; doubleNameSuffixes: string[] }> = {
  KHITAN: { singleNames: ["阿保机", "德光", "隆绪", "洪基", "延禧"], doubleNamePrefixes: ["耶律", "阿保"], doubleNameSuffixes: ["德光", "隆绪", "洪基"] },
  JURCHEN: { singleNames: ["阿骨打", "吴乞买", "宗望", "宗弼", "亮"], doubleNamePrefixes: ["完颜", "宗", "乌"], doubleNameSuffixes: ["阿骨打", "宗望", "宗弼"] },
  MONGOL: { singleNames: ["铁木真", "窝阔台", "贵由", "蒙哥", "忽必烈"], doubleNamePrefixes: ["帖木", "孛儿", "忽"], doubleNameSuffixes: ["真", "台", "必烈"] },
  MANCHU: { singleNames: ["努尔哈赤", "皇太极", "福临", "玄烨", "胤禛"], doubleNamePrefixes: ["努尔", "皇太", "爱新"], doubleNameSuffixes: ["哈赤", "极", "觉罗"] },
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
