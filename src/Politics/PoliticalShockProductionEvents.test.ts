import { afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: undefined as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Block", () => ({ default: class {} }));
vi.mock("../Components/Team", () => ({ default: class {} }));
vi.mock("../Components/MessageToast", () => ({ MessageToast: class {} }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }), dispatch: vi.fn() } }));
import City from "../Components/City";
import WorldHistory from "../History/WorldHistory";
import { derivePoliticalSuccessionShocks } from "./PoliticalSuccessionCrisis";

describe("production political shock event identities", () => {
  afterEach(() => { WorldHistory.reset(); vi.unstubAllGlobals(); });
  it("captures a real capital-loss event from City.capture with defender/attacker roles and city identity", () => {
    vi.stubGlobal("Phaser", { Math: { Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)) } });
    const reserve = { id: "reserve", name: "新都" };
    const old: any = { name: "state", status: "ACTIVE", cities: [] as any[], removeCity(city: any) { this.cities = this.cities.filter((row: any) => row !== city); },
      addCity(city: any) { this.cities.push(city); }, chooseCapitalCandidate: () => reserve, setCapitalCity() {} };
    const attacker: any = { name: "enemy", status: "ACTIVE", cities: [], addCity(city: any) { this.cities.push(city); }, markActive() {} };
    const city: any = Object.assign(Object.create(City.prototype), { id: "capital-city", name: "故都", ownerFactionId: old.name,
      founderFactionId: old.name, isCapital: true, defense: 8, maxDefense: 10, devastation: 0, loyalty: 80, captureCount: 0,
      fortifiedCells: [], history: [{ year: 0, type: "capital-started", title: "建都" }], clearSiegeState() {},
      rebuildFortifiedZone() {}, claimFortifiedZone() {}, refreshZoneVisual() {}, addHistory() {}, calculateMaxDefense: () => 10,
    });
    old.cities = [city, reserve]; game.Core = { teams: [old, attacker] };
    city.capture(attacker, 500, "enemy-ruler");
    const event = WorldHistory.getEvents().find(row => row.type === "capital-fallen");
    expect(event).toMatchObject({ targetFactionId: "state", previousOwnerFactionId: "state", actorFactionId: "enemy",
      cityId: "capital-city", cityName: "故都", metadata: { wasCapital: 1 } });
    expect(derivePoliticalSuccessionShocks("state", { id: "old-ruler", accessionYear: 400 } as any, 600, [event!]))
      .toEqual([expect.objectContaining({ kind: "CAPITAL_LOSS", factionId: "state", month: 500, cityIds: ["capital-city"] })]);
  });
  it("reads production empire-split roles and city IDs without confusing the rebel for the parent", () => {
    WorldHistory.addEmpireSplit(520, "state", "rebel", ["甲城", "乙城"], ["a", "b"], undefined, undefined, "founding-rebel-520");
    const event = WorldHistory.getEvents()[0];
    expect(event).toMatchObject({ actorFactionId: "rebel", targetFactionId: "state", factionIds: ["state", "rebel"],
      metadata: { parentFactionId: "state", foundingCityIds: "a,b", splitCityCount: 2 } });
    expect(derivePoliticalSuccessionShocks("state", { id: "old-ruler", accessionYear: 400 } as any, 600, [event]))
      .toEqual([expect.objectContaining({ kind: "EMPIRE_SPLIT", factionId: "state", month: 520, cityIds: ["a", "b"], cityNames: ["甲城", "乙城"] })]);
  });
});
