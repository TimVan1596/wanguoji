import { describe, expect, it, vi } from "vitest";
import { readRuntimeLifetimeDiagnostics } from "./RuntimeLifetimeDiagnostics";
import worldRandom from "../Simulation/WorldRandom";
import { formatCoreDiagnostics } from "./DiagnosticsReport";

describe("runtime lifetime observations", () => {
  it("counts nested scene objects, inactive bodies, groups, deferred colliders, timers and scoped listeners without mutation/RNG", () => {
    const group: any = { children: { entries: [] }, getChildren: () => [] };
    const scene: any = { children: { list: [{ type: "Graphics" }, { type: "Container", list: [{ type: "Image" }, { type: "Text" }] }] },
      physics: { world: { bodies: { entries: [{ enable: true, gameObject: { active: true } }, { enable: false }] }, staticBodies: { entries: [1] },
        colliders: { getActive: () => [1, 2], _pending: [3], _destroy: [2], update: vi.fn(() => { throw Error("must not drain"); }) } } },
      sys: { updateList: { getActive: () => [group], _pending: [group] } }, time: { _active: [1], _pendingInsertion: [2], _pendingRemoval: [] },
      input: { eventNames: () => ["a"], listenerCount: () => 3 } };
    const team: any = { status: "ACTIVE", users: new Set(), players: group, farms: { npcs: new Map(), farms: new Map() },
      cities: [{ fortifiedCells: [1, 2], zoneOutline: { scene: {} } }, { destroyed: true, fortifiedCells: [] }] };
    const before = worldRandom.exportState();
    const result = readRuntimeLifetimeDiagnostics(scene, [team], { fixedSteps: 999, interactionCells: 2, colliders: { colliders: 2, targetReferences: 3 }, visibilityListener: true });
    expect(result).toMatchObject({ sessionFixedSteps: 999, sceneChildren: 2, sceneObjectsIncludingContainerChildren: 4,
      graphics: 1, spriteImage: 1, text: 1, dynamicBodies: 2, activeBodies: 1, inactiveBodies: 1, staticBodies: 1,
      arcadeColliders: 2, pendingColliders: 1, deferredColliderRemovals: 1, runtimeGroupsInUpdateList: 1,
      activeCities: 1, destroyedCitiesStillReferenced: 1, fortifiedCells: 2, listeners: { input: 3 } });
    expect(formatCoreDiagnostics({ runtimeLifetime: result })).toContain("Long-Run Runtime Lifetime");
    expect(worldRandom.exportState()).toEqual(before);
    expect(scene.physics.world.colliders.update).not.toHaveBeenCalled();
    expect(scene.physics.world.colliders._pending).toEqual([3]);
  });
  it("distinguishes harmless pending disposal from active invalid groups and warns without fatal", () => {
    const user: any = { team: { users: new Set() } };
    const pending: any = { user, disposalPending: true, active: false, children: { entries: [] }, getChildren: () => [] };
    const invalid = { ...pending, active: true, children: undefined };
    const scene = { sys: { updateList: { getActive: () => [pending, invalid], _pending: [] } } };
    const result = readRuntimeLifetimeDiagnostics(scene, [], { fixedSteps: 0, interactionCells: 0, colliders: {}, visibilityListener: false });
    expect(result.orphanedUserGroups).toBe(0);
    expect(result.disposedUserGroupsStillEligibleForPreUpdate).toBe(1);
    expect(result.userGroupInvariantWarnings).toContain("DISPOSED_USER_GROUP_PREUPDATE_ELIGIBLE");
    expect(pending.active).toBe(false);
  });
  it("reports unavailable private-engine counters as unavailable, not fabricated zeros", () => {
    const result = readRuntimeLifetimeDiagnostics({}, [], { fixedSteps: 0, interactionCells: 0, colliders: {}, visibilityListener: false });
    expect(result.timerEvents.active).toBeUndefined();
    expect(result.arcadeColliders).toBeUndefined();
    expect(result.listeners.input).toBeUndefined();
  });
});
