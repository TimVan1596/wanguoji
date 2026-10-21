import {describe,it,expect} from "vitest";
import {siegePressure} from "./SiegeStrength";
describe("independent siege strength",()=>{
  it("isolated units cannot grind down a city through repeated contacts",()=>{
    expect(siegePressure(1,0,5)).toBe(0);
    expect(siegePressure(0,0,5)).toBe(0);
  });
  it("real defenders stop weak attacks but superior forces can win",()=>{
    expect(siegePressure(3,4,7)).toBe(0);
    expect(siegePressure(8,1,5)).toBe(2);
    expect(siegePressure(3,0,5)).toBeGreaterThan(0);
  });
  it("capital fortification helps without creating population",()=>{
    expect(siegePressure(4,1,7)).toBeLessThan(siegePressure(4,1,5));
    expect(siegePressure(3,1,5)).toBeGreaterThan(0);
    expect(siegePressure(3,1,5)).toBeLessThan(1);
  });
});
