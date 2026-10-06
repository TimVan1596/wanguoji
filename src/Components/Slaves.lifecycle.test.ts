import { createRequire } from "node:module";
import { beforeAll, describe, expect, it, vi } from "vitest";
const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core } }));
vi.mock("./Team", () => ({ default: class { static GetOtherTeams() { return core.teams ?? []; } } }));
vi.mock("./Player", () => ({ default: class {} }));
vi.mock("./Npc", () => ({ default: class {} }));
const require = createRequire(import.meta.url);
const Group = require("phaser/src/gameobjects/group/Group");
const Queue = require("phaser/src/structs/ProcessQueue");
const Clock = require("phaser/src/time/Clock");
const Emitter = require("eventemitter3");
let User: any;
let Farms: any;
beforeAll(async () => {
  vi.stubGlobal("Phaser", { GameObjects: { Group } });
  User = (await import("./User")).default;
  Farms = (await import("./Farms")).default;
});
function runtime() {
  const groups = new Set();
  const queue = new Queue();
  const world = { colliders: queue };
  const scene: any = { sys: { updateList: { remove: (object: any) => groups.delete(object) } },
    add: { existing: (object: any) => groups.add(object) },
    physics: { add: { collider: vi.fn(() => {
      const collider: any = { world, active: true, destroy: vi.fn(() => { queue.remove(collider); collider.active = false; collider.world = null; }) };
      queue.add(collider);
      return collider;
    }) } }, time: { removeEvent: vi.fn() } };
  Object.assign(core, { recordUserDeathForDiagnostics: vi.fn(), onPlayerOverlapBlock: vi.fn(), scene, map: { blocksGroup: {} }, teams: [], logicalUnitRegistry: { unregisterUser: vi.fn() } });
  return { groups, queue, scene };
}
describe("live User/Slaves resource lifetime", () => {
  it("measures the previous reset-on-death sequence retaining one group/collider per dead user", () => {
    const { groups, queue } = runtime();
    const stale: any[] = [];
    for (let id = 1; id <= 100; id++) {
      const user = new User(id, `old-${id}`, { users: new Set() }, {}, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      user.slaveGroup.addCollider(); queue.update();
      user.slaveGroup.reset(); queue.update(); // Previous death cleanup; reset creates another collider.
      stale.push(user.slaveGroup);
    }
    expect(groups.size).toBe(100);
    expect(queue.getActive()).toHaveLength(100);
    stale.forEach((group) => group.dispose()); queue.update();
    expect(groups.size).toBe(0);
    expect(queue.getActive()).toHaveLength(0);
  });
  it("100 deaths leave no replacement collider or orphaned update-list group", () => {
    const { groups, queue, scene } = runtime();
    for (let id = 1; id <= 100; id++) {
      const team: any = { users: new Set() };
      const player: any = { destroyPlayerTree: vi.fn() };
      const user = new User(id, `u${id}`, team, player, undefined, 70, "NORMAL", undefined, { deferRuntime: true });
      team.users.add(user);
      user.slaveGroup.addCollider();
      if (id % 2) queue.update(); // Includes destruction before pending insertion.
      expect(user.destroyUser()).toBe(true);
      queue.update();
      expect(groups.size).toBe(0);
      expect(queue.getActive()).toHaveLength(0);
      expect(team.users.size).toBe(0);
      user.slaveGroup.dispose(); // Idempotent terminal cleanup.
    }
    expect(scene.physics.add.collider).toHaveBeenCalledTimes(100);
  });
  it("transfer reset keeps one live group/collider and repeated hydration detaches only once", () => {
    const { groups, queue } = runtime();
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
    user.slaveGroup.dispose(); queue.update();
    expect(groups.size).toBe(0);
    expect(queue.getActive()).toHaveLength(0);
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
