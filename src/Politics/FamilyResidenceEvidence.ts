import type {MilitaryFamily,MilitaryFamilyMember} from './MilitaryFamily';
import type {WorldEvent} from '../History/WorldHistory';
import {familyResidenceAt} from './FamilyNobleSuccession';
/** Residence is canonical; a matching source event is required before naming its cause. */
export function familyResidenceEvidence(f:MilitaryFamily,m:MilitaryFamilyMember,month:number,events:readonly WorldEvent[],eventBoundary=Infinity){
 const originalFactionId=m.birth?.factionId??f.factionId,changes=(m.factionHistory??[]).filter(h=>h.month<=month&&h.eventIndex<=eventBoundary);
 let previous=originalFactionId;
 const transfers=changes.map(h=>{const fromFactionId=previous;previous=h.factionId;
  const event=events.find((e,i)=>i>=h.eventIndex&&i<eventBoundary&&m.sourceUserId!==undefined&&(e.monthIndex??e.year)===h.month&&e.metadata?.sourceUserId===m.sourceUserId&&e.metadata?.bornMonth===m.bornMonth&&e.metadata?.fromFactionId===fromFactionId&&e.metadata?.toFactionId===h.factionId);
  return {...h,fromFactionId,toFactionId:h.factionId,eventId:event?.id,reason:event?.title??'转属原因及原始史事未核验；不据相邻事件推定迁移或叛离'};
 });
 const entryMonth=m.populationEnteredMonth??(!m.birth?m.enteredMonth:undefined),entryIndex=events.findIndex(e=>e.id===(m.birth?`${m.memberId}-population-entered`:`${m.memberId}-entered`));
 const entryFactionId=entryMonth!==undefined&&entryMonth<=month?familyResidenceAt(f,{...m,factionHistory:(m.factionHistory??[]).filter(h=>h.month<entryMonth||h.month===entryMonth&&(entryIndex<0||h.eventIndex<=entryIndex))},entryMonth):undefined;
 return {originalFactionId,entryFactionId,settlementFactionId:familyResidenceAt(f,{...m,factionHistory:changes},month),transfers};
}
