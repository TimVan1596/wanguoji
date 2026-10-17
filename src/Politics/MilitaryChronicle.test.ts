import { describe, expect, it } from "vitest";
import type { MilitaryFormation, MilitaryPerson } from "./MilitaryCommandRegistry";
import { deriveMilitaryChronicle, formatMilitaryVictorySource } from "./MilitaryChronicle";
import { getRulerDiplomaticEvents, getRulerHistoricalEvents, isCoreDiplomaticEvent } from "./RulerChronicle";
import type { WorldEvent } from "../History/WorldHistory";

function fixture() {
  const person: MilitaryPerson = { personId: "p", sourceUserId: 7, name: "赵-407", personalName: "李承远", bornMonth: -300,
    factionId: "黄", status: "DEAD", deathMonth: 60, deathCause: "BATTLE_DEATH", capturedEventIds: [],
    appointments: [{ factionId: "赵", startMonth: 10, endMonth: 30, commandId: "a", endReason: "TRANSFERRED" },
      { factionId: "黄", startMonth: 40, endMonth: 60, commandId: "b", endReason: "DEATH" }] };
  const formations: MilitaryFormation[] = person.appointments.map(a => ({ commandId: a.commandId, commanderPersonId: "p", factionId: a.factionId,
    createdMonth: a.startMonth, memberUnitIds: [], captures: [], status: "DISBANDED" }));
  const events: WorldEvent[] = [];
  const capture = (id: string, type: WorldEvent["type"], month: number, command = "a", group = id, wasCapital = 0) => {
    const factionId = command === "a" ? "赵" : "黄";
    const event: WorldEvent = { id, type, year: month, monthIndex: month, category: "war", title: "真实攻城", importance: "major",
      actorFactionId: factionId, targetFactionId: "敌", factionIds: [factionId, "敌"], cityId: "c", cityName: "临淄", historyGroupId: group,
      metadata: { commanderPersonId: "p", commandId: command, commanderPersonalName: person.personalName, wasCapital } };
    events.push(event); person.capturedEventIds.push(id); formations.find(f => f.commandId === command)!.captures.push({ eventId: id, cityId: "c", month });
    return event;
  };
  return { person, formations, events, capture };
}

describe("evidence based military biography", () => {
  it("keeps ordinary, contemporary capital and recovery facts, groups one battle, and partitions service by faction", () => {
    const f = fixture();
    f.capture("ordinary", "city-captured", 12);
    f.capture("capital", "capital-fallen", 20, "a", "one-battle", 1);
    f.capture("duplicate", "city-captured", 20, "a", "one-battle", 1);
    f.capture("recovery", "city-recovered", 50, "b");
    const rows = deriveMilitaryChronicle(f.person, f.formations, f.events, 100);
    expect(rows.map(r => r.eventId)).toEqual(["ordinary", "capital", "recovery"]);
    expect(rows[0].text).toContain("普通城市"); expect(rows[1].text).toContain("当时敌都"); expect(rows[2].text).toContain("收复");
    expect(rows.every(r => r.source.includes(r.eventId) && r.text.includes(f.person.personalName))).toBe(true);
    expect(deriveMilitaryChronicle(f.person, f.formations, f.events, 100, "赵").map(r => r.eventId)).toEqual(["ordinary", "capital"]);
    expect(deriveMilitaryChronicle(f.person, f.formations, f.events, 100, "黄").map(r => r.eventId)).toEqual(["recovery"]);
    for (const event of f.events) expect(formatMilitaryVictorySource(event)).toContain(`${f.person.personalName}所属编组参与`);
  });

  it.each(["no-person", "wrong-command", "missing-canonical-event", "outside-service", "after-death"])("rejects %s credit", reason => {
    const f = fixture(), e = f.capture("c", "city-captured", 50, "b");
    if (reason === "no-person") delete e.metadata!.commanderPersonId;
    if (reason === "wrong-command") e.metadata!.commandId = "foreign";
    if (reason === "missing-canonical-event") f.events.length = 0;
    if (reason === "outside-service") e.year = e.monthIndex = f.formations[1].captures[0].month = 35;
    if (reason === "after-death") e.year = e.monthIndex = f.formations[1].captures[0].month = 61;
    expect(deriveMilitaryChronicle(f.person, f.formations, f.events, 100)).toEqual([]);
  });

  it("an order or a siege contact is not a victory, and no person reference means no added commander", () => {
    const f = fixture();
    const order: WorldEvent = { id: "order", year: 12, type: "military-order-issued", category: "war", title: "军令", actorFactionId: "赵", cityId: "c",
      metadata: { personId: "p", commandId: "a" }, importance: "normal" };
    const rows = deriveMilitaryChronicle(f.person, f.formations, [order], 100);
    expect(rows).toHaveLength(1); expect(rows[0].victory).toBe(false); expect(rows[0].text).toContain("不代表攻陷");
    expect(deriveMilitaryChronicle(f.person, f.formations, [], 100)).toEqual([]);
    const capture = f.capture("unknown", "city-captured", 12); delete capture.metadata!.commanderPersonId;
    expect(formatMilitaryVictorySource(capture)).toBeUndefined();
  });
});

describe("royal core and complete diplomatic archive", () => {
  it("retains all real signatures and renewals independently of the bounded core; a short crisis treaty can be important", () => {
    const ruler = { id: "r", accessionYear: 0, endYear: 100 };
    const treaties: WorldEvent[] = Array.from({ length: 12 }, (_, i) => ({ id: `t-${i}`, year: i + 1, monthIndex: i + 1,
      type: i === 11 ? "relation-renewed" : "truce-signed", category: "politics", importance: "normal", title: "签署2年停战",
      factionIds: ["赵", "魏"], metadata: { signatoryARulerId: "r", signatoryAFactionId: "赵", signatoryBRulerId: "w", signatoryBFactionId: "魏", expiresMonth: i + 25 } }));
    const alliance = { ...treaties[0], id: "alliance", type: "alliance-signed" } as WorldEvent;
    const crisis = { ...treaties[1], id: "crisis", metadata: { ...treaties[1].metadata, capitalFall: 1 } } as WorldEvent;
    const events = [...treaties, alliance, crisis], original = JSON.stringify(events);
    expect(getRulerHistoricalEvents(events, ruler, "赵", 100, []).map(e => e.id)).toEqual(["alliance", "crisis"]);
    expect(getRulerDiplomaticEvents(events, ruler, "赵", 100)).toHaveLength(14);
    expect(getRulerDiplomaticEvents(events, { ...ruler, id: "other" }, "赵", 100)).toEqual([]);
    expect(getRulerDiplomaticEvents(events, ruler, "外国", 100)).toEqual([]);
    expect(isCoreDiplomaticEvent(treaties[0], events)).toBe(false);
    expect(JSON.stringify(events)).toBe(original);
  });
});
