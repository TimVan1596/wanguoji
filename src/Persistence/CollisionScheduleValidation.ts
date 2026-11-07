import type {WorldSaveV1} from './WorldSaveSchema';
/** Reject runtime objects, unknown identities, duplicate callbacks and lost live source groups. */
export function validateCollisionSchedule(save:WorldSaveV1):string[]{
 const errors:string[]=[],schedule=save.collisionSchedule;
 if(!schedule||schedule.version!==1||!Array.isArray(schedule.colliders))return ['invalid saved collision schedule'];
 const sources=new Map<string,string>(),targets=new Set(['map']);
 for(const f of save.factions){sources.set(`players:${f.factionId}`,f.factionId);sources.set(`farms:${f.factionId}`,f.factionId);targets.add(`blocks:${f.factionId}`);}
 for(const u of save.users)sources.set(`slaves:${u.userId}`,u.factionId);
 const seen=new Set<string>(),withMap=new Set<string>();
 for(const row of schedule.colliders){
  if(!row||Object.keys(row).some(k=>!['sourceGroupId','targetGroupIds'].includes(k))||!sources.has(row.sourceGroupId)||!Array.isArray(row.targetGroupIds)||!row.targetGroupIds.length){errors.push('invalid collision source/targets');continue;}
  for(const target of row.targetGroupIds){const pair=JSON.stringify([row.sourceGroupId,target]);
   // A resident's existing slave collider retains its original target list on transfer.
   const self=target===`blocks:${sources.get(row.sourceGroupId)}`&&!row.sourceGroupId.startsWith('slaves:');
   if(!targets.has(target)||self||seen.has(pair))errors.push(`invalid collision target ${row.sourceGroupId} -> ${String(target)}${seen.has(pair)?' (duplicate)':''}`);
   seen.add(pair);if(target==='map')withMap.add(row.sourceGroupId);
  }
 }
 const liveIds=new Set(save.units.filter(unit=>unit.alive).map(unit=>unit.unitId));
 const required=new Set(save.users.filter(u=>liveIds.has(u.playerUnitId)).map(u=>`players:${u.factionId}`));
 for(const u of save.users)if(Array.isArray(u.slaveUnits)&&u.slaveUnits.length)required.add(`slaves:${u.userId}`);
 for(const unit of save.units)if(unit.kind==='farm-npc'&&unit.alive)required.add(`farms:${unit.factionId}`);
 for(const source of required)if(!withMap.has(source))errors.push(`missing live collision source ${source}`);
 return errors;
}
