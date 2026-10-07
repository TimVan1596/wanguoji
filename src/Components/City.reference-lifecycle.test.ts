import { beforeEach, describe, expect, it, vi } from "vitest";
const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core, BlockSize: 32 } }));
vi.mock("./Block", () => ({ default: class {} }));
vi.mock("./Team", () => ({ default: class {} }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }) } }));
vi.mock("../History/WorldHistory", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Politics/Dynasty", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Simulation/ArchivedCities", () => ({ default: { archive: (city: any) => ({ id: city.id }) } }));
import City from "./City";

function fixture() {
  const blocks = Array.from({ length: 7 }, (_, x) => Array.from({ length: 7 }, (_, y) => ({ x: x * 32, y: y * 32,
    city: undefined as any, isCityCenter: false, isHome: false, team: undefined as any,
    setCity(city: any, center: boolean) { this.city = city; this.isCityCenter = center; this.isHome = city.isCapital; },
    clearCity(city: any) { if (this.city === city) { this.city = undefined; this.isCityCenter = false; this.isHome = false; } },
    claimForTeam(team: any) { this.team = team; }, updateCityDisplay: vi.fn(),
  })));
  const owners = ["A", "B", "C"].map(name => ({ name, displayName: name, status: "ACTIVE", origin: {},
    cities: [] as any[], capitalCity: {} as any, markActive: vi.fn(), chooseCapitalCandidate: () => undefined,
    addCity(city: any) { this.cities.push(city); }, removeCity(city: any) { this.cities = this.cities.filter(c => c !== city); },
  }));
  const city: any = Object.assign(Object.create(City.prototype), { id: "秦-city-312-2", name: "故城", block: blocks[3][3],
    ownerFactionId: "A", founderFactionId: "A", isCapital: false, destroyed: false, devastation: 100, defense: 8, maxDefense: 8,
    captureCount: 0, history: [], fortifiedCells: [], siegeContacts: new Map(), lastRepairYear: 0, lastLoyaltyYear: 0 });
  owners[0].cities = [city, ...Array.from({ length: 5 }, (_, i) => ({ id: `other-${i}` }))];
  Object.assign(core, { teams: owners, map: { blocks, getBlock: (x: number, y: number) => blocks[x]?.[y] }, registerCityInteraction: vi.fn(), unregisterCityInteraction: vi.fn(), handleFactionExtinction: vi.fn() });
  vi.spyOn(city, "refreshZoneVisual").mockImplementation(() => {});
  vi.spyOn(city, "calculateMaxDefense").mockReturnValue(12);
  city.rebuildFortifiedZone();
  const refs = () => blocks.flat().filter(b => b.city === city);
  return { city, blocks, owners, refs };
}
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal("Phaser", { Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)) } }); });
describe("actual City lifecycle across full map references", () => {
  it("does not rebuild a permanently destroyed city later in the same monthly update", () => {
    const { city, refs } = fixture();
    vi.spyOn(city, "updateLoyalty").mockImplementation(() => {});
    vi.spyOn(city, "updateSiege").mockImplementation(() => {});
    city.updateDefense(120); // actual updateDevastation -> actual destruction -> previously a larger zone rebuild
    expect(city.destroyed).toBe(true); expect(refs()).toHaveLength(0);
    expect(city.fortifiedCells).toHaveLength(0);
    city.rebuildFortifiedZone(); expect(refs()).toHaveLength(0);
  });
  it("expands, shrinks, and destroys without stale references anywhere on the map", () => {
    const { city, refs, blocks } = fixture();
    city.maxDefense = 12; city.rebuildFortifiedZone(); expect(refs()).toHaveLength(13);
    city.maxDefense = 5; city.rebuildFortifiedZone(); expect(refs()).toEqual([city.block]);
    city.maxDefense = 10; city.rebuildFortifiedZone(); expect(refs()).toHaveLength(9);
    // A stale reference outside the last zone must be cleared at terminal cleanup too.
    blocks[0][0].setCity(city, false);
    expect(city.destroyPermanently(120)).toBe(true);
    expect(refs()).toHaveLength(0); expect(blocks.flat().every(b => !b.isCityCenter)).toBe(true);
  });
  it("survives actual capture/revolt/merge transfers and repeated captures before destruction", () => {
    const { city, owners, refs } = fixture();
    city.capture(owners[1], 120); expect(city.ownerFactionId).toBe("B");
    city.revoltTo(owners[2], 140); expect(city.ownerFactionId).toBe("C");
    city.administrativeMergeTransferTo(owners[0], 160); expect(city.ownerFactionId).toBe("A");
    for (let i = 0; i < 10; i++) city.capture(owners[i % 2 ? 0 : 1], 180 + i * 24);
    expect(refs().every(b => city.fortifiedCells.includes(b))).toBe(true);
    city.devastation = 100; expect(city.destroyPermanently(500)).toBe(true); expect(refs()).toHaveLength(0);
  });
});
