import {currentNobleGrant,nobleEpochForRuler,nobleChronicle} from '../Politics/MilitaryNobility';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {Dynasty} from '../Politics/Dynasty';
import {importRulerSave} from './RulerSaveProjection';
import {planCourtBan,planCourtPardon,militaryCourtText,unresolvedCourtBans} from '../Politics/MilitaryCourtStanding';
import {nextMilitaryHonors} from '../Politics/MilitaryHonors';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** Audit each act against preceding sources, then prohibit appointments made under an unresolved ban. */
export function validateMilitaryCourt(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}])),used=new Set<string>();
 for(const p of save.registries.militaryCommandRegistry.people){
  if(p.politicalHistory!==undefined&&!Array.isArray(p.politicalHistory)){errors.push('invalid military political history');continue;}
  if(!p.politicalHistory?.length)continue;
  let last=-1;
  for(const act of p.politicalHistory??[])try{
   const ref=byId.get(act.eventId),f=save.factions.find(f=>f.factionId===act.factionId),saved=save.dynasties.find(d=>d.factionId===act.factionId);
   if(!ref||!f||!saved||act.version!==1||!['COURT_BAN','COURT_PARDONED'].includes(act.kind)||!Number.isSafeInteger(act.month)||act.month<last||act.month%12!==0||act.month>save.world.worldMonth||act.personId!==p.personId||act.sourceUserId!==p.sourceUserId||act.bornMonth!==p.bornMonth||act.personalName!==p.personalName||used.has(act.eventId))throw Error('identity or order');
   const {e,i}=ref,before=events.slice(0,i),ids=new Set(before.map(e=>e.id)),rulers=(saved.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave),issuer=rulers.find(r=>r.id===act.rulerId),victim=rulers.find(r=>r.id===act.victimRulerId);
   if(!issuer||!victim||issuer.accessionYear===undefined||issuer.accessionYear>act.month||(issuer.endYear??Infinity)<act.month||(issuer.deathMonth??Infinity)<act.month||(p.deathMonth??Infinity)<act.month||before.some(e=>['ruler-deposed','ruler-succession','dynasty-usurped'].includes(e.type)&&(e.metadata?.previousRulerId===issuer.id||e.metadata?.predecessorRulerId===issuer.id)||['ruler-died','ruler-captured'].includes(e.type)&&(e.rulerId===issuer.id||e.metadata?.rulerId===issuer.id)))throw Error('living real issuer');
   const terminal=before.filter(e=>['faction-exiled','faction-extinct','faction-dissolved','faction-submitted','faction-merged','faction-restored'].includes(e.type)&&(e.type==='faction-restored'?(e.targetFactionId===f.factionId||e.actorFactionId===f.factionId):e.targetFactionId===f.factionId)).at(-1);if(terminal&&terminal.type!=='faction-restored')throw Error('inactive polity');
   if(before.some(e=>e.type==='military-person-died'&&e.metadata?.personId===p.personId||p.royalIdentity&&(['ruler-died','ruler-captured'].includes(e.type)&&(e.rulerId===p.royalIdentity.rulerId||e.metadata?.rulerId===p.royalIdentity.rulerId)||e.type==='heir-died'&&e.metadata?.heirId===p.royalIdentity.rulerId)))throw Error('person died before political act');
   const dy={...saved,currentRulerId:issuer.id,rulers:rulers.map(r=>r.id===issuer.id?{...r,status:'ruling',endYear:undefined,deathMonth:undefined}:r)} as Dynasty,team={...f,name:f.factionId,status:'ACTIVE'},past={...p,status:'RETIRED' as const,deathMonth:undefined,factionId:act.factionId,politicalRulerId:undefined,politicalHistory:p.politicalHistory?.filter(a=>ids.has(a.eventId))};
   const attempt=before.find(e=>e.id===act.courtCoupEventId),result=before.find(e=>e.id===act.courtResultEventId);
   const expected=act.kind==='COURT_BAN'&&attempt&&result?planCourtBan(past,team,dy,attempt,result,save.registries.militaryCommandRegistry.courtPunishmentPolicy??'BASELINE'):act.kind==='COURT_PARDONED'?planCourtPardon(past,team,dy,act.month,before,act.stability):undefined;
   if(JSON.stringify(expected)!==JSON.stringify(act)||e.type!=='military-court-sanction'||at(e)!==act.month||e.actorFactionId!==act.factionId||e.rulerId!==act.rulerId||e.metadata?.personId!==p.personId||e.metadata?.courtCoupEventId!==act.courtCoupEventId||e.metadata?.sourceEventIds!==act.sourceEventIds.join(',')||e.metadata?.courtAct!==JSON.stringify(act)||e.title!==militaryCourtText(act))throw Error('unproven act');
   if(act.kind==='COURT_BAN'&&!before.some(e=>e.type==='military-command-ended'&&e.metadata?.personId===p.personId&&e.metadata?.courtCoupEventId===act.courtCoupEventId&&e.metadata?.endReason==='DISMISSED'))throw Error('no actual dismissal');
   if(act.kind==='COURT_BAN'){
    const through=events.slice(0,i+1),priorPerson={...past,politicalHistory:[...(past.politicalHistory??[]),act],honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId)),nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId))};
    for(const required of nextMilitaryHonors(priorPerson,save.registries.militaryCommandRegistry.formations,through,act.month,[team],[dy]))if(required.reason==='COURT_COUP_FAILED'&&!p.honorHistory?.some(h=>JSON.stringify(h)===JSON.stringify(required)))throw Error('required formal forfeiture missing');
   }
   if(act.severity==='EXECUTION'){
    const death=events.find(x=>x.type==='military-person-died'&&x.metadata?.personId===p.personId),deathIndex=death?byId.get(death.id)!.i:-1;
    if(act.kind!=='COURT_BAN'||p.status!=='DEAD'||p.deathMonth!==act.month||p.deathCause!=='POLITICAL_EXECUTION'||!death||death.id!==`military-person-death-${p.personId}-${act.month}`||deathIndex<=i||at(death)!==act.month||death.metadata?.deathCause!=='POLITICAL_EXECUTION'||death.metadata?.courtActEventId!==act.eventId||death.title!==`${p.personalName}因谋逆伏诛`||save.users.some(u=>u.userId===p.sourceUserId&&u.bornMonth===p.bornMonth)||p.appointments.some(a=>a.endMonth===undefined||byId.get(`military-appointment-${a.commandId}`)!.i>deathIndex)||p.nobilityHistory?.some(g=>(byId.get(g.eventId)?.i??-1)>deathIndex))throw Error('execution lacks actual exclusive death and closed authority');
    if(events.filter(x=>x.type==='military-person-died'&&x.metadata?.personId===p.personId).length!==1)throw Error('repeated political death');
    if(p.royalIdentity){const royal=rulers.find(r=>r.id===p.royalIdentity!.rulerId);if(!royal||royal.status!=='dead'||royal.deathMonth!==act.month||royal.deathReason!=='因谋逆伏诛')throw Error('execution royal life mismatch');}
   }
   used.add(act.eventId);last=act.month;
  }catch(error){errors.push(`invalid military court act ${act?.eventId}: ${String(error)}`);}
  for(const a of p.appointments){const ref=byId.get(`military-appointment-${a.commandId}`);if(!ref)continue;const beforeIds=new Set(events.slice(0,ref.i).map(e=>e.id)),d=save.dynasties.find(d=>d.factionId===a.factionId);if(!d)continue;const rulers=(d.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave),epochs=d.houseEpochs as Dynasty['houseEpochs'],epoch=epochs?.filter(ep=>ep.startMonth<a.startMonth||ep.startMonth===a.startMonth&&(ep.startReason==='FOUNDING'||events.some(e=>beforeIds.has(e.id)&&e.type==='dynasty-usurped'&&e.actorFactionId===a.factionId&&e.rulerId===ep.foundingRulerId))).sort((x,y)=>(rulers.find(r=>r.id===y.foundingRulerId)?.reignOrdinal??0)-(rulers.find(r=>r.id===x.foundingRulerId)?.reignOrdinal??0))[0];
   if(unresolvedCourtBans({...p,politicalHistory:p.politicalHistory?.filter(a=>beforeIds.has(a.eventId))},a.factionId,a.startMonth,epoch?.foundingRulerId).length)errors.push(`appointment under unresolved court ban: ${a.commandId}`);
  }
 }
 for(const p of save.registries.militaryCommandRegistry.people)if(p.deathCause==='POLITICAL_EXECUTION'&&!p.politicalHistory?.some(a=>used.has(a.eventId)&&a.kind==='COURT_BAN'&&a.severity==='EXECUTION'&&a.month===p.deathMonth))errors.push('political death lacks proven judgement: '+p.personId);
 for(const e of events)if(e.type==='military-person-died'&&e.metadata?.deathCause==='POLITICAL_EXECUTION'&&!save.registries.militaryCommandRegistry.people.some(p=>p.personId===e.metadata?.personId&&p.deathCause==='POLITICAL_EXECUTION'&&p.politicalHistory?.some(a=>a.eventId===e.metadata?.courtActEventId&&used.has(a.eventId))))errors.push('orphan political execution: '+e.id);
 for(const e of events)if(e.type==='military-court-sanction'&&!used.has(e.id))errors.push('orphan military court act: '+e.id);
 for(const e of events)if(e.type==='court-coup-result'&&e.metadata?.outcome==='FAILED'&&!events.some(x=>x.type==='military-court-sanction'&&x.id===`${e.metadata?.courtCoupEventId}-ban`&&used.has(x.id)))errors.push('failed coup lacks formal ban: '+e.id);
 for(const e of events)if(e.type==='court-reward-granted')try{
  const m=e.metadata!,service=byId.get(String(m.courtServiceEventId)),grant=byId.get(String(m.nobleGrantEventId)),p=save.registries.militaryCommandRegistry.people.find(p=>p.personId===m.personId),g=p?.nobilityHistory?.find(g=>g.eventId===m.nobleGrantEventId);
  if(!service||!grant||!g||e.id!==`${service.e.id}-peerage`||service.e.type!=='court-service-granted'||grant.e.type!==(g.basis==='COURT'?'court-peerage-granted':'military-ennobled')||grant.e.metadata?.courtServiceEventId!==service.e.id||grant.e.metadata?.courtCoupEventId!==m.courtCoupEventId||e.actorFactionId!==g.factionId||service.e.actorFactionId!==g.factionId||e.rulerId!==g.rulerId||service.e.rulerId!==g.rulerId||m.courtCoupEventId!==service.e.metadata?.courtCoupEventId||m.previousRank!==g.previousRank||m.rank!==g.rank||at(e)!==g.month||at(service.e)!==g.month||service.i>=grant.i||grant.i>=byId.get(e.id)!.i)throw Error('unproven political peerage reward');
  if(g.basis==='COURT'&&e.title!==nobleChronicle(g))throw Error('political peerage text differs from its actual source');
 }catch(error){errors.push(`invalid court reward ${e.id}: ${String(error)}`);}
 for(const service of events)if(service.type==='court-service-granted'&&(save.registries.militaryCommandRegistry.hereditaryRecruitment??'BASELINE')!=='BASELINE')try{
  const p=save.registries.militaryCommandRegistry.people.find(p=>p.personId===service.metadata?.personId),i=byId.get(service.id)!.i,ids=new Set(events.slice(0,i).map(e=>e.id)),d=save.dynasties.find(d=>d.factionId===service.actorFactionId),month=at(service);
  if(!p||!d)throw Error('missing supporter');
  const epoch=nobleEpochForRuler({...d,rulers:(d.rulers as any[]).map(importRulerSave)} as any,service.rulerId??null)?.foundingRulerId;
  const past={...p,nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId)),honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId))};
  if(!p.royalIdentity&&epoch&&!past.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month===month)&&!currentNobleGrant(past,service.actorFactionId!,month,epoch)&&!events.some(e=>e.type==='court-reward-granted'&&e.metadata?.courtServiceEventId===service.id))throw Error('untitled actual supporter lacks mandatory sourced peerage');
 }catch(error){errors.push(`missing court peerage ${service.id}: ${String(error)}`);}
 for(const e of events)if(e.type==='military-title-revoked')try{const h=JSON.parse(String(e.metadata?.honor));if(h.reason==='COURT_COUP_FAILED'&&!events.some(b=>b.id===e.metadata?.courtCoupEventId&&b.type==='court-coup-attempt'&&b.metadata?.personId===e.metadata?.personId&&h.sourceEventId===`${b.id}-result`))errors.push('unbound court forfeiture: '+e.id);}catch{}
 for(const e of events)if(['military-ennobled','court-peerage-granted'].includes(e.type)&&typeof e.metadata?.courtServiceEventId==='string'&&!events.some(x=>x.type==='court-reward-granted'&&x.metadata?.nobleGrantEventId===e.id&&x.metadata?.courtServiceEventId===e.metadata?.courtServiceEventId))errors.push('political peerage lacks reward source: '+e.id);
 return errors;
}
