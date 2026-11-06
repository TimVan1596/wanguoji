import type {WorldEvent} from './WorldHistory';
import type {CourtCoupRecord} from '../Politics/CourtCoup';
import {MILITARY_OFFICE_NAMES} from '../Politics/MilitaryOffice';
export function readCourtCoup(e:WorldEvent):CourtCoupRecord|undefined {try{const r=JSON.parse(String(e.metadata?.courtCoup));return [3,4].includes(r?.version)&&r.factionId===e.actorFactionId?r:undefined;}catch{return;}}
export function isSelfCourtCoup(r:CourtCoupRecord){return r.target.basis==='SELF'&&r.actorRulerId===r.targetRulerId;}
export function courtCoupAttemptText(r:CourtCoupRecord){
 const f=r.crisisFacts.at(-1),cause=f?.cityName?(f.type==='capital-fallen'?`${f.countryLabel}都城${f.cityName}失守后，`:f.type==='city-revolt'?`${f.cityName}发生叛乱后，`:`${f.countryLabel}失${f.cityName}后，`):f?.type==='empire-split'?`${f.countryLabel}分裂之际，`:'';
 const kin:Record<string,string>={DIRECT_CHILD:'其子',GRANDCHILD:'其孙',SIBLING:r.target.bornMonth>r.previousRulerBornMonth?'其弟':r.target.bornMonth<r.previousRulerBornMonth?'其兄':'其兄弟',NEPHEW:'其侄',UNCLE:'其叔伯',COUSIN:'其堂亲'};
 const who=`${cause?'':r.countryLabel}${MILITARY_OFFICE_NAMES[r.participant.officeStanding!.office]}${r.participant.personalName??r.participant.name}`;
 if(isSelfCourtCoup(r))return `${cause}${who}谋废${r.target.relation==='DIRECT_CHILD'?'其父'+r.previousRulerTitle:r.previousRulerTitle}，图自立为王。`;
 return `${cause}${who}谋废${r.previousRulerTitle}，欲拥立${kin[r.target.relation]??'宗室成员'}${r.target.name}。`;
}
export function courtCoupText(r:CourtCoupRecord,consequences:{executed?:boolean;banned?:boolean;forfeitedRank?:string;disinherited?:boolean}={}){
 return `【${isSelfCourtCoup(r)?(r.outcome==='SUCCESS'?'夺位得位':'夺位未遂'):(r.outcome==='SUCCESS'?'拥立得位':'拥立未遂')}】${courtCoupAttemptText(r)}${r.outcome==='SUCCESS'?`事成，${r.previousRulerTitle}被废，${r.target.name}${isSelfCourtCoup(r)?'自立为王':'承统'}。`:`事败，${r.participant.personalName??r.participant.name}被免军职${consequences.forfeitedRank?`、追夺${consequences.forfeitedRank}`:''}${consequences.executed?'，因谋逆伏诛':consequences.banned?'，并禁仕':''}${consequences.disinherited?'，废除承统资格':''}，${r.previousRulerTitle}仍在位。`}`;
}
/** Exact transaction graph; no same-month/name grouping, no canonical event deletion. */
export function mergeCourtCoupReading(events:readonly WorldEvent[]){
 const at=(e:WorldEvent)=>e.monthIndex??e.year;
 const byId=new Map(events.map(e=>[e.id,e])),children=new Map<string,WorldEvent[]>(),hidden=new Set<string>(),replaced=new Map<string,WorldEvent>();
 for(const e of events){const parent=e.metadata?.courtCoupEventId;if(typeof parent==='string'){const rows=children.get(parent)??[];rows.push(e);children.set(parent,rows);}}
 for(const e of events){if(e.type!=='court-coup-attempt')continue;const r=readCourtCoup(e);if(!r)continue;
  const result=byId.get(r.outcomeEventId),m=result?.metadata;
  if(result?.type!=='court-coup-result'||m?.courtCoupEventId!==e.id||m.personId!==r.participant.personId||m.targetRulerId!==r.targetRulerId||m.outcome!==r.outcome||result.actorFactionId!==e.actorFactionId||at(result)!==at(e))continue;
  const dep=typeof m.depositionEventId==='string'?byId.get(m.depositionEventId):undefined;
  if(r.outcome==='SUCCESS'&&(!dep||dep.type!=='ruler-deposed'||dep.metadata?.courtCoupEventId!==e.id||dep.metadata.previousRulerId!==r.previousRulerId||dep.rulerId!==r.targetRulerId||dep.actorFactionId!==e.actorFactionId||at(dep)!==at(e)))continue;
  const sources=[e,result,...(dep?[dep]:[])];
  for(const x of children.get(e.id)??[])if(x.type==='military-command-ended'&&x.metadata?.courtCoupEventId===e.id&&x.metadata.personId===r.participant.personId&&x.metadata.commandId===r.participant.commandId&&x.metadata.endReason==='DISMISSED'&&x.actorFactionId===e.actorFactionId&&at(x)===at(e))sources.push(x);
  for(const x of sources)if(x!==e)hidden.add(x.id);
  const service=children.get(e.id)?.find(x=>x.type==='court-service-granted'&&x.metadata?.courtCoupEventId===e.id&&x.metadata?.courtResultEventId===result.id&&x.metadata?.personId===r.participant.personId&&x.rulerId===r.targetRulerId&&at(x)===at(e));if(service){sources.push(service);hidden.add(service.id);}
  const ban=children.get(e.id)?.find(x=>x.type==='military-court-sanction'&&x.actorFactionId===e.actorFactionId&&x.rulerId===r.previousRulerId&&at(x)===at(e)&&x.metadata?.personId===r.participant.personId);
  const revocation=events.find(x=>x.type==='military-title-revoked'&&x.actorFactionId===e.actorFactionId&&at(x)===at(e)&&x.metadata?.personId===r.participant.personId&&(()=>{try{const h=JSON.parse(String(x.metadata?.honor));return h.reason==='COURT_COUP_FAILED'&&h.sourceEventId===result.id;}catch{return false;}})());
  for(const extra of [ban,revocation])if(extra){sources.push(extra);hidden.add(extra.id);}
  const forfeiture=revocation?(()=>{try{return ({BO:'伯爵',HOU:'侯爵',GONG:'公爵'} as Record<string,string>)[JSON.parse(String(revocation.metadata?.honor)).rank];}catch{return;}})():undefined;
  const reward=children.get(e.id)?.find(x=>x.type==='court-reward-granted'&&x.actorFactionId===e.actorFactionId&&x.metadata?.personId===r.participant.personId&&at(x)===at(e)&&x.rulerId===r.targetRulerId),noble=reward&&byId.get(String(reward.metadata?.nobleGrantEventId));
  for(const extra of [reward,noble])if(extra){sources.push(extra);hidden.add(extra.id);}
  const disinherit=children.get(e.id)?.find(x=>x.type==='royal-succession-sanction'&&x.rulerId===r.targetRulerId&&x.actorFactionId===r.factionId&&at(x)===r.month);if(disinherit){sources.push(disinherit);hidden.add(disinherit.id);}
  const execution=ban&&events.find(x=>x.type==='military-person-died'&&x.metadata?.personId===r.participant.personId&&x.metadata?.courtActEventId===ban.id&&x.metadata?.deathCause==='POLITICAL_EXECUTION'&&at(x)===r.month);if(execution){sources.push(execution);hidden.add(execution.id);}
  const text=courtCoupText(r,{executed:!!execution,banned:!!ban,forfeitedRank:forfeiture,disinherited:!!disinherit})+(service?'新君录其为拥立功臣。':'')+(reward?reward.title:'');replaced.set(e.id,{...e,title:text,description:text,metadata:{...e.metadata,courtReadingKind:'COURT_COUP',...(revocation?{courtRevocationEventId:revocation.id}:{}),...(service?{courtServiceEventId:service.id}:{}),sourceEventIds:sources.map(x=>x.id).join(',')}});
 }
 const output:WorldEvent[]=[];for(const e of events)if(!hidden.has(e.id))output.push(replaced.get(e.id)??e);return output;
}
