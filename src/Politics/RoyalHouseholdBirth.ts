import type {Dynasty,Ruler} from './Dynasty';
import {WorldRandom} from '../Simulation/WorldRandom';
import {createNaturalDeathMonth} from './RulerLifespanRules';
import {deriveNameCulture,hanGivenNamePool,cultureGivenNamePools} from './NameCulture';
import {pickRulerGivenName} from './SuccessionRules';
export type RoyalBirthPolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const ROYAL_BIRTH_CHANCE={BASELINE:0,LOW:.035,MEDIUM:.07,HIGH:.12} as const;
export const isRoyalBirthPolicy=(v:unknown):v is RoyalBirthPolicy=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(ROYAL_BIRTH_CHANCE,v);
export interface RoyalHouseholdBirth {version:2;opportunityMonth:number;eventId:string;parentId:string;month:number;epochFounderId:string;policy:RoyalBirthPolicy;ticket:number;ordinal:number;}
export const HOUSEHOLD_CHILD_CAP=2,HOUSEHOLD_LIVING_CAP=32,HOUSEHOLD_ANNUAL_CAP=2;
/** A separate, keyed deterministic stream. It never advances world combat/politics RNG. */
export function householdBirthPlan(parent:Ruler,month:number,seed:string,policy:RoyalBirthPolicy,epochFounderId:string,ordinal=0){
 const opportunityMonth=Math.floor(month/12)*12;
 if(opportunityMonth<12)return;
 const key=`royal-household-v1:${seed}:${parent.id}:${parent.bornYear}:${opportunityMonth}`;
 // One opportunity ticket and one independent delivery month per father/year.
 // Nothing is registered or reserved before the real delivery transaction.
 const delivery=new WorldRandom();delivery.initialize(`${key}:delivery-month`);
 if(month!==opportunityMonth+delivery.pickIndex(12))return;
 const rng=new WorldRandom();rng.initialize(key);
 const ticket=rng.next();if(ticket>=ROYAL_BIRTH_CHANCE[policy])return;
 const culture=deriveNameCulture(parent.houseName),pool=culture==='HAN'?hanGivenNamePool:{...cultureGivenNamePools[culture],singleNames:[],doubleNamePrefixes:[],doubleNameSuffixes:[],doubleNameChancePercent:0};
 const id=`${parent.registration?.factionId??parent.id}-household-${month}-${ordinal}`,givenName=pickRulerGivenName(pool,[],max=>rng.pickIndex(max)),naturalDeathYear=createNaturalDeathMonth(month,max=>rng.pickIndex(max));
 const householdBirth:RoyalHouseholdBirth={version:2,opportunityMonth,eventId:`${id}-born`,parentId:parent.id,month,epochFounderId,policy,ticket,ordinal};
 return {id,houseName:parent.houseName,givenName,bornYear:month,naturalDeathYear,plannedEndYear:naturalDeathYear,politicalStartYear:month,parentId:parent.id,relationType:'DIRECT_CHILD',status:'kin',successionScope:'HOUSEHOLD',householdBirth} satisfies Ruler;
}
/** Linear parent/child indexing; no future person is materialized from an annual opportunity. */
export function householdBirthParents(d:Dynasty,month:number){
 const children=new Map<string,{count:number;latest:number}>();let living=0;
 for(const r of d.rulers){if((r.deathMonth??Infinity)>month&&(r.naturalDeathYear??Infinity)>month)living++;if(r.parentId&&r.bornYear<=month&&(r.registration?.month??r.politicalStartYear??Infinity)<=month){const c=children.get(r.parentId)??{count:0,latest:-Infinity};c.count++;c.latest=Math.max(c.latest,r.registration?.month??r.politicalStartYear??r.bornYear);children.set(r.parentId,c);}}
 if(living>=HOUSEHOLD_LIVING_CAP)return [];
 const held=new Set<string>();const last=new Map((d.royalNobility??[]).map(a=>[a.chainId,a]));for(const a of last.values())if(a.kind!=='ENDED'&&a.holderRulerId)held.add(a.holderRulerId);
 return d.rulers.filter(r=>r.id!==d.currentRulerId&&r.reignOrdinal===undefined&&r.houseName===d.houseName&&r.registration&&r.registration.month<month&&r.bornYear+20*12<=month&&r.bornYear+50*12>=month&&(r.status==='kin'||r.status==='heir')&&(r.deathMonth??Infinity)>month&&(r.naturalDeathYear??Infinity)>month&&(children.get(r.id)?.count??0)<HOUSEHOLD_CHILD_CAP&&month-(children.get(r.id)?.latest??-Infinity)>=48).sort((a,b)=>Number(held.has(b.id))-Number(held.has(a.id))||Number(!!b.militaryIdentity)-Number(!!a.militaryIdentity)||a.id.localeCompare(b.id));
}

let observer:((d:Dynasty,month:number,parents:readonly Ruler[],elapsedMs:number)=>void)|undefined;
export function observeRoyalBirthPlanning(value:typeof observer){observer=value;}
export function recordRoyalBirthPlanning(d:Dynasty,month:number,parents:readonly Ruler[],elapsedMs:number){observer?.(d,month,parents,elapsedMs);}
