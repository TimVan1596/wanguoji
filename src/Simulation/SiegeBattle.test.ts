import {expect,it} from 'vitest';
import {siegeWallPressure} from './SiegeBattle';
import {validateSiegeBattles} from '../Persistence/SiegeBattleValidation';
it('requires real attackers, gives finite empty-city progress and measurable local resistance',()=>{
 expect(siegeWallPressure(0,0)).toBe(0);expect(siegeWallPressure(1,0)).toBe(.5);expect(siegeWallPressure(2,0)).toBeGreaterThan(0);
 expect(siegeWallPressure(2,2)).toBeLessThan(siegeWallPressure(2,0));expect(siegeWallPressure(4,1)).toBeGreaterThan(siegeWallPressure(2,1));expect(siegeWallPressure(100,0)).toBeLessThanOrEqual(1.5);
});
it('rejects malformed battle facts and cooldowns without coercing old state or mutating it',()=>{
 const s:any={world:{worldMonth:10},factions:[{factionId:'a'},{factionId:'d'}],cities:[{cityId:'c',ownerFactionId:'d',underSiege:true,attackingFactionId:'a',siegeRetryAfter:{a:20},siegeBattle:{id:'b',attackerId:'a',defenderId:'d',startMonth:1,lastMonth:10,attackers:2,defenders:1}}]};
 expect(validateSiegeBattles(s)).toEqual([]);const before=JSON.stringify(s);s.cities[0].siegeBattle.lastMonth=20;expect(validateSiegeBattles(s).length).toBeGreaterThan(0);s.cities[0].siegeBattle.lastMonth=10;expect(JSON.stringify(s)).toBe(before);s.cities[0].siegeRetryAfter=null;expect(()=>validateSiegeBattles(s)).not.toThrow();expect(validateSiegeBattles(s).length).toBeGreaterThan(0);
});
