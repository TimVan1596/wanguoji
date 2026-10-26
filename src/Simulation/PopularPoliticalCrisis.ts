import {REBEL_LOYALTY_THRESHOLD_V095,REBEL_OWNER_STABILITY_THRESHOLD_V095,REBEL_LOYALTY_THRESHOLD,EMPIRE_SPLIT_STRAIN_THRESHOLD} from '../config/simulation';
export interface PopularCrisisFacts {loyalty:number;devastation:number;captureCount:number;lastCapturedMonth?:number;worldMonth:number;stability:number;strain:number;}
/** No fabricated loyalty history: current low loyalty plus dated, mature war damage is the new path. */
export function evaluatePopularPoliticalCrisis(f:PopularCrisisFacts){
 if(f.loyalty<=REBEL_LOYALTY_THRESHOLD_V095&&(f.stability<=REBEL_OWNER_STABILITY_THRESHOLD_V095||f.loyalty<=REBEL_LOYALTY_THRESHOLD&&(f.devastation>=70||f.strain>=EMPIRE_SPLIT_STRAIN_THRESHOLD)))return {eligible:true,reason:'ORIGINAL_CRISIS'};
 if(f.loyalty>40)return {eligible:false,reason:'LOYALTY'};
 const since=f.lastCapturedMonth===undefined?undefined:f.worldMonth-f.lastCapturedMonth;
 if(since===undefined||since<12)return {eligible:false,reason:'NO_MATURE_WAR_GRIEVANCE'};
 if(f.devastation>=70)return {eligible:true,reason:'SEVERE_WAR_DAMAGE'};
 if(f.captureCount>=2&&f.devastation>=50)return {eligible:true,reason:'REPEATED_OCCUPATION'};
 if(since>=24&&f.devastation>=35&&f.stability<=60)return {eligible:true,reason:'UNRESOLVED_POSTWAR_CRISIS'};
 return {eligible:false,reason:'NO_POLITICAL_CRISIS'};
}
