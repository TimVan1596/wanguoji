import {evaluatePopularPoliticalCrisis,type PopularCrisisFacts} from './PopularPoliticalCrisis';
/** Local armed service is distinct from the stronger court-intervention threshold. No promotion or RNG. */
export function localMilitaryCareer(serviceMonths:number,unitCount:number,activities:number,captures:number,defenses:number){
 return serviceMonths>=24&&unitCount>=2&&unitCount<=4&&(activities>0||captures>0||defenses>0);
}
export interface MilitaryLocalCrisisFacts extends PopularCrisisFacts {underSiege?:boolean;battleId?:string;lastSiegeDamageMonth?:number;}
export function militaryLocalCrisis(f:MilitaryLocalCrisisFacts){
 const popular=evaluatePopularPoliticalCrisis(f);if(popular.eligible)return popular;
 if(f.underSiege&&f.battleId&&f.devastation>=35&&f.loyalty<=80&&f.lastSiegeDamageMonth!==undefined&&f.lastSiegeDamageMonth>=0&&f.worldMonth-f.lastSiegeDamageMonth>=0&&f.worldMonth-f.lastSiegeDamageMonth<=6)return {eligible:true,reason:'MILITARY_SIEGE_CRISIS'};
 const since=f.lastCapturedMonth===undefined?-1:f.worldMonth-f.lastCapturedMonth;
 return f.loyalty<=60&&f.devastation>=35&&since>=6&&(f.captureCount>=2||f.stability<=65)
  ?{eligible:true,reason:'MILITARY_POSTWAR_CRISIS'}:{eligible:false,reason:popular.reason};
}
/** A soldier left in the original command is not an independent civilian supporter. */
export function localMilitarySupporter<T extends {player:{logicalUnitId?:string}}>(residents:readonly T[],party:readonly T[],originalUnitIds:readonly string[]){
 const units=new Set(originalUnitIds),selected=new Set(party),resident=residents.find(u=>!selected.has(u)&&!units.has(u.player.logicalUnitId??'')),supporter=resident??party[1];
 return supporter?{supporter,supporterKind:resident?'RESIDENT' as const:'COMMAND_FOLLOWER' as const}:undefined;
}
