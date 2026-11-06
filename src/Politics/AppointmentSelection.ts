import {personAbilities,type PersonAbilities} from './PersonAbilities';
export type AppointmentAbilityPolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const APPOINTMENT_ABILITY_EFFECTS={BASELINE:0,LOW:.08,MEDIUM:.16,HIGH:.32} as const;
export const isAppointmentAbilityPolicy=(p:unknown):p is AppointmentAbilityPolicy=>typeof p==='string'&&Object.prototype.hasOwnProperty.call(APPOINTMENT_ABILITY_EFFECTS,p);
/** Bounded additive influence; social standing and ability never multiply each other. */
export function appointmentAbilityWeight(base:number,abilities:PersonAbilities,policy:AppointmentAbilityPolicy){return Math.max(.5,base+APPOINTMENT_ABILITY_EFFECTS[policy]*((abilities.command-50)/50*.8+(abilities.strategy-50)/50*.2));}
export interface AppointmentSelectionRow {firstAppointment:boolean;sourceUserId?:number;bornMonth:number;rulerId?:string;familyId?:string;memberId?:string;titleEventId?:string;baseWeight:number;abilities:PersonAbilities;weight:number;}
export interface AppointmentSelection {version:1;policy:AppointmentAbilityPolicy;month:number;factionId:string;epochFounderId?:string;rulerId:string;opportunityRoll:number;selectionRoll:number;ordinaryChance:number;titleChance:number;priority:boolean;selectedIndex:number;rows:AppointmentSelectionRow[];}
export function verifyAppointmentSelection(a:AppointmentSelection){
 if(a?.version!==1||!isAppointmentAbilityPolicy(a.policy)||!Number.isSafeInteger(a.month)||a.month%12!==0||!a.factionId||!a.rulerId||!Array.isArray(a.rows)||!a.rows.length||a.rows.length>10000||!Number.isSafeInteger(a.selectedIndex)||a.selectedIndex<0||a.selectedIndex>=a.rows.length||a.ordinaryChance!==.05||![0,.095].includes(a.titleChance)||a.priority!==(a.opportunityRoll>=.05)||![a.opportunityRoll,a.selectionRoll].every(r=>Number.isFinite(r)&&r>=0&&r<1)||a.opportunityRoll>=a.ordinaryChance+a.titleChance)return false;
 const keys=new Set<string>();let total=0;
 for(const r of a.rows){const source=r.abilities?.source;if(!source||!['RESIDENT','ROYAL'].includes(source.kind)||typeof r.firstAppointment!=='boolean'||!Number.isSafeInteger(r.bornMonth)||r.bornMonth!==source.bornMonth||source.kind==='RESIDENT'&&(source.sourceUserId!==r.sourceUserId||!Number.isSafeInteger(r.sourceUserId))||source.kind==='ROYAL'&&(!r.rulerId||source.rulerId!==r.rulerId)||a.priority&&!r.titleEventId||!Number.isFinite(r.baseWeight)||r.baseWeight<1||r.baseWeight>4||JSON.stringify(personAbilities(source))!==JSON.stringify(r.abilities)||r.weight!==appointmentAbilityWeight(r.baseWeight,r.abilities,a.policy))return false;const key=r.rulerId?`royal:${r.rulerId}`:`resident:${r.sourceUserId}:${r.bornMonth}`;if(keys.has(key))return false;keys.add(key);total+=r.weight;}
 let cursor=a.selectionRoll*total,selected=a.rows.length-1;for(let i=0;i<a.rows.length;i++){cursor-=a.rows[i].weight;if(cursor<0){selected=i;break;}}
 return selected===a.selectedIndex;
}
