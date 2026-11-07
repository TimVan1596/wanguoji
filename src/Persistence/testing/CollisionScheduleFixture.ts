import type {WorldSaveV1} from '../WorldSaveSchema';
/** Synthetic map-only colliders for non-Phaser persistence fixtures. */
export function fixtureCollisionSchedule(users:WorldSaveV1['users'],units:WorldSaveV1['units']){
 const sources=new Set(users.filter(u=>units.some(p=>p.unitId===u.playerUnitId&&p.alive)).map(u=>`players:${u.factionId}`));
 for(const u of users)if(Array.isArray(u.slaveUnits)&&u.slaveUnits.length)sources.add(`slaves:${u.userId}`);
 for(const unit of units)if(unit.kind==='farm-npc'&&unit.alive)sources.add(`farms:${unit.factionId}`);
 return {version:1 as const,colliders:[...sources].map(sourceGroupId=>({sourceGroupId,targetGroupIds:['map']}))};
}
