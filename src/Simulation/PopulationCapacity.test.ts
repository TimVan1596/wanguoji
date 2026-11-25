import {expect,it} from 'vitest';
import type Team from '../Components/Team';
import type {Ruler} from '../Politics/Dynasty';
import {getPopulationCapacityBreakdown,populationRulerRecovery} from './PopulationRecoveryRules';

it('scales effective urban capacity with damage and actual political control',()=>{
 const city={ownerFactionId:'a',devastation:0,destroyed:false,underSiege:false};
 const team={name:'a',status:'ACTIVE',blocks:{children:{size:100}},cities:[city]} as unknown as Team;
 expect(getPopulationCapacityBreakdown(team)).toMatchObject({base:8,land:10,urban:2,capacity:20});
 city.underSiege=true;
 expect(getPopulationCapacityBreakdown(team).capacity).toBe(20);
 city.devastation=50;
 expect(getPopulationCapacityBreakdown(team).capacity).toBe(19);
 city.ownerFactionId='b';
 expect(getPopulationCapacityBreakdown(team).capacity).toBe(18);
 city.ownerFactionId='a';city.destroyed=true;
 expect(getPopulationCapacityBreakdown(team).capacity).toBe(18);
 expect(getPopulationCapacityBreakdown({...team,blocks:{children:{size:0}}} as Team).capacity).toBe(0);
});

it('applies the bounded recovery modifier only to a living reigning sovereign',()=>{
 const ruler={status:'ruling',accessionYear:4,reignOrdinal:1} as Ruler;
 expect(populationRulerRecovery(ruler,5,()=>100)).toBe(1.05);
 expect(populationRulerRecovery(ruler,5,()=>0)).toBe(.95);
 expect(populationRulerRecovery({...ruler,status:'exiled'},5,()=>100)).toBe(1);
 expect(populationRulerRecovery({...ruler,deathMonth:5},5,()=>100)).toBe(1);
});
