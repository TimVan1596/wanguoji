import type {Ruler} from './Dynasty';
import type {MilitaryFormation} from './MilitaryCommandRegistry';
export interface InsurgentDuty {
 rulerId:string;personId:string;sourceUserId:number;bornMonth:number;foundingEventId:string;
 sourceFactionId:string;sourceCommandId?:string;capacity:number;
 initialMembers:Array<{unitId:string;userId:number;bornMonth:number;x:number;y:number;positionSource:'PHASER'|'LOGICAL'}>;
 endMonth?:number;endReason?:'BODY_REMOVED'|'AUTHORITY_ENDED'|'NO_FOLLOWERS'|'TRANSFERRED'|'AGE_RETIREMENT';
}
/** Permanent resident identity; never invent a MilitaryPerson for a political leader. */
export function insurgentLeaderIdentity(r:Ruler|undefined){return r?.residentIdentity&&r.accessionYear!==undefined?{personId:r.residentIdentity.personId,sourceUserId:r.residentIdentity.sourceUserId,bornMonth:r.bornYear}:undefined;}
export function insurgentDutyName(f:MilitaryFormation){return f.leaderDuty?'义军统帅':undefined;}
