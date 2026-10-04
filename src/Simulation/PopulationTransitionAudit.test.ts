import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import type { WorldSaveV1 } from "../Persistence/WorldSaveSchema";
import { PopulationTransitionAudit } from "./PopulationTransitionAudit";

function faction(name: string, population: number) {
  const users = new Set(Array.from({ length: population }, (_, index) => index));
  return { name, displayName: name, users };
}

describe("PopulationTransitionAudit", () => {
  it("reconciles and attributes known rebellion and empire-split transfers", () => {
    const audit = new PopulationTransitionAudit();
    const source = faction("魏", 12);
    const rebel = faction("临淄义军", 0);
    audit.reset(0, [source, rebel]);

    source.users.delete(0);
    rebel.users.add(0);
    audit.record(source, 12, 11, { cause: "REBELLION_TRANSFER", month: 1, relatedFactionId: rebel.name });
    audit.record(rebel, 0, 1, { cause: "REBELLION_TRANSFER", month: 1, relatedFactionId: source.name });
    audit.reconcile(1, [source, rebel]);
    expect(audit.getRecent().filter((row) => row.month === 1).map((row) => row.cause)).toEqual([
      "REBELLION_TRANSFER", "REBELLION_TRANSFER",
    ]);
    expect(audit.getRecent().some((row) => row.cause === "UNATTRIBUTED")).toBe(false);

    source.users.delete(1);
    rebel.users.add(1);
    audit.record(source, 11, 10, { cause: "EMPIRE_SPLIT_TRANSFER", month: 2, relatedFactionId: rebel.name });
    audit.record(rebel, 1, 2, { cause: "EMPIRE_SPLIT_TRANSFER", month: 2, relatedFactionId: source.name });
    audit.reconcile(2, [source, rebel]);
    expect(audit.getRecent().filter((row) => row.month === 2).every((row) => row.cause === "EMPIRE_SPLIT_TRANSFER")).toBe(true);
  });

  it("attributes extinction batches and natural growth without unexplained losses", () => {
    const audit = new PopulationTransitionAudit();
    const state = faction("旧国", 8);
    const victor = faction("新国", 3);
    audit.reset(0, [state, victor]);

    for (let id = 0; id < 3; id += 1) state.users.delete(id);
    audit.record(state, 8, 5, { cause: "EXTINCTION_DISBAND", month: 1, relatedFactionId: victor.name });
    for (let id = 3; id < 6; id += 1) state.users.delete(id);
    audit.record(state, 5, 2, { cause: "EXTINCTION_REMNANT", month: 1, relatedFactionId: victor.name });
    state.users.delete(6);
    state.users.delete(7);
    audit.record(state, 2, 0, { cause: "SURRENDER_TRANSFER", month: 1, relatedFactionId: victor.name });
    victor.users.add(4);
    victor.users.add(5);
    audit.record(victor, 3, 5, { cause: "SURRENDER_TRANSFER", month: 1, relatedFactionId: state.name });
    audit.reconcile(1, [state, victor]);
    expect(audit.getRecent().filter((row) => row.month === 1).map(({ factionId, cause }) => [factionId, cause])).toContainEqual(["旧国", "EXTINCTION_DISBAND"]);
    expect(audit.getRecent().filter((row) => row.month === 1).map(({ factionId, cause }) => [factionId, cause])).toContainEqual(["新国", "SURRENDER_TRANSFER"]);
    expect(audit.getRecent().filter((row) => row.factionId === "旧国").map(({ cause }) => cause)).toEqual([
      "EXTINCTION_DISBAND", "EXTINCTION_REMNANT", "SURRENDER_TRANSFER",
    ]);

    victor.users.add(6);
    audit.record(victor, 5, 6, { cause: "NATURAL_GROWTH", month: 2 });
    audit.reconcile(2, [state, victor]);
    expect(audit.getRecent().some((row) => row.month === 2 && row.cause === "UNATTRIBUTED")).toBe(false);
  });

  it("emits UNATTRIBUTED for an unrecorded change and flags threshold-sized deltas", () => {
    const audit = new PopulationTransitionAudit();
    const state = faction("燕", 12);
    audit.reset(0, [state]);
    for (let id = 0; id < 5; id += 1) state.users.delete(id);
    audit.reconcile(1, [state]);
    expect(audit.getRecent()).toMatchObject([{ factionId: "燕", before: 12, after: 7, delta: -5, cause: "UNATTRIBUTED" }]);
    expect(audit.getRecentSignificant()).toHaveLength(1);

    const smallFaction = faction("小国", 8);
    audit.reset(0, [smallFaction]);
    smallFaction.users.delete(0);
    smallFaction.users.delete(1);
    audit.record(smallFaction, 8, 6, { cause: "SIEGE_LOSS", month: 1 });
    audit.reconcile(1, [smallFaction]);
    expect(audit.getRecentSignificant()).toHaveLength(1); // 2 lost is still 25%.
  });

  it("bounds retained session history", () => {
    const audit = new PopulationTransitionAudit();
    const state = faction("齐", 0);
    audit.reset(0, [state]);
    for (let month = 1; month <= 260; month += 1) {
      const before = state.users.size;
      for (let index = 0; index < 3; index += 1) state.users.add(month * 10 + index);
      audit.record(state, before, state.users.size, { cause: "RANDOM_EVENT", month });
      audit.reconcile(month, [state]);
    }
    expect(audit.getRecent()).toHaveLength(240);
  });

  it("accounts for a faction created during the month before the caller refreshes its team array", () => {
    const audit = new PopulationTransitionAudit();
    const parent = faction("母国", 10);
    const rebel = faction("新义军", 0);
    audit.reset(0, [parent]);
    parent.users.delete(0);
    rebel.users.add(0);
    audit.record(parent, 10, 9, { cause: "REBELLION_TRANSFER", month: 1, relatedFactionId: rebel.name });
    audit.record(rebel, 0, 1, { cause: "REBELLION_TRANSFER", month: 1, relatedFactionId: parent.name });
    audit.reconcile(1, [parent]);
    expect(audit.getRecent().some((entry) => entry.cause === "UNATTRIBUTED")).toBe(false);
    audit.reconcile(2, [parent, rebel]);
    expect(audit.getRecent().some((entry) => entry.month === 2 && entry.cause === "UNATTRIBUTED")).toBe(false);
  });

  it("is session-only and leaves the canonical save schema version unchanged", () => {
    const audit = new PopulationTransitionAudit();
    const hasAuditField: "populationTransitionAudit" extends keyof WorldSaveV1 ? true : false = false;
    expect(audit).not.toHaveProperty("exportState");
    expect(hasAuditField).toBe(false);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(6);
  });
});
