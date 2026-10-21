import {getRecordedKinRelation} from "../Politics/DynasticCandidateRules";
import type {Ruler} from "../Politics/Dynasty";

/** Optional historical evidence, never used to reconstruct or change the live successor. */
export function validDepositionSelection(raw: unknown, rulers: Ruler[], previousId: string, nextId: string, month: number) {
  if(raw===undefined) return true;
  try {
    if(typeof raw!=="string") return false;
    const s=JSON.parse(raw), old=rulers.find(r=>r.id===previousId);
    if(!old||s.version!==1||s.selectedRulerId!==nextId||!Array.isArray(s.candidates)||!s.candidates.length||
      !Number.isFinite(s.conditionalRoll)||s.conditionalRoll<0||s.conditionalRoll>=1||
      !Number.isFinite(s.probability)||s.probability<=0||s.probability>.03||
      !Number.isFinite(s.roll)||s.roll<0||s.roll>=s.probability||Math.abs(s.roll/s.probability-s.conditionalRoll)>1e-12||
      !Array.isArray(s.crisisEventIds)||!s.crisisEventIds.length||new Set(s.crisisEventIds).size!==s.crisisEventIds.length||
      Math.abs(s.maturityFactor-(Math.min(3,s.crisisEventIds.length)*.15+(typeof s.supporterPersonId === "string" && s.supporterPersonId.length > 0 ? .25 : 0)))>1e-12) return false;
    const legitimacy:Record<string,number>={DIRECT_CHILD:1.35,GRANDCHILD:1.2,SIBLING:1.25,NEPHEW:1,UNCLE:1.1,COUSIN:1};
    const ids=new Set<string>();let total=0,previous="";
    for(const c of s.candidates){
      const r=rulers.find(r=>r.id===c.rulerId), age=month-c.bornMonth;
      if(!r||r.id===old.id||ids.has(r.id)||previous&&previous.localeCompare(r.id)>0||r.houseName!==old.houseName||
        c.name!==`${r.houseName.replace(/氏$/,"")}${r.givenName}`||r.bornYear!==c.bornMonth||age<192||getRecordedKinRelation(r,old,rulers)!==c.relation||!legitimacy[c.relation]||
        r.deathMonth!==undefined&&r.deathMonth<month||r.accessionYear!==undefined&&r.accessionYear<month||
        !Number.isFinite(c.weight)||Math.abs(c.weight-(legitimacy[c.relation]+Math.max(0,Math.min(1,(age-192)/168))*s.maturityFactor))>1e-12)return false;
      ids.add(r.id);previous=r.id;total+=c.weight;
    }
    let cursor=s.conditionalRoll*total;
    return (s.candidates.find((c:any)=>(cursor-=c.weight)<0)??s.candidates.at(-1)).rulerId===nextId;
  }catch{return false;}
}
