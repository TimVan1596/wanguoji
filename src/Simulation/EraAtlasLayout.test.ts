import { describe, expect, it } from "vitest";
import { analyzeEraSnapshot, layoutEraCountryLabels } from "./EraAtlasLayout";
import { encodeOwnerRuns, type EraMapSnapshotV1 } from "./EraMapSnapshot";
import worldRandom from "./WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
function snapshot(w: number, h: number, owner: (x: number, y: number) => number): EraMapSnapshotV1 {
  return { version: 1, capturedMonth: 100, widthCells: w, heightCells: h,
    factionPalette: [{ factionId: "a", displayName: "旧秦", color: 0xaa0000 }, { factionId: "b", displayName: "旧楚", color: 0x224488 }, { factionId: "city-only", displayName: "义军", color: 0x115533 }],
    ownerRuns: encodeOwnerRuns(Array.from({ length: w * h }, (_, i) => owner(i % w, Math.floor(i / w)))),
    cities: [{ cityId: "c", name: "城", gridX: 0, gridY: 0, ownerFactionId: "city-only", isCapital: false }] };
}
describe("snapshot-only Era Atlas analysis and label geometry", () => {
  it("counts world cells including neutral space, zero-cell palette members and snapshot city ownership", () => {
    const s = snapshot(10, 10, x => x < 4 ? 1 : x < 7 ? 2 : 0), a = analyzeEraSnapshot(s);
    expect(a.territories.map(x => [x.factionId, x.controlledCells, x.worldShare, x.cityCount])).toEqual([["a", 40, .4, 0], ["b", 30, .3, 0], ["city-only", 0, 0, 1]]);
    expect(a.territories.reduce((n, r) => n + r.worldShare, 0)).toBe(.7);
    expect(layoutEraCountryLabels(s, 18, true).some(x => x.factionId === "city-only")).toBe(false);
  });
  it("sorts tied areas by stable faction ID, not palette order", () => {
    const s = snapshot(10, 10, x => x < 5 ? 1 : 2); s.factionPalette[0].factionId = "z";
    expect(analyzeEraSnapshot(s).territories.slice(0, 2).map(x => x.factionId)).toEqual(["b", "z"]);
  });
  it("uses only frozen historical names/colors without current-world inputs", () => {
    const s = snapshot(20, 20, () => 1), original = JSON.stringify(s), rng = worldRandom.exportState();
    const labels = layoutEraCountryLabels(s, 18, true);
    expect(labels.map(x => x.text)).toEqual(["旧秦"]); expect(analyzeEraSnapshot(s).territories[0].color).toBe(0xaa0000);
    expect(JSON.stringify(s)).toBe(original); expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(13);
    const restored = JSON.parse(original); expect(analyzeEraSnapshot(restored)).toEqual(analyzeEraSnapshot(s)); expect(layoutEraCountryLabels(restored, 18, true)).toEqual(labels);
  });
  it("places a large country in its interior and draws its name once", () => {
    const s = snapshot(20, 20, () => 1), a = analyzeEraSnapshot(s), labels = layoutEraCountryLabels(s, 18, true);
    expect(labels).toHaveLength(1);
    const i = Math.floor(labels[0].y / 18) * 20 + Math.floor(labels[0].x / 18);
    expect(a.depth[i]).toBeGreaterThan(5); expect(labels[0].left).toBeGreaterThan(0); expect(labels[0].right).toBeLessThan(360); expect(labels[0].right - labels[0].left).toBeLessThanOrEqual(360 * .35);
  });
  it("keeps the whole text box inside the largest component of a ring/island country", () => {
    const s = snapshot(30, 25, (x, y) => x < 7 || x > 22 || y > 18 ? 1 : x >= 13 && x <= 16 && y >= 7 && y <= 10 ? 1 : 2);
    const a = analyzeEraSnapshot(s), label = layoutEraCountryLabels(s, 18, true).find(x => x.factionId === "a")!;
    expect(label).toBeDefined(); const center = Math.floor(label.y / 18) * 30 + Math.floor(label.x / 18);
    const main = a.components[a.candidates.get(1)![0]]; expect(a.components[center]).toBe(main);
    for (let y = Math.floor(label.top / 18); y <= Math.floor((label.bottom - .001) / 18); y++)
      for (let x = Math.floor(label.left / 18); x <= Math.floor((label.right - .001) / 18); x++) expect(a.components[y * 30 + x]).toBe(main);
  });
  it("hides tiny territories and overlong names safely, but preserves legend rows", () => {
    const s = snapshot(20, 20, (x, y) => x === 1 && y === 1 ? 1 : 2);
    expect(layoutEraCountryLabels(s, 18, true).some(x => x.factionId === "a")).toBe(false);
    const long = JSON.parse(JSON.stringify(s)); long.factionPalette[1].displayName = "非常长的历史国号".repeat(30);
    expect(layoutEraCountryLabels(long, 18, true)).toEqual([]); expect(analyzeEraSnapshot(s).territories).toHaveLength(3);
  });
  it("has different thumbnail/full policies, deterministic layout and no overlap with capital markers", () => {
    const s = snapshot(20, 20, x => x < 10 ? 1 : 2); s.cities = [{ cityId: "cap", name: "都", gridX: 4, gridY: 9, ownerFactionId: "a", isCapital: true }];
    const full = layoutEraCountryLabels(s, 18, true), mini = layoutEraCountryLabels(s, 3, false);
    expect(full).toEqual(layoutEraCountryLabels(s, 18, true)); expect(full.length).toBeGreaterThanOrEqual(mini.length);
    expect(full[0].fontSize).toBeGreaterThan(mini[0]?.fontSize ?? 0);
    const cap = { x: 4.5 * 18, y: 9.5 * 18 };
    for (const l of full) expect(cap.x > l.left && cap.x < l.right && cap.y > l.top && cap.y < l.bottom).toBe(false);
  });
  it("memoizes by immutable snapshot identity and does not reuse derived arrays after hydration", () => {
    const s = snapshot(40, 30, x => x < 20 ? 1 : 2), first = analyzeEraSnapshot(s);
    for (let i = 0; i < 100; i++) expect(analyzeEraSnapshot(s)).toBe(first);
    expect(analyzeEraSnapshot(JSON.parse(JSON.stringify(s)))).not.toBe(first);
  });
});
