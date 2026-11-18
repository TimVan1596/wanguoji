import {expect,it} from 'vitest';
import {chooseCourtTarget} from './CourtCoupOutcome';
import random from '../Simulation/WorldRandom';
const fixture=()=>{const r=(id:string)=>({id,houseName:'嬴氏',givenName:'玄',bornYear:-300});return {e:{candidates:[{ruler:r('own-royal'),relation:'DIRECT_CHILD'},{ruler:r('other-royal'),relation:'SIBLING'}]} as any,c:{personId:'real-person',personalName:'嬴玄',disposition:{ambition:40,loyalty:50,prestige:2}} as any,p:{personId:'real-person',royalIdentity:{rulerId:'own-royal'}} as any};};
it('does not elect a loyal royal participant as his own supported claimant, even with an identical name',()=>{const {e,c,p}=fixture(),before=random.exportState();expect(chooseCourtTarget(e,c,p)).toMatchObject({rulerId:'other-royal',basis:'KINSHIP'});expect(random.exportState()).toEqual(before);});
it('retains a verified ambitious royal self claim and rejects a mismatched permanent actor',()=>{const {e,c,p}=fixture();c.disposition.ambition=80;expect(chooseCourtTarget(e,c,p)).toMatchObject({rulerId:'own-royal',basis:'SELF'});expect(chooseCourtTarget(e,{...c,personId:'different'},p)).toBeUndefined();});
it('does not invent a supported target if only the restrained actor himself is eligible',()=>{const {e,c,p}=fixture();e.candidates.pop();expect(chooseCourtTarget(e,c,p)).toBeUndefined();});
