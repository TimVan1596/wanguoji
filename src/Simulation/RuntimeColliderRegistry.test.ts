import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { RuntimeColliderRegistry } from "./RuntimeColliderRegistry";
const Queue = createRequire(import.meta.url)("phaser/src/structs/ProcessQueue");
const group = () => ({ getChildren: () => [] });
describe("Core faction collider lifecycle", () => {
  it("repeated rebel/split creation and merge/extinction returns counts/references to active-world baseline", () => {
    const registry = new RuntimeColliderRegistry();
    const queue = new Queue();
    const world = { colliders: queue };
    const active = { name: "a", status: "ACTIVE", blocks: group() };
    const map = group();
    const add = (source: typeof active, targets: any[]) => registry.register(source, group(), targets, () => {
      const collider: any = { world, destroy: () => { queue.remove(collider); collider.world = null; } };
      queue.add(collider); return collider;
    });
    add(active, [map]); queue.update();
    for (let index = 0; index < 200; index++) {
      const faction = { name: `rebel-split-${index}`, status: "ACTIVE", blocks: group(), terminationReason: undefined as string | undefined };
      add(active, [faction.blocks]); add(faction, [map, active.blocks]);
      if (index % 2) queue.update();
      faction.status = "EXTINCT";
      faction.terminationReason = index % 2 ? "EXTINCT" : "MERGED";
      registry.releaseTerminal(faction); queue.update();
      expect(registry.snapshot()).toEqual({ colliders: 1, targetReferences: 1, pendingTerminalFactions: 0 });
      expect(queue.getActive()).toHaveLength(1);
    }
  });
  it("defers target pruning until the fixed-step boundary and detaches after hydration", () => {
    const registry = new RuntimeColliderRegistry();
    const active = { name: "a", status: "ACTIVE", blocks: group() };
    const terminal = { name: "b", status: "EXTINCT", blocks: group() };
    const targets = [terminal.blocks, active.blocks];
    registry.register(active, group(), targets, () => ({ destroy() {} }));
    registry.scheduleTerminal(terminal);
    expect(targets).toHaveLength(2); // A collision callback cannot shift the in-progress target loop.
    expect(registry.snapshot().pendingTerminalFactions).toBe(1);
    registry.flushTerminal();
    expect(targets).toEqual([active.blocks]);
    registry.scheduleTerminal(terminal);
    registry.detachAfterWorldTeardown(); registry.flushTerminal();
    expect(registry.snapshot()).toEqual({ colliders: 0, targetReferences: 0, pendingTerminalFactions: 0 });
  });
  it("preserves exiled remnants and any actual terminal units/territory", () => {
    const registry = new RuntimeColliderRegistry();
    const faction = { name: "a", status: "EXILED", blocks: { getChildren: () => [1] } };
    let destroys = 0;
    const targets = [faction.blocks];
    registry.register(faction, { getChildren: () => [1] }, targets, () => ({ destroy: () => destroys++ }));
    registry.releaseTerminal(faction);
    faction.status = "EXTINCT"; registry.releaseTerminal(faction);
    expect(destroys).toBe(0);
    expect(targets).toHaveLength(1);
  });

  it("retains real terminal resources, then releases when the last unit/territory leaves", () => {
    const registry = new RuntimeColliderRegistry();
    const cells = [1]; const units = [1];
    const faction = { name: "terminal", status: "EXTINCT", blocks: { getChildren: () => cells } };
    let destroys = 0;
    registry.register(faction, { getChildren: () => units }, [group()], () => ({ destroy: () => destroys++ }));
    registry.scheduleTerminal(faction); registry.flushTerminal();
    expect(destroys).toBe(0);
    units.pop(); cells.pop();
    registry.scheduleTerminal(faction); registry.flushTerminal();
    expect(destroys).toBe(1);
    expect(registry.snapshot().colliders).toBe(0);
  });
});
