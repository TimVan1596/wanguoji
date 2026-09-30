import { describe, expect, it } from "vitest";
import { deriveWorldRecords, getMaxRecordHolders } from "./WorldRecords";

const faction = (name: string, extra: Record<string, unknown> = {}) => ({
  name, displayName: name, firstFoundedYear: 0, identityStage: "STATE", stateFoundedMonth: 0,
  nameHistory: [{ name, startMonth: 0 }], sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }],
  cumulativeActiveYears: 100, getCumulativeActiveYears: () => 1200, ...extra,
});
const ruler = (id: string, extra: Record<string, unknown> = {}) => ({
  id, houseName: "嬴氏", givenName: "平", bornYear: 0, accessionYear: 120, endYear: 240,
  reignOrdinal: 1, endReason: "去世", status: "dead",
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
