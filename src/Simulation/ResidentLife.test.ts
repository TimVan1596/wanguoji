import {expect,it} from 'vitest';
import {residentNaturalDeathMonth as plan,ordinaryLifeEligible,worldRecoveryMultiplier} from './ResidentLife';
import {localMilitaryCareer,militaryLocalCrisis} from './MilitaryLocalRules';
import rng from './WorldRandom';
it('plans stable 75–95 year lives from saved identity, without random draws or initial adult death cliffs',()=>{
 const before=rng.exportState();
 for(let id=1;id<=600;id++){const born=-(18*12+id%(43*12));const at=plan(id,born);expect(at-born).toBeGreaterThanOrEqual(75*12);expect(at-born).toBeLessThanOrEqual(95*12);expect(at).toBeGreaterThanOrEqual(14*12);expect(plan(id,born)).toBe(at);}
 expect(rng.exportState()).toEqual(before);
});
it('reserves existing military, royal and founder lifecycle authorities, including retired soldiers',()=>{
 const u={role:'NORMAL',player:{role:'NORMAL'}};expect(ordinaryLifeEligible(u)).toBe(true);
 for(const extra of [{militaryPersonId:'p'},{historicalPersonId:'p'},{rulerId:'r'},{role:'RULER'},{isDestroyed:true},{player:{role:'RULER'}}])expect(ordinaryLifeEligible({...u,...extra})).toBe(false);
});
it('softens natural increments around 120–150 without deleting bodies or blocking external/God causes',()=>{
 expect(worldRecoveryMultiplier(120)).toBe(1);expect(worldRecoveryMultiplier(150)).toBeGreaterThan(0);expect(worldRecoveryMultiplier(150)).toBeLessThan(.2);expect(worldRecoveryMultiplier(200)).toBeLessThan(.001);
});
it('local military eligibility requires real service, bodies and sourced military activity, separate from palace rank',()=>{
 expect(localMilitaryCareer(24,2,1,0,0)).toBe(true);
 for(const x of [[23,2,1,0,0],[120,1,3,3,3],[120,4,0,0,0]])expect(localMilitaryCareer(...x as [number,number,number,number,number])).toBe(false);
});
it('distinguishes mature armed postwar and actual damaged siege crises from peaceful nominal estates',()=>{
 const f={worldMonth:60,loyalty:60,devastation:40,captureCount:2,lastCapturedMonth:54,stability:80,strain:0};
 expect(militaryLocalCrisis(f)).toEqual({eligible:true,reason:'MILITARY_POSTWAR_CRISIS'});
 expect(militaryLocalCrisis({...f,lastCapturedMonth:59}).eligible).toBe(false);
 const siege={...f,loyalty:75,captureCount:0,lastCapturedMonth:undefined,underSiege:true,battleId:'real',lastSiegeDamageMonth:59};
 expect(militaryLocalCrisis(siege).reason).toBe('MILITARY_SIEGE_CRISIS');
 expect(militaryLocalCrisis({...siege,battleId:undefined}).eligible).toBe(false);expect(militaryLocalCrisis({...siege,lastSiegeDamageMonth:40}).eligible).toBe(false);
});
