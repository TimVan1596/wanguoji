// Frozen z55 pure planner for equivalence assertions, never called by the game.
import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import {familyGenerationsSinceMerit} from './MilitaryFamily';
import {hanGivenNamePool} from './NameCulture';
const familyMemberId=(id:number,born:number)=>`family-member-${id}-${born}`;
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
/** Called only before first population entry. Birth is derived from the original population label, never re-aged. */
export function legacyFamilyPopulationEntry(families:readonly MilitaryFamily[],factionId:string,epoch:string|undefined,userId:number,bornMonth:number,month:number,seed:string){
 const options=families.filter(f=>f.factionId===factionId&&f.epochFounderId===epoch&&f.foundedMonth<=month).flatMap(f=>f.members.filter(p=>
  p.bornMonth+18*12<=bornMonth&&bornMonth<=p.bornMonth+55*12&&(p.deathMonth??Infinity)>bornMonth&&(p.exitMonth??Infinity)>bornMonth&&p.enteredMonth<month&&familyGenerationsSinceMerit(f,p,month)<4&&
  f.members.filter(c=>c.parentMemberId===p.memberId).length<2&&
  !f.members.some(c=>c.parentMemberId===p.memberId&&Math.abs(c.bornMonth-bornMonth)<48)
 ).map(parent=>({family:f,parent}))).sort((a,b)=>a.family.familyId.localeCompare(b.family.familyId)||a.parent.memberId.localeCompare(b.parent.memberId));
 if(!options.length||hash(`${seed}/${userId}/${bornMonth}/family-entry`)%100>=25)return;
 const {family,parent}=options[hash(`${seed}/${userId}/family-parent`)%options.length];
 const pool=hanGivenNamePool,name=family.surname+pool.doubleNamePrefixes[hash(`${userId}/given-a`)%pool.doubleNamePrefixes.length]+pool.doubleNameSuffixes[hash(`${userId}/given-b`)%pool.doubleNameSuffixes.length];
 const member:MilitaryFamilyMember={memberId:familyMemberId(userId,bornMonth),sourceUserId:userId,name,bornMonth,generation:parent.generation+1,parentMemberId:parent.memberId,enteredMonth:month,source:'NATURAL_GROWTH'};
 return {familyId:family.familyId,member};
}
