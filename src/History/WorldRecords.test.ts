import { describe, expect, it } from "vitest";
import { deriveWorldRecords, formatRecordHolders, getMaxRecordHolders } from "./WorldRecords";

const faction = (name: string, extra: Record<string, unknown> = {}) => ({
  name, displayName: name, firstFoundedYear: 0, identityStage: "STATE", stateFoundedMonth: 0,
  nameHistory: [{ name, startMonth: 0 }], sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }],
  cumulativeActiveYears: 100, getCumulativeActiveYears: () => 1200, ...extra,
});
const ruler = (id: string, extra: Record<string, unknown> = {}) => ({
  id, houseName: "嬴氏", givenName: "平", bornYear: 0, accessionYear: 120, endYear: 240,
  reignOrdinal: 1, endReason: "去世", status: "dead", deathMonth: 240, deathReason: "去世",
  chronicle: {
    accessionSnapshot: { month: 120, population: 10, territoryShare: 0.2, cityCount: 2, stability: 70 },
    endSnapshot: { month: 240, population: 12, territoryShare: 0.4, cityCount: 5, stability: 75 },
    latestSnapshot: { month: 240, population: 12, territoryShare: 0.4, cityCount: 5, stability: 75 },
    notableEventIds: [], citiesCapturedPersonally: 2, citiesLostDuringReign: 1,
    rebellionsDuringReign: 1, restorationsDuringReign: 0, completedUnification: false,
    peakTerritoryShare: 0.6, peakPopulation: 12,
  }, ...extra,
});
const event = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id, year: 10, monthIndex: 10, category: "politics", type, title: id, importance: "major", ...extra,
});
const records = (ds: any[] = [], es: any[] = [], eras: any[] = [], teams: any[] = [faction("秦")]) =>
  deriveWorldRecords(ds, teams as any, es as any, eras as any, 1200);

describe("world records and curiosities", () => {
  it("preserves the original seven objective records", () => {
    const ds = [{ factionId: "秦", rulers: [ruler("r1")] }];
    const es = [event("emperor", "emperor-proclaimed", { actorFactionId: "秦", rulerId: "r1" }), event("unify", "world-unification", { actorFactionId: "秦" })];
    const result = records(ds, es, [{ id: "era", name: "群雄争衡", startMonth: 0, endMonth: 120, confirmedMonth: 0, dominantFactionIds: [], type: "MULTIPOLAR" }]);
    for (const label of ["最长正式在位", "最年幼正式即位", "亲征夺城最多", "最长国祚", "最早称帝", "首次统一天下", "最长时代"]) {
      expect(result.some((record) => record.label === label)).toBe(true);
    }
  });

  it("derives ruler expansion from peak minus accession and distinguishes loss and retreat", () => {
    const result = records([{ factionId: "秦", rulers: [ruler("r1")] }]);
    expect(result.find((record) => record.id === "peak-expansion")?.value).toContain("+40pp");
    expect(result.find((record) => record.id === "peak-expansion")?.detail).toContain("即位20% → 峰值60%");
    expect(result.find((record) => record.id === "territory-loss")).toBeUndefined();
    expect(result.find((record) => record.id === "peak-retreat")?.value).toContain("峰值回落20pp");
    expect(result.find((record) => record.id === "cities-lost")?.value).toContain("1座");
    expect(result.find((record) => record.id === "rebellions")?.value).toContain("1次");
  });

  it("filters zero-month shortest reign and only shows succession trouble at two", () => {
    const zero = ruler("zero", { endYear: 120 });
    const oneHeir = ruler("parent", { chronicle: { ...ruler("tmp").chronicle, accessionSnapshot: { month: 120, population: 10, territoryShare: .2, cityCount: 2, stability: 70 }, endSnapshot: { month: 240, population: 12, territoryShare: .4, cityCount: 5, stability: 75 }, latestSnapshot: { month: 240, population: 12, territoryShare: .4, cityCount: 5, stability: 75 } } });
    const ds = [{ factionId: "秦", rulers: [zero, oneHeir] }];
    expect(records(ds).some((record) => record.id === "shortest-reign")).toBe(true);
    expect(records([{ factionId: "秦", rulers: [oneHeir] }]).some((record) => record.id === "heir-troubles")).toBe(false);
  });

  it("deduplicates relocation/restoration groups and ownership transitions without counting relocation as a capture", () => {
    const es = [
      event("relocate-a", "capital-relocated", { actorFactionId: "秦", historyGroupId: "move-1" }),
      event("relocate-b", "capital-relocated", { actorFactionId: "秦", historyGroupId: "move-1" }),
      event("restore-a", "faction-restored", { actorFactionId: "秦", historyGroupId: "restore-1" }),
      event("restore-b", "faction-restored", { actorFactionId: "秦", historyGroupId: "restore-1" }),
      event("capture", "city-captured", { cityId: "c1", cityName: "邯郸", historyGroupId: "capture-1" }),
      event("fall", "capital-fallen", { cityId: "c1", cityName: "邯郸", historyGroupId: "capture-1" }),
      event("relocation", "capital-relocated", { cityId: "c1", cityName: "邯郸", historyGroupId: "capture-1" }),
      event("capture-2", "city-recovered", { cityId: "c1", cityName: "邯郸", historyGroupId: "capture-2" }),
    ];
    const result = records([], es);
    expect(result.find((record) => record.id === "most-relocations")?.value).toContain("1次");
    expect(result.find((record) => record.id === "most-restorations")?.value).toContain("1次");
    expect(result.find((record) => record.id === "most-city-turnover")?.value).toContain("2次");
    expect(result.find((record) => record.id === "most-capital-falls")?.value).toContain("1次");
  });

  it("normalizes major-event density, deduplicates history groups, and leaves short eras out", () => {
    const eras = [
      { id: "short", name: "短章", type: "HEGEMONY", startMonth: 0, endMonth: 60, confirmedMonth: 0, dominantFactionIds: [] },
      { id: "long", name: "长章", type: "DYNASTIC", startMonth: 60, endMonth: 1260, confirmedMonth: 60, dominantFactionIds: [] },
    ];
    const es = [
      event("a", "state-founded", { monthIndex: 100, historyGroupId: "g1" }),
      event("b", "emperor-proclaimed", { monthIndex: 101, historyGroupId: "g1" }),
      event("c", "faction-restored", { monthIndex: 200, historyGroupId: "g2" }),
    ];
    const result = records([], es, eras);
    expect(result.find((record) => record.id === "densest-era")?.value).toContain("每百年2件");
    expect(result.find((record) => record.id === "densest-era")?.value).toContain("长章");
  });

  it("shows deterministic tied holders instead of silently selecting one", () => {
    const values = [{ id: "b", value: 5 }, { id: "a", value: 5 }, { id: "c", value: 5 }, { id: "d", value: 5 }];
    expect(getMaxRecordHolders(values, (item) => item.value, (item) => item.id).map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    const sorted = getMaxRecordHolders(values, (item) => item.value, (item) => item.id);
    expect(formatRecordHolders(sorted, (item) => item.id, "5次", "", "势力")).toBe("a、b、c等4势力 · 各5次");
    expect(formatRecordHolders(sorted.slice(0, 2), (item) => item.id, "5次")).toBe("a、b · 各5次");
  });

  it("uses formal accession timing, historical ruler names, and excludes provisional leaders", () => {
    const f = faction("stable-id", {
      displayName: "燕", stateFoundedMonth: 120, identityStage: "STATE",
      nameHistory: [{ name: "燕义军", startMonth: 0, endMonth: 119 }, { name: "燕", startMonth: 120 }],
    });
    const young = ruler("young", { bornYear: 100, accessionYear: 100, endYear: 240, templeName: "太祖", posthumousEpithet: "武" });
    const provisional = faction("provisional", { identityStage: "PROVISIONAL", stateFoundedMonth: undefined, displayName: "临淄义军" });
    const result = records([
      { factionId: "stable-id", rulers: [young] },
      { factionId: "provisional", rulers: [ruler("leader")] },
    ], [], [], [f, provisional] as any);
    expect(result.find((record) => record.id === "youngest-accession")?.value).toContain("燕太祖嬴平 · 1岁8个月");
    expect(result.some((record) => record.value.includes("临淄义军"))).toBe(false);
  });

  it("shows active World Record holders with their current polity and sovereign title", () => {
    const active = ruler("active", { endYear: undefined, status: "ruling", posthumousEpithet: undefined, templeName: undefined });
    const kingdom = faction("stable-king", {
      displayName: "党", nameHistory: [{ name: "党", startMonth: 0 }],
      sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }],
    });
    const kingRecord = records([{ factionId: "stable-king", rulers: [active] }], [], [], [kingdom] as any)
      .find((record) => record.id === "longest-reign");
    expect(kingRecord?.value).toContain("党王嬴平");

    const empire = faction("stable-emperor", {
      displayName: "燕", nameHistory: [{ name: "燕", startMonth: 0 }],
      sovereigntyRank: "EMPEROR", sovereigntyHistory: [{ rank: "EMPEROR", startMonth: 0 }],
    });
    const emperorRecord = records([{ factionId: "stable-emperor", rulers: [active] }], [], [], [empire] as any)
      .find((record) => record.id === "longest-reign");
    expect(emperorRecord?.value).toContain("燕帝嬴平");
  });

  it("uses the pre-state faction name and leader title for a ruler event before formal founding", () => {
    const preStateFaction = faction("stable-id", {
      displayName: "党", identityStage: "STATE", stateFoundedMonth: 100,
      nameHistory: [
        { name: "新郑义军", startMonth: 0, endMonth: 99 },
        { name: "党", startMonth: 100 },
      ],
      sovereigntyRank: "KING",
      sovereigntyHistory: [
        { rank: "LEADER", startMonth: 0, endMonth: 99 },
        { rank: "KING", startMonth: 100 },
      ],
    });
    const activeRuler = ruler("leader", {
      accessionYear: 20, endYear: undefined, status: "ruling",
      posthumousEpithet: undefined, templeName: undefined,
    });
    const eventAtMonth = event("unification", "world-unification", {
      monthIndex: 80, year: 80, actorFactionId: "stable-id", rulerId: "leader",
    });

    const record = records(
      [{ factionId: "stable-id", rulers: [activeRuler] }],
      [eventAtMonth], [], [preStateFaction] as any,
    ).find((item) => item.id === "first-unification");

    expect(record?.value).toContain("新郑义军首领嬴平");
    expect(record?.value).not.toContain("党王嬴平");
  });

  it("reports greatest land loss, longest life, and shortest completed formal reign only when meaningful", () => {
    const lost = ruler("lost", {
      endYear: 240,
      bornYear: -720,
      chronicle: {
        ...ruler("tmp").chronicle,
        accessionSnapshot: { month: 120, population: 20, territoryShare: .55, cityCount: 8, stability: 75 },
        endSnapshot: { month: 240, population: 5, territoryShare: .12, cityCount: 2, stability: 40 },
        latestSnapshot: { month: 240, population: 5, territoryShare: .12, cityCount: 2, stability: 40 },
        peakTerritoryShare: .58,
      },
    });
    const quick = ruler("quick", { accessionYear: 300, endYear: 301, bornYear: 0 });
    const sameMonth = ruler("same", { accessionYear: 400, endYear: 400, bornYear: 0 });
    const result = records([{ factionId: "秦", rulers: [lost, quick, sameMonth] }]);
    expect(result.find((record) => record.id === "territory-loss")?.value).toContain("-43pp");
    expect(result.find((record) => record.id === "longest-life")?.value).toContain("80岁");
    expect(result.find((record) => record.id === "shortest-reign")?.value).toContain("1个月");
  });

  it("excludes provisional factions from formal state records and keeps output deterministic", () => {
    const teams = [faction("义军", { identityStage: "PROVISIONAL", stateFoundedMonth: undefined, firstFoundedYear: 0, getCumulativeActiveYears: () => 500 }), faction("汉", { displayName: "汉" })];
    const first = records([], [], [], teams as any);
    const second = records([], [], [], teams as any);
    expect(first).toEqual(second);
    expect(first.find((record) => record.id === "longest-state")?.value).toContain("汉");
    expect(first.find((record) => record.id === "longest-state")?.value).not.toContain("义军");
  });
});

it("longest life uses actual death, excluding retirement and unknown political end ages", () => {
  const real = ruler("real", { givenName: "实", deathMonth: 600 });
  const retired = ruler("retired", { givenName: "退", endYear: 1000, status: "abdicated", deathMonth: undefined, deathReason: undefined });
  const unknown = ruler("unknown", { givenName: "终", endYear: 1100, status: "politically-ended", deathMonth: undefined, deathReason: undefined });
  const life = records([{ factionId: "秦", rulers: [real, retired, unknown] }]).find(r => r.id === "longest-life");
  expect(life?.value).toContain("50岁"); expect(life?.value).toContain("实");
  expect(life?.value).not.toMatch(/退|终/);
});
