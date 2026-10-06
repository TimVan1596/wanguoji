import { createRequire } from "node:module";
import { beforeAll, describe, expect, it, vi } from "vitest";
const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core } }));
vi.mock("./Team", () => ({ default: class { static GetOtherTeams() { return core.teams ?? []; } } }));
vi.mock("./Player", () => ({ default: class {} }));
vi.mock("./Npc", () => ({ default: class {} }));
const require = createRequire(import.meta.url);
const UpdateList = require("phaser/src/gameobjects/UpdateList");
const Group = require("phaser/src/gameobjects/group/Group");
const Queue = require("phaser/src/structs/ProcessQueue");
const Clock = require("phaser/src/time/Clock");
const Emitter = require("eventemitter3");
import { destroyRuntimeGroupAtSafeBoundary } from "../Simulation/RuntimeGroupDisposal";
import { DeferredUserGroupDisposal } from "../Simulation/DeferredUserGroupDisposal";
import worldRandom from "../Simulation/WorldRandom";
import { createDeterminismCheckpoint } from "../Simulation/DeterminismFingerprint";
let User: any;
let Farms: any;
beforeAll(async () => {
  vi.stubGlobal("Phaser", { GameObjects: { Group } });
  User = (await import("./User")).default;
  Farms = (await import("./Farms")).default;
});
function runtime() {
  const events = new Emitter();
  const disposals = new DeferredUserGroupDisposal();
  const queue = new Queue();
  const world = { colliders: queue };
  const scene: any = { sys: { events }, events,
    add: { existing: (object: any) => scene.sys.updateList.add(object) },
    physics: { add: { collider: vi.fn(() => {
      const collider: any = { world, active: true, destroy: vi.fn(() => { queue.remove(collider); collider.active = false; collider.world = null; }) };
      queue.add(collider);
      return collider;
    }) } }, time: { removeEvent: vi.fn() } };
  scene.sys.updateList = new UpdateList(scene);
  scene.sys.updateList.start();
  disposals.bind(events);
  const groups = { get size() { return new Set([...scene.sys.updateList.getActive(), ...scene.sys.updateList._pending]).size; } };
  const drain = () => { events.emit("postupdate"); events.emit("preupdate"); events.emit("update", 1, 16); queue.update(); };
  Object.assign(core, { registerUserGroupForDisposal: (group: any) => disposals.register(group), deferUserGroupDisposal: (group: any) => disposals.enqueue(group), recordUserDeathForDiagnostics: vi.fn(), onPlayerOverlapBlock: vi.fn(), scene, map: { blocksGroup: {} }, teams: [], logicalUnitRegistry: { unregisterUser: vi.fn() } });
  return { groups, queue, scene, disposals, events, drain };
}
describe("live User/Slaves resource lifetime", () => {
  it("reproduces v27b synchronous Group.destroy leaving a pending zombie whose preUpdate reads undefined.size", () => {
    const { scene, events } = runtime();
    const group = new Group(scene); group.runChildUpdate = true;
    scene.add.existing(group);
    group.destroy(false, false);
    events.emit("preupdate");
    expect(scene.sys.updateList.getActive()).toContain(group);
    expect(() => events.emit("update", 1, 16)).toThrow(/size/);
  });
  it("terminalizes a User during the actual UpdateList iteration and safely destroys only after POST_UPDATE", () => {
    const { scene, queue, events, disposals, drain } = runtime();
    const team: any = { users: new Set() };
    let user: any;
    const killer = { active: true, preUpdate: () => { killer.active = false; user.destroyUser(); } };
    scene.add.existing(killer);
    user = new User(1, "u", team, { destroyPlayerTree: vi.fn() }, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
    team.users.add(user); user.slaveGroup.addCollider();
    const group = user.slaveGroup;
    const child: any = new Emitter(); child.active = true;
    child.destroyPlayerTree = vi.fn(() => { child.active = false; child.emit("destroy", child); });
    group.add(child); group.npcs.set("owned-child", child);
    const preUpdate = vi.spyOn(group, "preUpdate"); const destroy = vi.spyOn(group, "destroy");
    events.emit("preupdate"); queue.update();
    expect(() => events.emit("update", 1, 16)).not.toThrow();
    expect(group.active).toBe(false); expect(group.runChildUpdate).toBe(false);
    expect(group.children).toBeDefined(); expect(group.children.size).toBe(0); expect(group.collider).toBeUndefined();
    expect(child.active).toBe(false); expect(child.destroyPlayerTree).toHaveBeenCalledTimes(1);
    expect(preUpdate).not.toHaveBeenCalled(); expect(destroy).not.toHaveBeenCalled();
    expect(disposals.snapshot().deferredUserGroupDisposals).toBe(1);
    expect(team.users.size).toBe(0);
    drain();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(scene.sys.updateList.getActive()).not.toContain(group);
    expect(queue.getActive()).toHaveLength(0);
    expect(disposals.snapshot().deferredUserGroupDisposals).toBe(0);
  });
  it("100 user deaths during one real UPDATE traversal drain without orphan groups, replacement colliders or Fatal", () => {
    const { scene, events, disposals, groups, queue, drain } = runtime();
    const team: any = { users: new Set() };
    const kill = { active: true, preUpdate() {
      kill.active = false;
      for (const user of [...team.users] as any[]) user.destroyUser();
    } };
    scene.add.existing(kill);
    for (let id = 0; id < 100; id++) {
      const user = new User(id, "u", team, { destroyPlayerTree: vi.fn() }, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      team.users.add(user); user.slaveGroup.addCollider();
    }
    events.emit("preupdate"); queue.update();
    expect(() => events.emit("update", 1, 16)).not.toThrow();
    expect(disposals.snapshot()).toMatchObject({ deferredUserGroupDisposals: 100, registeredUserGroups: 100 });
    drain(); scene.sys.updateList.remove(kill); events.emit("preupdate");
    expect(groups.size).toBe(0); expect(queue.getActive()).toHaveLength(0);
    expect(disposals.snapshot()).toMatchObject({ deferredUserGroupDisposals: 0, registeredUserGroups: 0 });
    expect(scene.physics.add.collider).toHaveBeenCalledTimes(100);
  });
  it("warns without throwing if a disposal survives multiple scene frames", () => {
    const { events } = runtime(); let frame = 10;
    const queue = new DeferredUserGroupDisposal(() => frame);
    const group = { scene: {}, disposalPending: true, finishRuntimeDisposal: vi.fn(), once: vi.fn() };
    queue.bind(events); queue.register(group); queue.enqueue(group);
    frame += 4;
    expect(queue.snapshot()).toMatchObject({ deferredUserGroupDisposals: 1, oldestPendingSceneFrames: 4, warning: "USER_GROUP_DISPOSAL_STALLED" });
    events.emit("postupdate");
    expect(queue.snapshot().deferredUserGroupDisposals).toBe(0);
    expect(group.finishRuntimeDisposal).toHaveBeenCalledTimes(1);
  });
  it("reset/hydration flushes pending disposals once and binds only one POST_UPDATE listener", () => {
    const { scene, events, disposals, drain } = runtime();
    disposals.bind(events); disposals.bind(events);
    expect(events.listenerCount("postupdate")).toBe(1);
    for (let iteration = 0; iteration < 3; iteration++) {
      const user = new User(iteration, "u", { users: new Set() }, {}, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      user.slaveGroup.addCollider();
      const destroy = vi.spyOn(user.slaveGroup, "destroy");
      user.slaveGroup.dispose(); user.slaveGroup.dispose();
      disposals.resetAtSafeBoundary(); drain();
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(scene.sys.updateList.getActive()).toHaveLength(0);
      expect(disposals.snapshot().registeredUserGroups).toBe(0);
    }
  });
  it("runtime cleanup diagnostics on/off preserve same-seed canonical projection and RNG position", () => {
    const run = (debug: boolean) => {
      const { disposals, drain } = runtime(); worldRandom.initialize("group-lifecycle");
      const team: any = { users: new Set() };
      for (let id = 0; id < 100; id++) {
        const user = new User(id, String(worldRandom.int(1, 100)), team, { destroyPlayerTree: vi.fn() }, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
        team.users.add(user); user.slaveGroup.addCollider(); if (id % 3) user.destroyUser();
        if (debug) disposals.snapshot();
        drain();
      }
      const rng = worldRandom.exportState();
      const userIds = [...team.users].map((user: any) => user.id);
      const checkpoint = createDeterminismCheckpoint({ worldMonth: 100, random: rng, factions: [{ factionId: "a", status: "ACTIVE", population: team.users.size }], cities: [], territory: [] });
      return { userIds, rng, checkpoint };
    };
    expect(run(true)).toEqual(run(false));
  });
  it("measures the previous reset-on-death sequence retaining one group/collider per dead user", () => {
    const { groups, queue, drain } = runtime();
    const stale: any[] = [];
    for (let id = 1; id <= 100; id++) {
      const user = new User(id, `old-${id}`, { users: new Set() }, {}, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      user.slaveGroup.addCollider(); queue.update();
      user.slaveGroup.reset(); queue.update(); // Previous death cleanup; reset creates another collider.
      stale.push(user.slaveGroup);
    }
    expect(groups.size).toBe(100);
    expect(queue.getActive()).toHaveLength(100);
    stale.forEach((group) => group.dispose()); drain();
    expect(groups.size).toBe(0);
    expect(queue.getActive()).toHaveLength(0);
  });
  it("100 deaths leave no replacement collider or orphaned update-list group", () => {
    const { groups, queue, scene, drain } = runtime();
    for (let id = 1; id <= 100; id++) {
      const team: any = { users: new Set() };
      const player: any = { destroyPlayerTree: vi.fn() };
      const user = new User(id, `u${id}`, team, player, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      team.users.add(user);
      user.slaveGroup.addCollider();
      if (id % 2) queue.update(); // Includes destruction before pending insertion.
      expect(user.destroyUser()).toBe(true);
      drain();
      expect(groups.size).toBe(0);
      expect(queue.getActive()).toHaveLength(0);
      expect(team.users.size).toBe(0);
      user.slaveGroup.dispose(); // Idempotent terminal cleanup.
    }
    expect(scene.physics.add.collider).toHaveBeenCalledTimes(100);
  });
  it("transfer reset keeps one live group/collider and repeated hydration detaches only once", () => {
    const { groups, queue, drain } = runtime();
    const user = new User(1, "a", { users: new Set() }, {}, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
    user.slaveGroup.addCollider();
    for (let index = 0; index < 20; index++) {
      queue.update();
      user.slaveGroup.reset();
      queue.update();
      expect(groups.size).toBe(1);
      expect(queue.getActive()).toHaveLength(1);
    }
    for (let index = 0; index < 3; index++) {
      const collider = user.slaveGroup.collider;
      collider.destroy(); queue.update();
      user.slaveGroup.detachColliderAfterWorldTeardown();
      user.slaveGroup.addCollider(); user.slaveGroup.addCollider(); queue.update();
      expect(collider.destroy).toHaveBeenCalledTimes(1);
      expect(queue.getActive()).toHaveLength(1);
    }
    user.slaveGroup.dispose(); drain();
    expect(groups.size).toBe(0);
    expect(queue.getActive()).toHaveLength(0);
  });
  it("quiescent hydration also safely removes runChildUpdate farm groups before their first activation", () => {
    const { scene, events } = runtime();
    for (let iteration = 0; iteration < 30; iteration++) {
      const farms = new Farms(scene, {}, []);
      expect(scene.sys.updateList._pending).toContain(farms);
      destroyRuntimeGroupAtSafeBoundary(farms, true);
      events.emit("preupdate");
      expect(() => events.emit("update", 1, 16)).not.toThrow();
      expect(scene.sys.updateList.getActive()).not.toContain(farms);
      expect(scene.sys.updateList._pending).not.toContain(farms);
    }
  });
  it("repeated farm hydration/teardown does not accumulate Clock timers and preserves timer DTOs", () => {
    const { scene } = runtime();
    scene.sys.events = new Emitter();
    scene.time = new Clock(scene);
    let saved: any;
    for (let iteration = 0; iteration < 30; iteration++) {
      const farm = new Farms(scene, {}, [{ name: "a", delay: 10000, loop: true, startAt: 50 }]);
      farm.init(saved?.timers);
      scene.time.preUpdate();
      expect(scene.time._active).toHaveLength(1);
      const before = farm.exportState();
      farm.setDie();
      expect(scene.time._active).toHaveLength(0);
      expect(scene.time._pendingInsertion).toHaveLength(0);
      expect(farm.exportState()).toEqual(before);
      if (saved) expect(before).toEqual(saved);
      saved = before;
      farm.destroy(false, false);
    }
  });
  it("farm termination unlinks Clock timers while preserving their serialized counters", () => {
    const { scene } = runtime();
    const farms = new Farms(scene, {}, []);
    const timer = { elapsed: 50, repeatCount: 500, destroy: vi.fn() };
    farms.farms.set("a", timer);
    farms.setDie();
    expect(scene.time.removeEvent).toHaveBeenCalledWith(timer);
    expect(timer.destroy).toHaveBeenCalledTimes(1);
    expect(timer.elapsed).toBe(50);
    expect(timer.repeatCount).toBe(500);
  });
});
