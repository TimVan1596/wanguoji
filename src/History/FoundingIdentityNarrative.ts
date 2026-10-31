import {formatWorldDate} from "../Simulation/WorldTime";
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
   if(e.personId===m.leaderPersonId&&e.personalName===name&&Array.isArray(e.participants)&&e.participants.length>=2){
    const c=e.localCrisis,f=c?.facts;
    const hasLocalSources=Array.isArray(c?.crisisSourceEventIds)&&c.crisisSourceEventIds.length>0;
    const crisis=hasLocalSources&&c?.reason==='MILITARY_SIEGE_CRISIS'&&f?.underSiege?`${city}正遭围攻，城防受损。`:hasLocalSources&&typeof f?.lastCapturedMonth==='number'&&f.devastation>=35?`此前${formatWorldDate(f.lastCapturedMonth)}${city}易手，起事时城中仍有战乱创伤。`:'';
    const support=c?.supporterKind==='RESIDENT'?'当地有人响应。':'';
    const result=viewFactionId!==undefined&&viewFactionId===event.targetFactionId?`原${source}${office}${name}率${e.participants.length-1}名旧部于${city}举兵，叛离${source}国，另立${newFactionName}，自任${title==='首任首领'?'首领':title==='首任国君'?'国君':'皇帝'}。`:`${source}${office}${name}率${e.participants.length-1}名旧部于${city}举兵，脱离${source}国，建立${newFactionName}，自任${title==='首任首领'?'首领':title==='首任国君'?'国君':'皇帝'}。`;
    return `${crisis}${result}${support}`;
   }
  }catch{/* Missing evidence falls back to the established founding facts. */}
 }
 return `${name}原为${source}居民，于${city}参与起事，随居民转属建立${newFactionName}，成为其${title}。`;
}

/** Exact event-time observations, kept out of narrative prose. No present-day registry lookup. */
export function militarySecessionDetails(event:WorldEvent):string[]{
 const m=event.metadata;if(m?.splitSource!=='MILITARY'||typeof m.militarySplitEvidence!=='string')return [];
 try{const e=JSON.parse(m.militarySplitEvidence);if(e.personId!==m.leaderPersonId||!Array.isArray(e.participants))return [];
  const c=e.localCrisis,f=c?.facts;
  return [`永久人物 ${e.personId} · 原军令编组 ${e.commandId} · 事变月 ${e.worldMonth}`,
   ...(e.disposition?[`当时忠诚 ${e.disposition.loyalty} · 野心 ${e.disposition.ambition} · 军权威望 ${e.disposition.prestige} · 响应阈值 ${e.disposition.responseThreshold}`]:[]),
   ...(f?[`危机来源 ${c.reason} · 地方原事件 ${(c.crisisSourceEventIds??[]).join('、')||'未保存可独立引用的地方事件'} · 地方忠诚 ${f.loyalty} · 战乱创伤 ${f.devastation} · 国家稳定 ${f.stability}`,
    `史料截止事件 ${c.historyBoundaryEventId??'未记录'}（时间边界，并非危机来源）`,
    `同次政治机会：概率 ${c.chance} · 抽签 ${c.roll} · 支持者 ${c.supporter.userId}（${c.supporterKind==='COMMAND_FOLLOWER'?'旧部':'当地居民'}），单位 ${c.supporter.unitId}`]:[]),
   ...e.participants.map((u:any)=>`实际转属 User ${u.userId} · 出生月 ${u.bornMonth} · 单位 ${u.unitId} · 当时忠诚 ${u.loyalty??'未记录'} · 地点 ${u.x},${u.y}（${u.positionSource}）`),
   `军事活动依据 ${(e.localCareerEventIds??e.capturedEventIds??[]).join('、')||'见任职记录'}`];
 }catch{return [];}
}
