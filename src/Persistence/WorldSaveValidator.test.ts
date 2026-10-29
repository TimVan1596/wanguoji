import {validateMilitaryCommandState} from "./MilitaryCommandValidation";
import {addInitialOfficeFacts} from "./testing/MilitaryOfficeFixture";
import { setFixtureLifetimeRecords } from "./testing/FactionLifetimeFixture";
import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1, CURRENT_SAVE_SCHEMA_VERSION, diffCanonicalWorldSave } from "./WorldSaveSchema";
import { isSafeSnapshotBoundary } from "./SnapshotBoundary";
import { validateWorldSave } from "./WorldSaveValidator";
import { sortHistoricalFactions, type FactionListItem } from "../Simulation/FactionListRules";

function fixture() {
  const save = createEmptyWorldSaveV1();
  save.world.worldMonth = 42;
  save.world.clock.worldMonth = 42;
  save.factions = [{ factionId: "qin", displayName: "秦", color: 1, colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" }], factionType: "KINGDOM", status: "ACTIVE", firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0, identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0 }];
  save.cities = [{ cityId: "xianyang", name: "咸阳", ownerFactionId: "qin", founderFactionId: "qin", foundedMonth: 0, centerGridX: 0, centerGridY: 0, isCapital: true, defense: 10, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0 }];
  save.users = [{ userId: 7, name: "嬴平", factionId: "qin", sourceFactionId: "qin", loyalty: 70, role: "RULER", score: 0, bornMonth: -360, playerUnitId: "unit-1" }];
  save.units = [{ unitId: "unit-1", factionId: "qin", userId: 7, x: 10, y: 20, vx: 1, vy: -1, speed: 100, radius: 10, scale: 1, speedCoefficient: 0, sizeCoefficient: 0, alive: true, role: "RULER" }];
  save.dynasties = [{ factionId: "qin", houseName: "田氏", houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "qin-ruler-1", startReason: "FOUNDING" }], rulers: [{ rulerId: "qin-ruler-1", houseName: "田氏", bornMonth: -360, accessionMonth: 0, status: "ruling" }], heirIds: [] }];
  save.blocks = [{ gridX: 0, gridY: 0, ownerFactionId: "qin", isHome: true, cityId: "xianyang", homeHitPoints: 10, isCityCenter: true }];
  save.populationSystem = { counters: { qin: 3 }, lastGrowthMonth: 12, wartimeLossMonths: {} };
  setFixtureLifetimeRecords(save);
  return save;
}

describe("WorldSaveV1 validation and JSON contract", () => {
  it("V14 validates a living same-house deposition and later actual death as distinct months", () => {
    const save = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    setFixtureLifetimeRecords(save);
    save.world.worldMonth = 42; save.world.clock.worldMonth = 42;
    const snapshot = (month: number) => ({ month, population: 10, territoryShare: 0.2, cityCount: 1, stability: 35 });
    const coupId = "ruler-deposed-12-qin-0";
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "successor", heirIds: [],
      lastDepositionAttemptMonth: 12,
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "predecessor", startReason: "FOUNDING" }],
      rulers: [
        { rulerId: "predecessor", houseName: "田氏", givenName: "平", bornMonth: -360, accessionMonth: 0,
          endMonth: 12, politicalEndMonth: 12, status: "dead", endReason: "被废", deathMonth: 24,
          deathReason: "自然去世", reignOrdinal: 1,
          chronicle: { accessionSnapshot: snapshot(0), latestSnapshot: snapshot(12), endSnapshot: snapshot(12),
            notableEventIds: [coupId], deathCause: "自然去世" } },
        { rulerId: "successor", houseName: "田氏", givenName: "继", bornMonth: -240, accessionMonth: 12,
          status: "ruling", accessionCause: "DEPOSITION", predecessorId: "predecessor", parentId: "predecessor",
          relationType: "DIRECT_CHILD", reignOrdinal: 2,
          chronicle: { accessionSnapshot: snapshot(12), latestSnapshot: snapshot(42), notableEventIds: [coupId] } },
      ] }];
    save.worldHistory.events = [
      { id: "capital-crisis", year: 1, monthIndex: 1, category: "war", type: "capital-fallen", title: "都城陷落",
        factionIds: ["qin", "wei"], actorFactionId: "wei", targetFactionId: "qin", importance: "major" },
      { id: coupId, year: 12, monthIndex: 12, category: "politics", type: "ruler-deposed", title: "宗室废立",
        factionIds: ["qin"], actorFactionId: "qin", rulerId: "successor", importance: "major",
        metadata: { factionId: "qin", month: 12, previousRulerId: "predecessor", nextRulerId: "successor",
          previousRulerName: "田平", nextRulerName: "田继", previousHouseName: "田氏", nextHouseName: "田氏",
          relation: "DIRECT_CHILD", crisisEvidenceEventIds: "capital-crisis", houseChanged: 0, nameChanged: 0, colorChanged: 0 } },
      { id: "later-death", year: 24, monthIndex: 24, category: "politics", type: "ruler-died", title: "田平去世",
        factionIds: ["qin"], actorFactionId: "qin", importance: "normal", metadata: { rulerId: "predecessor", deathReason: "自然去世" } },
    ];
    const json = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(json)).toEqual({ valid: true, errors: [] });
    expect(json.dynasties[0].rulers[0]).toMatchObject({ status: "dead", endMonth: 12, endReason: "被废", deathMonth: 24 });
    expect(json.dynasties[0].rulers[1]).toMatchObject({ accessionCause: "DEPOSITION", accessionMonth: 12 });
    expect(json.dynasties[0].lastDepositionAttemptMonth).toBe(12);
  });

  it("round-trips V10 house epochs, displaced living kin, names, colors and RNG; rejects V8", () => {
    const save = fixture();
    save.factions[0] = { ...save.factions[0], houseName: "侯氏", displayName: "梁", color: 2,
      nameHistory: [{ name: "秦", startMonth: 0, endMonth: 35, reason: "FOUNDING" }, { name: "梁", startMonth: 36, reason: "dynastic-revolution" }],
      colorHistory: [{ color: 1, startMonth: 0, endMonth: 35, reason: "FOUNDING" }, { color: 2, startMonth: 36, reason: "USURPATION" }] };
    save.dynasties = [{ factionId: "qin", houseName: "侯氏", currentRulerId: "new", heirIds: [],
      houseEpochs: [{ houseName: "田氏", startMonth: 0, endMonth: 35, foundingRulerId: "old", startReason: "FOUNDING" },
        { houseName: "侯氏", startMonth: 36, foundingRulerId: "new", startReason: "USURPATION", displacedHouseName: "田氏", displacedSuccessorId: "heir", displacedDesignatedHeirId: "heir" }],
      rulers: [{ rulerId: "old", houseName: "田氏", bornMonth: -360, accessionMonth: 0, endMonth: 36, politicalEndMonth: 36, status: "dead", deathMonth: 36, deathReason: "去世" },
        { rulerId: "heir", bornMonth: 0, houseName: "田氏", parentId: "old", status: "kin", displacedByUsurpationMonth: 36 },
        { rulerId: "new", bornMonth: 0, houseName: "侯氏", accessionMonth: 36, predecessorId: "old", status: "ruling", relationType: "USURPER" }] }];
    const parsed = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(parsed)).toEqual({ valid: true, errors: [] });
    expect(parsed).toEqual(save);
    const missing = JSON.parse(JSON.stringify(save));
    delete missing.factions[0].colorHistory;
    delete missing.dynasties[0].houseEpochs;
    expect(validateWorldSave(missing).errors).toContain("faction.colorHistory must be non-empty");
    expect(validateWorldSave(missing).errors).toContain("dynasty.houseEpochs must be non-empty");
    for (const old of [13, 9, 8, 7, 6, 1]) expect(validateWorldSave({ ...parsed, saveSchemaVersion: old }).errors).toContain("该存档版本已不受支持，请创建新世界。");
    parsed.dynasties[0].houseEpochs[1].displacedSuccessorId = "missing";
    expect(validateWorldSave(parsed).valid).toBe(false);
    parsed.dynasties[0].houseEpochs[1].displacedSuccessorId = "heir";
    parsed.dynasties[0].rulers[2].parentId = "old";
    expect(validateWorldSave(parsed).errors).toContain("usurper cannot have fabricated parent relationship");
    delete parsed.dynasties[0].rulers[2].parentId;
    parsed.factions[0].colorHistory[0].endMonth = 40;
    expect(validateWorldSave(parsed).errors).toContain("invalid faction color history");
  });
  it("preserves V8 personal exposure and rejects malformed or future evidence", () => {
    const save = fixture();
    const ruler = (save.dynasties[0].rulers as Record<string, unknown>[])[0];
    ruler.accessionMonth = 30;
    ruler.lastPersonalSiegeContactMonth = 40;
    const loaded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(loaded).valid).toBe(true);
    expect(loaded.dynasties[0].rulers[0].lastPersonalSiegeContactMonth).toBe(40);
    expect(validateWorldSave({ ...save, saveSchemaVersion: 7 }).valid).toBe(false);
    for (const invalid of [-1, 0.5, 43, "40", 29]) {
      loaded.dynasties[0].rulers[0].lastPersonalSiegeContactMonth = invalid;
      expect(validateWorldSave(loaded).errors).toContain("ruler.lastPersonalSiegeContactMonth must be a valid past reign month");
    }
  });
  it("retains hazard checks in V8 JSON and rejects V7 and invalid hazard months", () => {
    const save = fixture();
    (save.dynasties[0].rulers as Record<string, unknown>[])[0].lastBattleHazardCheckMonth = 40;
    (save.dynasties[0].rulers as Record<string, unknown>[])[0].accessionMonth = 30;
    const loaded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(loaded).valid).toBe(true);
    expect(loaded.dynasties[0].rulers[0].lastBattleHazardCheckMonth).toBe(40);
    expect(validateWorldSave({ ...save, saveSchemaVersion: 7 }).valid).toBe(false);
    for (const invalid of [-1, 0.5, 43, "40", 29]) {
      loaded.dynasties[0].rulers[0].lastBattleHazardCheckMonth = invalid;
      expect(validateWorldSave(loaded).errors).toContain("ruler.lastBattleHazardCheckMonth must be a valid past reign month");
    }
  });
  it("uses schema V10 and persists alliance/merge fields plus the deterministic random stream", () => {
    const save = fixture();
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(31);
    expect(save.saveSchemaVersion).toBe(31);
    expect(validateWorldSave({...save,saveSchemaVersion:21}).valid).toBe(false);expect(validateWorldSave({...save,saveSchemaVersion:30}).valid).toBe(false);
    expect(save.diplomacy).toEqual({ relations: [], pairMemories: [], lastEvaluationMonth: -1 });
    expect(save.worldRandom).toMatchObject({ algorithm: "mulberry32-v1", seed: expect.any(String), state: expect.any(Number), position: 0 });
  });

  it("V10 preserves continuity, renewals and pair memory, and rejects V9 or malformed canonical metadata",()=>{
    const save=fixture(); save.factions.push({...save.factions[0],factionId:"wei"});
    setFixtureLifetimeRecords(save);
    save.diplomacy.relations=[{factionAId:"qin",factionBId:"wei",status:"NON_AGGRESSION",reason:"COMMON_THREAT_NON_AGGRESSION",originalStartedMonth:0,startedMonth:12,expiresMonth:180,lastRenewedMonth:36,renewalCount:1}];
    save.diplomacy.pairMemories=[{factionAId:"qin",factionBId:"wei",lastStatus:"TRUCE",lastReason:"WAR_EXHAUSTION_TRUCE",endedMonth:10,cooldownUntilMonth:34}];
    const changed=structuredClone(save);changed.diplomacy.relations[0].renewalCount=2;changed.diplomacy.pairMemories[0].cooldownUntilMonth=46;
    expect(diffCanonicalWorldSave(save,changed).subsystemCounts.diplomacy).toBe(2);
    const loaded=JSON.parse(JSON.stringify(save));expect(validateWorldSave(loaded)).toEqual({valid:true,errors:[]});expect(loaded.diplomacy).toEqual(save.diplomacy);
    expect(validateWorldSave({...save,saveSchemaVersion:9}).errors).toContain("该存档版本已不受支持，请创建新世界。");
    for(const [key,value] of [["originalStartedMonth",13],["renewalCount",-1],["lastRenewedMonth",43]] as const){const broken=structuredClone(save);(broken.diplomacy.relations[0] as any)[key]=value;expect(validateWorldSave(broken).valid).toBe(false);}
    const missing=structuredClone(save);delete (missing.diplomacy as any).pairMemories;expect(validateWorldSave(missing).valid).toBe(false);
    const unknown=structuredClone(save);unknown.diplomacy.pairMemories[0].factionBId="unknown";expect(validateWorldSave(unknown).valid).toBe(false);
    const duplicate=structuredClone(save);duplicate.diplomacy.pairMemories.push({...duplicate.diplomacy.pairMemories[0]});expect(validateWorldSave(duplicate).valid).toBe(false);
  });
  it("survives JSON stringify/parse with canonical month-index fields", () => {
    const save = fixture();
    const parsed = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(parsed)).toEqual({ valid: true, errors: [] });
    expect(parsed.world.worldMonth).toBe(42);
    expect(parsed.world).not.toHaveProperty("year");
    expect(parsed.cities[0].foundedMonth).toBe(0);
    expect(parsed.cities[0]).not.toHaveProperty("foundedYear");
    expect(parsed.units[0]).toMatchObject({ x: 10, y: 20, vx: 1, vy: -1 });
  });

  it("validates symmetric V8 treaty data and rejects the previous save schema", () => {
    const save = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    setFixtureLifetimeRecords(save);
    save.diplomacy.relations = [{ factionAId: "qin", factionBId: "wei", status: "TRUCE", originalStartedMonth: 12, renewalCount: 0, startedMonth: 12, expiresMonth: 36, reason: "WAR_EXHAUSTION_TRUCE" }];
    expect(validateWorldSave(save).valid).toBe(true);
    expect(validateWorldSave({ ...save, saveSchemaVersion: 5 }).valid).toBe(false);
    expect(validateWorldSave({ ...save, diplomacy: { ...save.diplomacy, relations: [{ ...save.diplomacy.relations[0], factionAId: "wei", factionBId: "qin" }] } }).valid).toBe(false);
  });

  it("validates the alliance reason and persistent absorbed-faction terminal state", () => {
    const save = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    setFixtureLifetimeRecords(save);
    save.diplomacy.relations = [{
      factionAId: "qin", factionBId: "threat", status: "ALLIANCE", originalStartedMonth: 12, renewalCount: 0, startedMonth: 12, expiresMonth: 132,
      reason: "COMMON_THREAT_ALLIANCE", commonThreatFactionId: "threat",
      preconditionStatus: "NON_AGGRESSION", preconditionStartedMonth: 0, preconditionDurationMonths: 24,
    }];
    save.factions.push({ ...save.factions[0], factionId: "threat", displayName: "强敌" });
    setFixtureLifetimeRecords(save);
    save.factions.push({ ...save.factions[0], factionId: "chu", displayName: "楚" });
    setFixtureLifetimeRecords(save);
    save.factions[1] = {
      ...save.factions[1], status: "EXTINCT", terminationReason: "MERGED",
      terminationTargetFactionId: "qin", terminationMonth: 36,
    };
    save.factions[3] = {
      ...save.factions[3], status: "EXTINCT", terminationReason: "SUBMITTED",
      terminationTargetFactionId: "qin", terminationMonth: 24,
    };
    setFixtureLifetimeRecords(save);
    const sortFromV14 = (factions: typeof save.factions) => sortHistoricalFactions(
      factions.filter(faction => faction.status === "EXTINCT").map(faction => ({
        name: faction.factionId,
        factionId: faction.factionId,
        status: faction.status as FactionListItem["status"],
        identityStage: faction.identityStage as FactionListItem["identityStage"],
        stateFoundedMonth: faction.stateFoundedMonth,
        firstFoundedMonth: faction.firstFoundedMonth,
        terminationReason: faction.terminationReason,
        extinctionYear: faction.extinctionMonth,
        terminationMonth: faction.terminationMonth,
        restorationYears: faction.restorationMonths,
        cumulativeActiveMonths: faction.cumulativeActiveMonths,
      })), "terminal-recent", save.world.worldMonth).map(faction => faction.factionId);
    const beforeOrder = sortFromV14(save.factions);
    const loaded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(loaded)).toEqual({ valid: true, errors: [] });
    expect(loaded.diplomacy.relations[0]).toMatchObject({ status: "ALLIANCE", commonThreatFactionId: "threat", preconditionDurationMonths: 24 });
    expect(loaded.factions[1]).toMatchObject({ terminationReason: "MERGED", terminationTargetFactionId: "qin", terminationMonth: 36 });
    expect(sortFromV14(loaded.factions)).toEqual(beforeOrder);
    expect(validateWorldSave({ ...save, saveSchemaVersion: 5 }).valid).toBe(false);
  });

  it("rejects multiple active alliances for one faction", () => {
    const save = fixture();
    save.factions.push(...["wei", "chu", "yan"].map((factionId) => ({ ...save.factions[0], factionId })));
    setFixtureLifetimeRecords(save);
    save.diplomacy.relations = [
      { factionAId: "qin", factionBId: "wei", status: "ALLIANCE", originalStartedMonth: 1, renewalCount: 0, startedMonth: 1, expiresMonth: 121, reason: "COMMON_THREAT_ALLIANCE" },
      { factionAId: "chu", factionBId: "qin", status: "ALLIANCE", originalStartedMonth: 1, renewalCount: 0, startedMonth: 1, expiresMonth: 121, reason: "COMMON_THREAT_ALLIANCE" },
    ];
    expect(validateWorldSave(save).errors).toContain("a faction may have at most one active alliance");
  });

  it("preserves active candidates, living kin, designation, and parent relationships in schema V8", () => {
    const save = fixture();
    save.dynasties = [{
      factionId: "qin", houseName: "田氏",
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "qin-ruler-1", startReason: "FOUNDING" }],
      currentRulerId: "qin-ruler-1",
      heirIds: ["qin-ruler-2", "qin-ruler-3"],
      designatedHeirId: "qin-ruler-2",
      designatedSinceMonth: 36,
      rulers: [
        { rulerId: "qin-ruler-1", houseName: "田氏", bornMonth: -600, accessionMonth: 0, status: "ruling" },
        { rulerId: "qin-ruler-2", bornMonth: -300, status: "heir", parentId: "qin-ruler-1", relationType: "DIRECT_CHILD" },
        { rulerId: "qin-ruler-3", bornMonth: 0, status: "heir", parentId: "qin-ruler-2", relationType: "DIRECT_CHILD" },
        { rulerId: "qin-ruler-4", bornMonth: -200, status: "kin", parentId: "qin-ruler-1" },
      ],
    }];
    const loaded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(loaded).valid).toBe(true);
    expect(loaded.dynasties[0].heirIds).toEqual(["qin-ruler-2", "qin-ruler-3"]);
    expect(loaded.dynasties[0]).toMatchObject({ designatedHeirId: "qin-ruler-2", designatedSinceMonth: 36 });
    expect(loaded.dynasties[0].rulers[2]).toMatchObject({ parentId: "qin-ruler-2", relationType: "DIRECT_CHILD" });
    expect(loaded.dynasties[0].rulers[3]).toMatchObject({ rulerId: "qin-ruler-4", bornMonth: -200, status: "kin", parentId: "qin-ruler-1" });
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(31);
  });

  it("rejects a dynasty candidate list above the runtime bound", () => {
    const save = fixture();
    const rulerIds = Array.from({ length: 8 }, (_, index) => `qin-ruler-${index + 1}`);
    save.dynasties = [{
      factionId: "qin", houseName: "田氏",
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "qin-ruler-1", startReason: "FOUNDING" }],
      currentRulerId: rulerIds[0],
      heirIds: rulerIds.slice(1),
      rulers: rulerIds.map((rulerId) => ({ rulerId, houseName: "田氏", status: rulerId === rulerIds[0] ? "ruling" : "heir" })),
    }];
    expect(validateWorldSave(save).errors).toContain("dynasties[0].heirIds exceeds candidate limit");
  });

  it("rejects unsupported schema versions and dangling references", () => {
    const save = fixture();
    save.saveSchemaVersion = 99 as never;
    save.cities[0].ownerFactionId = "missing";
    const result = validateWorldSave(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unsupported saveSchemaVersion");
    expect(result.errors.some((error) => error.includes("city.ownerFactionId"))).toBe(true);
  });

  it("rejects V14 with the supported-version message without mutating its contents", () => {
    const save = fixture();
    const before = JSON.stringify(save);
    const result = validateWorldSave({ ...save, saveSchemaVersion: 14 });
    expect(result).toEqual({ valid: false, errors: ["该存档版本已不受支持，请创建新世界。"] });
    expect(JSON.stringify(save)).toBe(before);
  });

  it("strictly validates V15 commander, formation, unit, target and capture references", () => {
    const save: any = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    setFixtureLifetimeRecords(save);
    save.cities.push({ ...save.cities[0], cityId: "wei-city", ownerFactionId: "wei", founderFactionId: "wei", isCapital: true });
    save.users.push({ userId: 8, name: "指挥者", factionId: "qin", sourceFactionId: "qin", loyalty: 70, role: "NORMAL", score: 0,
      bornMonth: -300, playerUnitId: "unit-2", militaryPersonId: "military-person-1" },
    { userId: 9, name: "成员", factionId: "qin", sourceFactionId: "qin", loyalty: 70, role: "NORMAL", score: 0,
      bornMonth: -280, playerUnitId: "unit-3" });
    for (const [unitId, userId] of [["unit-2", 8], ["unit-3", 9]] as const) {
      save.units.push({ ...save.units[0], unitId, userId, role: "NORMAL", rulerId: undefined });
    }
    const eventId = "city-captured-24-qin-魏城-1";
    save.worldHistory.events.push({ id: eventId, year: 24, monthIndex: 24, type: "city-captured", category: "war", title: "攻陷魏城",
      actorFactionId: "qin", targetFactionId: "wei", factionIds: ["qin", "wei"], cityId: "wei-city", importance: "major",
      metadata: { commandId: "military-command-1", commanderPersonId: "military-person-1" } });
    save.registries.militaryCommandRegistry = {
      people: [{ personId: "military-person-1", sourceUserId: 8, personalName: "李承远", name: "指挥者", bornMonth: -300, factionId: "qin", status: "ACTIVE",
        appointments: [{ factionId: "qin", startMonth: 12, commandId: "military-command-1" }], capturedEventIds: [eventId] }],
      formations: [{ commandId: "military-command-1", factionId: "qin", commanderPersonId: "military-person-1", memberUnitIds: ["unit-2"],
        createdMonth: 12, status: "ACTIVE", targetCityId: "wei-city", orderStartMonth: 12, captures: [{ eventId, cityId: "wei-city", month: 24 }] }],
      personSequence: 2, commandSequence: 2, lastEvaluationMonth: 12,
    };
  addInitialOfficeFacts(save);
    expect(validateWorldSave(JSON.parse(JSON.stringify(save)))).toEqual({ valid: true, errors: [] });
    for(const royalBinding of ["user","unit"]){
      const conflicting=structuredClone(save);
      if(royalBinding==="user")conflicting.users.find((u:any)=>u.userId===8).rulerId="qin-ruler-1";
      else conflicting.units.find((u:any)=>u.unitId==="unit-2").rulerId="qin-ruler-1";
      expect(validateWorldSave(conflicting).valid).toBe(false);
      const errors=validateMilitaryCommandState(conflicting.registries.militaryCommandRegistry,conflicting.users,conflicting.units,conflicting.cities,new Set(["qin","wei"]),42,conflicting.worldHistory);
      expect(errors).toContain(royalBinding==="user"?"active military person has no matching live User: military-person-1":"active formation references invalid member unit: unit-2");
    }
    for(const size of [3,5]){
      const oversized=structuredClone(save),formation=oversized.registries.militaryCommandRegistry.formations[0];
      for(let i=formation.memberUnitIds.length;i<size;i++){
        const unitId=`extra-unit-${i}`,userId=100+i;
        oversized.users.push({...oversized.users.find((u:any)=>u.userId===9),userId,playerUnitId:unitId});
        oversized.units.push({...oversized.units.find((u:any)=>u.unitId==='unit-3'),unitId,userId});formation.memberUnitIds.push(unitId);
      }
      const before=JSON.stringify(oversized),errors=validateMilitaryCommandState(oversized.registries.militaryCommandRegistry,oversized.users,oversized.units,oversized.cities,new Set(['qin','wei']),42,oversized.worldHistory);
      expect(errors).toContain('active formation exceeds office capacity (incompatible old military rules): military-command-1');
      if(size===5)expect(errors).toContain('active formation size is invalid: military-command-1');
      expect(JSON.stringify(oversized)).toBe(before); // rejecting an old slot never rewrites it
    }
    const royalMember=structuredClone(save);royalMember.users.find((u:any)=>u.userId===8).rulerId="qin-ruler-1";
    expect(validateMilitaryCommandState(royalMember.registries.militaryCommandRegistry,royalMember.users,royalMember.units,royalMember.cities,new Set(["qin","wei"]),42,royalMember.worldHistory)).toContain("active formation references invalid member unit: unit-2");
    const broken = structuredClone(save);
    broken.registries.militaryCommandRegistry.formations[0].memberUnitIds.push("unit-2");
    expect(validateWorldSave(broken).errors).toContain("active formation size is invalid: military-command-1");
    const dangling = structuredClone(save);
    dangling.registries.militaryCommandRegistry.formations[0].memberUnitIds[1] = "missing-unit";
    expect(validateWorldSave(dangling).errors).toContain("active formation references invalid member unit: missing-unit");
  });

  it("rejects duplicate ids, non-finite values and class instances", () => {
    const save = fixture();
    save.users.push({ userId: 7, factionId: "qin", sourceFactionId: "qin", name: "duplicate", loyalty: 0, role: "NORMAL", score: 0, bornMonth: -360, playerUnitId: "unit-1" });
    save.units[0].x = Number.NaN;
    expect(validateWorldSave(save).valid).toBe(false);
    expect(validateWorldSave({ ...fixture(), world: new Date() }).valid).toBe(false);
  });

  it("rejects Maps, Sets, functions and circular objects instead of silently losing them", () => {
    const save = fixture() as any;
    save.registries = { map: new Map([["x", 1]]), set: new Set(["x"]), callback: () => undefined };
    expect(validateWorldSave(save).valid).toBe(false);
    const circular: any = fixture();
    circular.registries = { self: circular };
    expect(validateWorldSave(circular).valid).toBe(false);
  });

  it("requires authoritative population sequence counters", () => {
    const save = fixture();
    save.populationSystem.counters = [] as never;
    expect(validateWorldSave(save).errors).toContain("populationSystem.counters must be an object");

    save.populationSystem = { counters: { qin: 1.5 }, lastGrowthMonth: 12, wartimeLossMonths: {} };
    expect(validateWorldSave(save).errors).toContain("populationSystem.counters.qin must be a non-negative integer");
  });

  it("validates WorldEventSystem Record maps and cycle state by their runtime shapes", () => {
    const save = fixture();
    save.worldEventSystem.cityFoundedMonths = { qin: 12 };
    save.worldEventSystem.cityRebellionMonths = { xianyang: 24 };
    save.worldEventSystem.cycleState = { fragmentationStartMonth: 0, hegemonicMomentum: 4 };
    expect(validateWorldSave(save).valid).toBe(true);

    save.worldEventSystem.cityFoundedMonths = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityFoundedMonths must be an object");

    save.worldEventSystem.cityFoundedMonths = { qin: Number.POSITIVE_INFINITY };
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityFoundedMonths.qin must be an integer month");

    save.worldEventSystem.cityFoundedMonths = {};
    save.worldEventSystem.cityRebellionMonths = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityRebellionMonths must be an object");

    save.worldEventSystem.cityRebellionMonths = {};
    save.worldEventSystem.cycleState = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cycleState must be an object");
  });

  it("requires active city-cell HP to match authoritative City.defense", () => {
    const save = fixture();
    save.blocks[0].homeHitPoints = 10;
    save.blocks.push({ gridX: 1, gridY: 0, ownerFactionId: "qin", isHome: true, homeHitPoints: 3 });
    expect(validateWorldSave(save).valid).toBe(true);

    save.blocks[0].homeHitPoints = 9;
    expect(validateWorldSave(save).errors).toContain("block.homeHitPoints must match city.defense for active city xianyang");
  });

  it("rejects malformed imported nested arrays before hydration teardown", () => {
    const save = fixture();
    save.worldExiles = [{ factionId: "qin", heirIds: null } as never];
    expect(validateWorldSave(save).errors).toContain("worldExiles[0].heirIds must be an array of strings");

    save.worldExiles = [];
    save.registries.archivedCities = [{ id: "old-city", historicalOwners: [], history: [null] }];
    expect(validateWorldSave(save).errors).toContain("registries.archivedCities[0].history must be an array of objects");
  });

  it("requires a paused complete simulation boundary", () => {
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(true);
    expect(isSafeSnapshotBoundary({ paused: false, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 1, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0.1 })).toBe(false);
  });
});

it("V17 validates persisted national casualty budgets and bounded migration settlement plans",()=>{
  const s=fixture();s.populationSystem.wartimeLossMonths={qin:36};
  s.worldEventSystem.activeEffects=[{id:"migration-1",type:"migration",factionId:"qin",startMonth:24,endMonth:60,remainingPopulation:2,lastSettlementMonth:36,modifiers:{populationGrowthMultiplier:1}}];
  expect(validateWorldSave(s)).toEqual({valid:true,errors:[]});
  for(const mutate of [
    (x:any)=>delete x.populationSystem.wartimeLossMonths,
    (x:any)=>x.populationSystem.wartimeLossMonths.qin=43,
    (x:any)=>x.populationSystem.wartimeLossMonths.missing=1,
    (x:any)=>x.worldEventSystem.activeEffects[0].remainingPopulation=7,
    (x:any)=>x.worldEventSystem.activeEffects[0].lastSettlementMonth=43,
    (x:any)=>x.worldEventSystem.activeEffects[0].lastSettlementMonth=23,
    (x:any)=>x.worldEventSystem.activeEffects.push({...x.worldEventSystem.activeEffects[0],id:"second"}),
    (x:any)=>x.worldEventSystem.activeEffects[0].type="harvest",
  ]){const broken=structuredClone(s);mutate(broken);expect(validateWorldSave(broken).valid).toBe(false);}
  const old={...s,saveSchemaVersion:16},before=JSON.stringify(old);
  expect(validateWorldSave(old)).toEqual({valid:false,errors:["该存档版本已不受支持，请创建新世界。"]});expect(JSON.stringify(old)).toBe(before);
});

it("rejects V20 before hydration without rewriting the old save",()=>{
 const old={...fixture(),saveSchemaVersion:20},before=JSON.stringify(old);
 expect(validateWorldSave(old).valid).toBe(false);
 expect(validateWorldSave(old).errors).toContain("该存档版本已不受支持，请创建新世界。");
 expect(JSON.stringify(old)).toBe(before);
});
