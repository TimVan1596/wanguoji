/** Phaser 3.55.2 observational adapter. No queue draining, stepping or state mutation. */
export function readRuntimeLifetimeDiagnostics(scene: any, teams: any[], core: {
  fixedSteps: number; interactionCells: number; colliders: unknown; visibilityListener: boolean;
}) {
  const display = scene.children?.list ?? [];
  const types: Record<string, number> = {};
  const seen = new Set<any>();
  const frames = [{ items: display, index: 0 }];
  while (frames.length) {
    const frame = frames[frames.length - 1];
    if (frame.index >= frame.items.length) { frames.pop(); continue; }
    const object = frame.items[frame.index++];
    if (!object || seen.has(object)) continue;
    seen.add(object);
    const type = object.type ?? object.constructor?.name ?? "unknown";
    types[type] = (types[type] ?? 0) + 1;
    if (Array.isArray(object.list)) frames.push({ items: object.list, index: 0 });
  }
  const world = scene.physics?.world;
  const bodies: any[] = world?.bodies?.entries ?? [];
  const staticBodies: any[] = world?.staticBodies?.entries ?? [];
  const activeBodies = bodies.filter((body) => body.enable && body.gameObject?.active !== false).length;
  const updateList = scene.sys?.updateList;
  const runtimeObjects: any[] = [...(updateList?.getActive?.() ?? []), ...(updateList?._pending ?? [])];
  const groups = new Set(runtimeObjects.filter((object) => object?.children?.entries && object?.getChildren));
  const cities = teams.flatMap((team) => team.cities);
  const users = teams.flatMap((team) => [...team.users]);
  const listeners = (emitter: any): number | undefined => emitter?.eventNames && emitter?.listenerCount
    ? emitter.eventNames().reduce((sum: number, name: string | symbol) => sum + emitter.listenerCount(name), 0) : undefined;
  const queue = world?.colliders;
  const memory = (globalThis.performance as any)?.memory;
  return {
    sessionFixedSteps: core.fixedSteps,
    sceneChildren: display.length, sceneObjectsIncludingContainerChildren: seen.size, sceneTypes: types,
    graphics: types.Graphics ?? 0, spriteImage: (types.Sprite ?? 0) + (types.Image ?? 0), text: types.Text ?? 0,
    dynamicBodies: bodies.length, staticBodies: staticBodies.length,
    activeBodies, inactiveBodies: bodies.length - activeBodies,
    arcadeColliders: queue?.getActive?.().length, pendingColliders: queue?._pending?.length,
    deferredColliderRemovals: queue?._destroy?.length,
    coreColliderReferences: core.colliders,
    // Private arrays are pinned-version observations; absence means unavailable.
    timerEvents: { active: scene.time?._active?.length, pending: scene.time?._pendingInsertion?.length, removing: scene.time?._pendingRemoval?.length },
    listenerScope: "scene/input/loader event emitters and Core visibility listener; excludes DOM internals",
    listeners: { scene: listeners(scene.events), input: listeners(scene.input), loader: listeners(scene.load), coreVisibility: Number(core.visibilityListener) },
    activeCities: cities.filter((city) => !city.destroyed).length,
    destroyedCitiesStillReferenced: cities.filter((city) => city.destroyed).length,
    cityInteractionIndexSize: core.interactionCells,
    fortifiedCells: cities.reduce((sum, city) => sum + (city.destroyed ? 0 : city.fortifiedCells.length), 0),
    zoneOutlines: cities.filter((city) => city.zoneOutline?.scene).length,
    activeTeams: teams.filter((team) => team.status === "ACTIVE").length, historicalTeams: teams.length,
    runtimeGroupsInUpdateList: groups.size,
    orphanedUserGroups: [...groups].filter((group: any) => group.user && !group.user.team.users.has(group.user)).length,
    liveUserColliderTargetReferences: users.reduce((sum, user) => sum + (Array.isArray(user.slaveGroup?.collider?.object2) ? user.slaveGroup.collider.object2.length : 0), 0),
    knownTeamGroupShells: teams.length * 3,
    liveUserGroups: users.length, liveUserColliderReferences: users.filter((user) => user.slaveGroup?.collider).length,
    teamPlayerReferences: teams.reduce((sum, team) => sum + team.players.getChildren().length, 0),
    farmNpcReferences: teams.reduce((sum, team) => sum + team.farms.npcs.size, 0),
    farmTimerReferences: teams.reduce((sum, team) => sum + team.farms.farms.size, 0),
    heap: memory ? { usedBytes: memory.usedJSHeapSize, totalBytes: memory.totalJSHeapSize } : undefined,
  };
}
