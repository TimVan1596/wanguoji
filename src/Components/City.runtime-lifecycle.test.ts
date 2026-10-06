import { describe, expect, it, vi } from "vitest";
const { core, archive } = vi.hoisted(() => ({ core: {} as any, archive: vi.fn((city: any) => ({ cityId: city.id })) }));
vi.mock("../Game/Game", () => ({ default: { Core: core, BlockSize: 32 } }));
vi.mock("./Block", () => ({ default: class {} }));
vi.mock("./Team", () => ({ default: class {} }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }) } }));
vi.mock("../History/WorldHistory", () => ({ default: { addCityDestroyed: vi.fn() } }));
vi.mock("../Politics/Dynasty", () => ({ default: {} }));
vi.mock("../Simulation/ArchivedCities", () => ({ default: { archive } }));
import City from "./City";
import { CityInteractionIndex } from "../Simulation/CityInteractionIndex";

describe("destroyed City runtime registry", () => {
  it("archives facts and releases interaction, owner and Graphics references without recreating visuals", () => {
    const city: any = Object.create(City.prototype);
    const graphic = { destroy: vi.fn(), clear: vi.fn() };
    Object.assign(city, { id: "doomed", ownerFactionId: "a", devastation: 100, destroyed: false, isCapital: false,
      fortifiedCells: [{ x: 0, y: 0, clearCity: vi.fn(), claimForTeam: vi.fn() }], zoneOutline: graphic,
      block: { scene: { add: { graphics: vi.fn(() => { throw Error("destroyed visual recreated"); }) } } } });
    const owner: any = { name: "a", cities: [city, ...Array.from({ length: 5 }, (_, i) => ({ id: `c${i}` }))],
      removeCity: (target: any) => { owner.cities = owner.cities.filter((item: any) => item !== target); } };
    const index = new CityInteractionIndex(); index.registerCity(city, 32);
    Object.assign(core, { teams: [owner], unregisterCityInteraction: (id: string) => index.unregisterCity(id) });
    expect(city.destroyPermanently(120)).toBe(true);
    expect(index.size).toBe(0);
    expect(owner.cities).not.toContain(city);
    expect(city.zoneOutline).toBeUndefined();
    expect(graphic.destroy).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledWith(city, 120);
    city.refreshZoneVisual();
    expect(city.block.scene.add.graphics).not.toHaveBeenCalled();
    expect(city.destroyPermanently(121)).toBe(false);
  });
});
