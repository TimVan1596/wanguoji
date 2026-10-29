import type {WorldEvent} from "./WorldHistory";
import {MILITARY_OFFICE_NAMES} from "../Politics/MilitaryOffice";
/** Frozen founding facts only. Never use a person's current faction or later office. */
export function formatFoundingIdentity(event:WorldEvent,newFactionName:string,viewFactionId?:string){
 const m=event.metadata;if(!m)return;
 const name=typeof m.foundingRulerName==="string"?m.foundingRulerName:undefined;
 const city=typeof m.leaderSourceCityName==="string"?m.leaderSourceCityName:undefined;
 const source=typeof m.leaderOriginalFactionName==="string"?m.leaderOriginalFactionName:undefined;
 if(!name||!city||!source||typeof m.leaderPersonId!=="string")return;
 const title=m.foundingIdentityStage==="STATE"?(m.foundingSovereigntyRank==="EMPEROR"?"首任皇帝":"首任国君"):"首任首领";
 if(m.splitSource==="MILITARY"&&typeof m.militarySplitEvidence==="string"){
  try{const e=JSON.parse(m.militarySplitEvidence);const office=MILITARY_OFFICE_NAMES[e.office as keyof typeof MILITARY_OFFICE_NAMES]??"将领";
   if(e.personId===m.leaderPersonId&&e.personalName===name&&Array.isArray(e.participants)&&e.participants.length>=2)
    return viewFactionId!==undefined&&viewFactionId===event.targetFactionId?`原${source}${office}${name}举兵叛离，于${city}率${e.participants.length-1}名旧部另立${newFactionName}。`:`${source}${office}${name}在地方政治危机中率${e.participants.length-1}名旧部于${city}起事，脱离原政权，建立${newFactionName}，成为其${title}。`;
  }catch{/* Missing evidence falls back to the established founding facts. */}
 }
 return `${name}原为${source}居民，于${city}参与起事，随居民转属建立${newFactionName}，成为其${title}；${city}为起事据点。`;
}
