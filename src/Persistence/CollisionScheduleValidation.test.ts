import {expect,it} from 'vitest';
import {exportCollisionSchedule} from '../Simulation/CollisionSchedule';
import {validateCollisionSchedule} from './CollisionScheduleValidation';
import {createEmptyWorldSaveV1} from './WorldSaveSchema';
import {validateWorldSave} from './WorldSaveValidator';
it('freezes actual active/pending callback order, splitting later targets, and excludes pending removals',()=>{
 const player={},map={},a={},b={},groups=new Map([[player,'players:a'],[map,'map'],[a,'blocks:a'],[b,'blocks:b']]),old={world:{},active:true,object1:player,object2:[map,b]},later={world:{},active:true,object1:player,object2:[a]},removed={world:{},active:true,object1:player,object2:[b]};
 const schedule=exportCollisionSchedule({_active:[old,removed],_pending:[later],_destroy:[removed]},groups);
 expect(schedule.colliders).toEqual([{sourceGroupId:'players:a',targetGroupIds:['map','blocks:b']},{sourceGroupId:'players:a',targetGroupIds:['blocks:a']}]);old.object2.reverse();expect(schedule.colliders[0].targetGroupIds).toEqual(['map','blocks:b']);
 expect(()=>exportCollisionSchedule({_active:[old],_pending:[],_destroy:[]},new Map())).toThrow('Unregistered');
});
it('rejects unknown source/target, duplicated callbacks, self collision, missing live source and old slots',()=>{
 const save=createEmptyWorldSaveV1();save.factions=[{factionId:'a'},{factionId:'b'}] as any;save.users=[{userId:7,factionId:'a',playerUnitId:'u',slaveUnits:[]}] as any;save.units=[{unitId:'u',alive:true}] as any;
 const row={sourceGroupId:'players:a',targetGroupIds:['map','blocks:b']};save.collisionSchedule={version:1,colliders:[row]};expect(validateCollisionSchedule(save)).toEqual([]);
 for(const colliders of [[],[{...row,sourceGroupId:'players:unknown'}],[{...row,targetGroupIds:['map','blocks:unknown']}],[row,row],[{...row,targetGroupIds:['map','blocks:a']}]]){const bad=structuredClone(save);bad.collisionSchedule.colliders=colliders;expect(validateCollisionSchedule(bad).length).toBeGreaterThan(0);}
 const absent=structuredClone(save);delete (absent as any).collisionSchedule;expect(validateCollisionSchedule(absent)).toEqual(['invalid saved collision schedule']);
 const old=createEmptyWorldSaveV1();(old as any).saveSchemaVersion=52;expect(validateWorldSave(old).errors).toContain('该存档版本已不受支持，请创建新世界。');
});

it('keeps a transferred resident slave collider’s original targets even when its former enemy is now its own country',()=>{const s=createEmptyWorldSaveV1();s.factions=[{factionId:'new'}] as any;s.users=[{userId:7,factionId:'new',slaveUnits:[]}] as any;s.collisionSchedule={version:1,colliders:[{sourceGroupId:'slaves:7',targetGroupIds:['map','blocks:new']}]};expect(validateCollisionSchedule(s)).toEqual([]);});
