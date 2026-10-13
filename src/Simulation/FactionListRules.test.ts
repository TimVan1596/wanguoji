import { describe, expect, it } from "vitest";
import { getFactionTerminalMonth, getVisibleFactions, sortHistoricalFactions, type FactionListItem } from "./FactionListRules";

describe("faction list rules", () => {
  const factions = [
    { name: "秦", status: "ACTIVE" as const },
    {
      name: "齐",
      status: "EXILED" as const,
      identityStage: "STATE" as const,
      stateFoundedMonth: 0,
    },
    {
      name: "梁",
      status: "EXTINCT" as const,
      identityStage: "STATE" as const,
      stateFoundedMonth: 72,
    },
    {
      name: "新郑义军",
      status: "EXTINCT" as const,
      identityStage: "PROVISIONAL" as const,
    },
  ];

  it("filters factions by lifecycle status", () => {
    expect(getVisibleFactions(factions, "all").map((faction) => faction.name)).toEqual([
      "秦",
      "齐",
      "梁",
    ]);
    expect(getVisibleFactions(factions, "active").map((faction) => faction.name)).toEqual([
      "秦",
    ]);
    expect(getVisibleFactions(factions, "exiled").map((faction) => faction.name)).toEqual([
      "齐",
    ]);
    expect(getVisibleFactions(factions, "extinct").map((faction) => faction.name)).toEqual([
      "梁",
    ]);
  });
});

describe("terminal historical faction sorting", () => {
  const terminal = (options: Partial<FactionListItem> & Pick<FactionListItem, "name">): FactionListItem => ({
    name: options.name,
    factionId: options.factionId ?? options.name,
    status: options.status ?? "EXTINCT",
    identityStage: options.identityStage ?? "STATE",
    terminationReason: options.terminationReason,
    extinctionYear: options.extinctionYear,
    terminationMonth: options.terminationMonth,
    firstFoundedYear: options.firstFoundedYear,
    restorationYears: options.restorationYears ?? [],
    getCumulativeActiveYears: options.getCumulativeActiveYears,
  });

  const mixed = [
    terminal({ name: "覆灭较早", firstFoundedYear: 0, terminationReason: "EXTINCT", extinctionYear: 30, terminationMonth: 30 }),
    terminal({ name: "纳土最近", firstFoundedYear: 12, terminationReason: "SUBMITTED", extinctionYear: 18, terminationMonth: 60 }),
    terminal({ name: "合邦最早", firstFoundedYear: 8, terminationReason: "MERGED", extinctionYear: 20, terminationMonth: 12 }),
    terminal({ name: "日期缺失", firstFoundedYear: 6, terminationReason: "EXTINCT" }),
  ];

  it("uses the authoritative month field for each ending type without rescaling legacy Year fields", () => {
    expect(mixed.map(getFactionTerminalMonth)).toEqual([30, 60, 12, undefined]);
    expect(sortHistoricalFactions(mixed, "terminal-recent", 200).map((faction) => faction.name))
      .toEqual(["纳土最近", "覆灭较早", "合邦最早", "日期缺失"]);
    expect(sortHistoricalFactions(mixed, "terminal-oldest", 200).map((faction) => faction.name))
      .toEqual(["合邦最早", "覆灭较早", "纳土最近", "日期缺失"]);
  });

  it("sorts cumulative in-country months and keeps missing values last in either direction", () => {
    const rows = [
      terminal({ name: "较短", firstFoundedYear: 0, getCumulativeActiveYears: () => 24 }),
      terminal({ name: "较长", firstFoundedYear: 12, getCumulativeActiveYears: () => 72 }),
      terminal({ name: "未记录", firstFoundedYear: 18 }),
    ];
    expect(sortHistoricalFactions(rows, "active-longest", 400).map((faction) => faction.name))
      .toEqual(["较长", "较短", "未记录"]);
    expect(sortHistoricalFactions(rows, "active-shortest", 400).map((faction) => faction.name))
      .toEqual(["较短", "较长", "未记录"]);
  });

  it("supports latest founding and restoration count, with deterministic month and faction ID ties", () => {
    const rows = [
      terminal({ name: "zeta", factionId: "z", firstFoundedYear: 20, restorationYears: [20, 40] }),
      terminal({ name: "alpha", factionId: "a", firstFoundedYear: 20, restorationYears: [20, 40] }),
      terminal({ name: "older", factionId: "b", firstFoundedYear: 5, restorationYears: [5] }),
    ];
    expect(sortHistoricalFactions(rows, "founded-recent", 100).map((faction) => faction.factionId))
      .toEqual(["a", "z", "b"]);
    expect(sortHistoricalFactions(rows, "restorations-most", 100).map((faction) => faction.factionId))
      .toEqual(["a", "z", "b"]);
    expect(sortHistoricalFactions([...rows].reverse(), "restorations-most", 100).map((faction) => faction.factionId))
      .toEqual(["a", "z", "b"]);
  });

  it("does not mutate its input and applies archive visibility before callers sort", () => {
    const rows = [
      terminal({ name: "临时义军", identityStage: "PROVISIONAL", terminationReason: "EXTINCT", extinctionYear: 80 }),
      terminal({ name: "正式国家", stateFoundedMonth: 0, terminationReason: "EXTINCT", extinctionYear: 30 }),
      { name: "流亡", status: "EXILED", identityStage: "STATE" },
    ];
    const original = rows.map((row) => row.name);
    const visible = getVisibleFactions(rows, "extinct");
    expect(visible.map((row) => row.name)).toEqual(["正式国家"]);
    expect(sortHistoricalFactions(visible, "terminal-recent", 100).map((row) => row.name)).toEqual(["正式国家"]);
    expect(rows.map((row) => row.name)).toEqual(original);
  });
});
