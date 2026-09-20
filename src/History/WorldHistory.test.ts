import { describe, expect, it } from "vitest";
import WorldHistory, { formatEventDate } from "./WorldHistory";

describe("world history", () => {
  it("normal succession creates a single ruler-succession event", () => {
    WorldHistory.reset();
    WorldHistory.addRulerSuccession(31, "齐", "田惠", "田康", {
      reason: "natural",
      reignYears: 31,
      age: 64,
    });
    const events = WorldHistory.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ruler-succession");
    expect(events[0].title).toContain("薨");
  });

  it("stores metadata as a snapshot", () => {
    WorldHistory.reset();
    const metadata = { population: 37 };
    WorldHistory.addRulerSuccession(31, "齐", "田惠", "田康", metadata);
    metadata.population = 99;
    expect(WorldHistory.getEvents()[0].metadata?.population).toBe(37);
  });

  it("combat death succession is recorded as battle death", () => {
    WorldHistory.reset();
    WorldHistory.addRulerSuccession(41, "秦", "嬴昭", "嬴烈", {
      reason: "combat",
      reignYears: 29,
      age: 61,
    });
    expect(WorldHistory.getEvents()[0].title).toContain("战死");
  });

  it("uses provisional succession wording when the ruler was a leader", () => {
    WorldHistory.reset();
    WorldHistory.addRulerSuccession(41, "rebel_1", "魏安", "魏武", {
      reason: "combat",
      previousRulerTitle: "大梁义军首领魏安",
      rulerPoliticalTitle: "首领",
      nextSuccessionVerb: "继任",
      reignYears: 2,
      age: 43,
    });
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toBe("大梁义军首领魏安战死，魏武继任");
    expect(event.title).not.toContain("义军王");
  });

  it("records state formation as state name plus claiming kingship", () => {
    WorldHistory.reset();
    WorldHistory.addStateFounded(63, "rebel_1", "大梁义军", "梁", "魏安");
    expect(WorldHistory.getEvents()[0].title).toBe(
      "大梁义军正式建国，定国号“梁”，首领魏安称王。"
    );
  });

  it("records emperor proclamation as a major sovereignty event", () => {
    WorldHistory.reset();
    WorldHistory.addEmperorProclaimed(240, "梁", "梁", "魏安", "r1", 52, 45, 68);
    const event = WorldHistory.getEvents()[0];
    expect(event.type).toBe("emperor-proclaimed");
    expect(event.title).toBe("梁国威震天下，梁王魏安称帝。");
    expect(event.metadata?.oldRank).toBe("KING");
    expect(event.metadata?.newRank).toBe("EMPEROR");
  });

  it("uses emperor succession wording", () => {
    WorldHistory.reset();
    WorldHistory.addRulerSuccession(260, "梁", "魏安", "魏武", {
      reason: "natural",
      previousRulerTitle: "梁帝魏安",
      rulerPoliticalTitle: "帝",
      naturalDeathVerb: "崩",
      nextSuccessionVerb: "即位",
      reignYears: 20,
      age: 58,
    });
    expect(WorldHistory.getEvents()[0].title).toBe("梁帝魏安崩，魏武即位");
  });

  it("exiled succession uses exile wording", () => {
    WorldHistory.reset();
    WorldHistory.addRulerSuccession(166, "齐", "田武", "田惠", {
      reason: "natural",
      reignYears: 34,
      age: 67,
      factionStatus: "EXILED",
    });
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toContain("流亡齐王田武去世");
    expect(event.description).toContain("继承流亡中的齐国王室");
  });

  it("records fallen cityless factions as exile instead of final extinction", () => {
    WorldHistory.reset();
    WorldHistory.addFactionExiled(48, "齐", "田武", 5, {
      conquerorFactionId: "秦",
      populationBefore: 12,
      surrenderedPopulation: 4,
      disbandedPopulation: 3,
      remnantPopulation: 5,
    });
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toContain("亡国");
    expect(event.title).not.toContain("彻底灭亡");
    expect(event.conquerorFactionId).toBe("秦");
    expect(event.metadata?.populationBefore).toBe(12);
  });

  it("records final extinction after remnants disappear", () => {
    WorldHistory.reset();
    WorldHistory.addFactionExtinct(133, "齐");
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toContain("彻底灭亡");
  });

  it("stores previous owner when a city is captured", () => {
    WorldHistory.reset();
    WorldHistory.addCityCaptured(82, "楚", "魏", "魏", "大梁", "city-daliang", true, true, 7);
    const event = WorldHistory.getEvents()[0];
    expect(event.previousOwnerFactionId).toBe("魏");
    expect(event.founderFactionId).toBe("魏");
    expect(event.metadata?.cityDefenseBefore).toBe(7);
    expect(event.title).toBe("楚攻陷魏都大梁");
  });

  it("uses recovery wording when a founder retakes its city", () => {
    WorldHistory.reset();
    WorldHistory.addCityRecovered(116, "魏", "楚", "魏", "大梁", "city-daliang", true, 4);
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toBe("魏从楚手中收复故都大梁");
    expect(event.previousOwnerFactionId).toBe("楚");
  });

  it("describes third-party control when capturing a founder city", () => {
    WorldHistory.reset();
    WorldHistory.addCityCaptured(202, "燕", "秦", "魏", "大梁", "city-daliang", false, true, 5);
    const event = WorldHistory.getEvents()[0];
    expect(event.title).toBe("燕攻陷秦国控制的大梁（魏国故都）");
    expect(event.targetFactionId).toBe("秦");
    expect(event.founderFactionId).toBe("魏");
  });

  it("keeps city capture metadata as a historical snapshot", () => {
    WorldHistory.reset();
    const metadata = {
      conquerorFactionId: "楚",
      attackerPopulation: 40,
      defenderPopulation: 11,
    };
    WorldHistory.addFactionExtinct(180, "韩", undefined, metadata);
    metadata.attackerPopulation = 99;
    expect(WorldHistory.getEvents()[0].metadata?.attackerPopulation).toBe(40);
  });

  it("formats event month snapshots through the shared world date helper", () => {
    WorldHistory.reset();
    WorldHistory.addFactionExtinct(39, "韩");
    const event = WorldHistory.getEvents()[0];
    expect(event.monthIndex).toBe(39);
    expect(formatEventDate(event)).toBe("3年4月");
  });

  it("can record world unification more than once", () => {
    WorldHistory.reset();
    WorldHistory.addUnification(10, "秦");
    WorldHistory.addUnification(100, "楚");
    const events = WorldHistory.getEvents().filter((event) => event.type === "world-unification");
    expect(events).toHaveLength(2);
    expect(events[0].title).toContain("第2次");
  });

  it("records world fracture after unification", () => {
    WorldHistory.reset();
    WorldHistory.addWorldFractured(60, "秦");
    expect(WorldHistory.getEvents()[0].type).toBe("world-fractured");
  });

  it("indexes events by related faction identity and clears the index on reset", () => {
    WorldHistory.reset();
    WorldHistory.addCityCaptured(82, "楚", "魏", "魏", "大梁", "city-daliang", true, true, 7);
    expect(WorldHistory.getEventsForFaction("楚").map((event) => event.type)).toEqual([
      "city-captured",
    ]);
    expect(WorldHistory.getEventsForFaction("魏").map((event) => event.type)).toEqual([
      "city-captured",
    ]);
    WorldHistory.reset();
    expect(WorldHistory.getEventsForFaction("魏")).toHaveLength(0);
  });

  it("queries events by world month range without changing canonical history", () => {
    WorldHistory.reset();
    WorldHistory.addUnification(10, "秦");
    WorldHistory.addWorldFractured(30, "秦");
    WorldHistory.addUnification(50, "楚");
    const ranged = WorldHistory.getEventsBetween(20, 40);
    expect(ranged.map((event) => event.type)).toEqual(["world-fractured"]);
    expect(WorldHistory.getEvents().map((event) => event.type)).toEqual([
      "world-unification",
      "world-fractured",
      "world-unification",
    ]);
  });
});
