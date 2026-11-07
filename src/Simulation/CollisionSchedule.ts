/** Order is gameplay state: later factions append separate collider target groups. */
export interface CollisionSchedule {
  version: 1;
  colliders: Array<{sourceGroupId: string; targetGroupIds: string[]}>;
}
export interface ColliderQueue {
  _active: any[]; _pending: any[]; _destroy: any[];
}
export function exportCollisionSchedule(queue: ColliderQueue, groups: ReadonlyMap<unknown,string>): CollisionSchedule {
  const removed=new Set(queue._destroy);
  return {version:1,colliders:[...queue._active,...queue._pending].filter(c=>c.world&&c.active&&!removed.has(c)).map(c=>{
    const sourceGroupId=groups.get(c.object1),targetGroupIds=(Array.isArray(c.object2)?c.object2:[c.object2]).map((g:unknown)=>groups.get(g));
    if(!sourceGroupId||targetGroupIds.some((id:unknown)=>!id))throw Error('Unregistered gameplay collision group');
    return {sourceGroupId,targetGroupIds:targetGroupIds as string[]};
  })};
}
