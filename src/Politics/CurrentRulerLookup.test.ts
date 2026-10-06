import { describe, expect, it } from "vitest";
import { CurrentRulerLookup } from "./CurrentRulerLookup";

describe("derived current ruler lookup", () => {
  it("matches linear lookup through succession, replacement, reorder and hydration", () => {
    const lookup = new CurrentRulerLookup();
    const dynasty = { currentRulerId: "r0", rulers: Array.from({ length: 2000 }, (_, i) => ({ id: `r${i}`, value: i })) };
    for (const id of ["r0", "r1999", "r500", "missing", "r1999"]) {
      dynasty.currentRulerId = id;
      expect(lookup.get(dynasty)).toBe(dynasty.rulers.find((ruler) => ruler.id === id));
    }
    dynasty.rulers[1999] = { id: "r1999", value: 3000 };
    expect(lookup.get(dynasty)?.value).toBe(3000);
    dynasty.rulers.reverse();
    expect(lookup.get(dynasty)).toBe(dynasty.rulers.find(ruler => ruler.id === dynasty.currentRulerId));
    const hydrated = structuredClone(dynasty);
    expect(lookup.get(hydrated)).toBe(hydrated.rulers.find(ruler => ruler.id === hydrated.currentRulerId));
    lookup.reset();
    expect(lookup.get(hydrated)).toBe(hydrated.rulers[0]);
  });
  it.each([475, 1219, 5000])("counts archive reads before and after caching at %i rulers", (size) => {
    let reads = 0;
    const dynasty = { currentRulerId: `r${size - 1}`, rulers: Array.from({ length: size }, (_, i) => ({ get id() { reads++; return `r${i}`; } })) };
    for (let i = 0; i < 100; i++) dynasty.rulers.find(ruler => ruler.id === dynasty.currentRulerId);
    expect(reads).toBe(size * 100);
    reads = 0;
    const lookup = new CurrentRulerLookup();
    for (let i = 0; i < 100; i++) lookup.get(dynasty);
    expect(reads).toBeLessThan(size + 201);
  });
});
