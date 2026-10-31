import {combinedRoyalCandidateWeight,ROYAL_HONOR_ADVANTAGE} from '../Politics/RoyalHonors';
import {getRecordedKinRelation} from "../Politics/DynasticCandidateRules";
import type {Ruler} from "../Politics/Dynasty";

/** Optional historical evidence, never used to reconstruct or change the live successor. */
export function validDepositionSelection(raw: unknown, rulers: Ruler[], previousId: string, nextId: string, month: number) {
  if(raw===undefined) return true;
  try {
    if(typeof raw!=="string") return false;
    const s=JSON.parse(raw), old=rulers.find(r=>r.id===previousId);
    if(!old||![1,2,3,4].includes(s.version)||s.selectedRulerId!==nextId||!Array.isArray(s.candidates)||!s.candidates.length||
      !Number.isFinite(s.conditionalRoll)||s.conditionalRoll<0||s.conditionalRoll>=1||!Number.isFinite(s.maturityFactor)||
      !Number.isFinite(s.probability)||s.probability<=0||s.probability>.03||
      !Number.isFinite(s.roll)||s.roll<0||s.roll>=s.probability||Math.abs(s.roll/s.probability-s.conditionalRoll)>1e-12||
      !Array.isArray(s.crisisEventIds)||!s.crisisEventIds.length||s.crisisEventIds.some((id:unknown)=>typeof id!=="string"||!id.length)||new Set(s.crisisEventIds).size!==s.crisisEventIds.length||
      Math.abs(s.maturityFactor-(Math.min(3,s.crisisEventIds.length)*.15+(typeof s.supporterPersonId === "string" && s.supporterPersonId.length > 0 ? .25 : 0)))>1e-12) return false;
    if((s.version===3||s.version===4&&s.support)&&(!s.support||s.support.personId!==s.supporterPersonId||!s.candidates.some((c:any)=>c.rulerId===s.support.rulerId)||s.candidates.some((c:any)=>c.supportBonus!==(c.rulerId===s.support.rulerId?s.support.bonus:0))))return false;
    if(s.version<3&&s.support!==undefined)return false;
    const legitimacy:Record<string,number>={DIRECT_CHILD:1.35,GRANDCHILD:1.2,SIBLING:1.25,NEPHEW:1,UNCLE:1.1,COUSIN:1};
    const ids=new Set<string>();let total=0,previous="";
    for(const c of s.candidates){
      const r=rulers.find(r=>r.id===c.rulerId), age=month-c.bornMonth;
      if(!r||r.id===old.id||ids.has(r.id)||previous&&previous.localeCompare(r.id)>0||r.houseName!==old.houseName||
        c.name!==`${r.houseName.replace(/氏$/,"")}${r.givenName}`||r.bornYear!==c.bornMonth||age<192||getRecordedKinRelation(r,old,rulers)!==c.relation||!legitimacy[c.relation]||
        r.deathMonth!==undefined&&r.deathMonth<month||r.accessionYear!==undefined&&r.accessionYear<month||
        (r.naturalDeathYear??r.plannedEndYear)!<=month||
        !Number.isFinite(c.weight)||Math.abs(c.weight-(s.version===4?combinedRoyalCandidateWeight(c.baseWeight,c.militaryAdvantage,c.honorAdvantage,s.support?c.supportBonus:0):(legitimacy[c.relation]+Math.max(0,Math.min(1,(age-192)/168))*s.maturityFactor)*(s.version>=2?1+c.militaryAdvantage:1)*(s.version===3?1+c.supportBonus:1)))>1e-12||
        s.version>=2&&(!Number.isFinite(c.baseWeight)||Math.abs(c.baseWeight-(legitimacy[c.relation]+Math.max(0,Math.min(1,(age-192)/168))*s.maturityFactor))>1e-12||!Number.isFinite(c.militaryAdvantage)||c.militaryAdvantage<0||c.militaryAdvantage>.250000000001||(c.militaryAdvantage>0)!==!!c.ownMilitary||c.ownMilitary&&c.ownMilitary.advantage!==c.militaryAdvantage))return false;
      if(s.version===4&&(!Number.isFinite(c.honorAdvantage)||c.honorAdvantage!==(c.royalHonor?ROYAL_HONOR_ADVANTAGE[c.royalHonor.rank as keyof typeof ROYAL_HONOR_ADVANTAGE]:0)||c.weight>c.baseWeight*1.500000000001)||s.version<4&&(c.royalHonor!==undefined||c.honorAdvantage!==undefined))return false;
      ids.add(r.id);previous=r.id;total+=c.weight;
    }
    let cursor=s.conditionalRoll*total;
    return (s.candidates.find((c:any)=>(cursor-=c.weight)<0)??s.candidates.at(-1)).rulerId===nextId;
  }catch{return false;}
}
