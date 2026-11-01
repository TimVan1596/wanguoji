import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {Dynasty} from '../Politics/Dynasty';
import {importRulerSave} from './RulerSaveProjection';
import {planCourtBan,planCourtPardon,militaryCourtText,unresolvedCourtBans} from '../Politics/MilitaryCourtStanding';
import {nobleEpochForRuler} from '../Politics/MilitaryNobility';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** Audit each act against preceding sources, then prohibit appointments made under an unresolved ban. */
export function validateMilitaryCourt(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}])),used=new Set<string>();
 for(const p of save.registries.militaryCommandRegistry.people){
  if(p.politicalHistory!==undefined&&!Array.isArray(p.politicalHistory)){errors.push('invalid military political history');continue;}
  let last=-1;
  for(const act of p.politicalHistory??[])try{
   const ref=byId.get(act.eventId),f=save.factions.find(f=>f.factionId===act.factionId),saved=save.dynasties.find(d=>d.factionId===act.factionId);
   if(!ref||!f||!saved||act.version!==1||!['COURT_BAN','COURT_PARDONED'].includes(act.kind)||!Number.isSafeInteger(act.month)||act.month<last||act.month%12!==0||act.month>save.world.worldMonth||act.personId!==p.personId||act.sourceUserId!==p.sourceUserId||act.bornMonth!==p.bornMonth||act.personalName!==p.personalName||used.has(act.eventId))throw Error('identity or order');
   const {e,i}=ref,before=events.slice(0,i),ids=new Set(before.map(e=>e.id)),rulers=(saved.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave),issuer=rulers.find(r=>r.id===act.rulerId),victim=rulers.find(r=>r.id===act.victimRulerId);
   if(!issuer||!victim||issuer.accessionYear===undefined||issuer.accessionYear>act.month||(issuer.endYear??Infinity)<act.month||(issuer.deathMonth??Infinity)<act.month||(p.deathMonth??Infinity)<act.month||before.some(e=>['ruler-deposed','ruler-succession','dynasty-usurped'].includes(e.type)&&(e.metadata?.previousRulerId===issuer.id||e.metadata?.predecessorRulerId===issuer.id)||['ruler-died','ruler-captured'].includes(e.type)&&(e.rulerId===issuer.id||e.metadata?.rulerId===issuer.id)))throw Error('living real issuer');
   const terminal=before.filter(e=>['faction-exiled','faction-extinct','faction-dissolved','faction-submitted','faction-merged','faction-restored'].includes(e.type)&&(e.targetFactionId===f.factionId||e.actorFactionId===f.factionId)).at(-1);if(terminal&&terminal.type!=='faction-restored')throw Error('inactive polity');
   const dy={...saved,currentRulerId:issuer.id,rulers:rulers.map(r=>r.id===issuer.id?{...r,status:'ruling',endYear:undefined,deathMonth:undefined}:r)} as Dynasty,team={...f,name:f.factionId,status:'ACTIVE'},past={...p,status:'RETIRED' as const,deathMonth:undefined,factionId:act.factionId,politicalRulerId:undefined,politicalHistory:p.politicalHistory?.filter(a=>ids.has(a.eventId))};
   const attempt=before.find(e=>e.id===act.courtCoupEventId),result=before.find(e=>e.id===act.courtResultEventId);
   const expected=act.kind==='COURT_BAN'&&attempt&&result?planCourtBan(past,team,dy,attempt,result):act.kind==='COURT_PARDONED'?planCourtPardon(past,team,dy,act.month,before,act.stability):undefined;
   if(JSON.stringify(expected)!==JSON.stringify(act)||e.type!=='military-court-sanction'||at(e)!==act.month||e.actorFactionId!==act.factionId||e.rulerId!==act.rulerId||e.metadata?.personId!==p.personId||e.metadata?.courtAct!==JSON.stringify(act)||e.title!==militaryCourtText(act))throw Error('unproven act');
   if(act.kind==='COURT_BAN'&&!before.some(e=>e.type==='military-command-ended'&&e.metadata?.personId===p.personId&&e.metadata?.courtCoupEventId===act.courtCoupEventId&&e.metadata?.endReason==='DISMISSED'))throw Error('no actual dismissal');
   used.add(act.eventId);last=act.month;
  }catch(error){errors.push(`invalid military court act ${act?.eventId}: ${String(error)}`);}
  for(const a of p.appointments){const ref=byId.get(`military-appointment-${a.commandId}`);if(!ref)continue;const beforeIds=new Set(events.slice(0,ref.i).map(e=>e.id)),d=save.dynasties.find(d=>d.factionId===a.factionId);if(!d)continue;const rulers=(d.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave),king=rulers.filter(r=>r.accessionYear!==undefined&&r.accessionYear<=a.startMonth&&(r.endYear??Infinity)>=a.startMonth).sort((a,b)=>(b.reignOrdinal??0)-(a.reignOrdinal??0))[0],epoch=king&&nobleEpochForRuler({...d,rulers} as Dynasty,king.id);
   if(unresolvedCourtBans({...p,politicalHistory:p.politicalHistory?.filter(a=>beforeIds.has(a.eventId))},a.factionId,a.startMonth,epoch?.foundingRulerId).length)errors.push(`appointment under unresolved court ban: ${a.commandId}`);
  }
 }
 for(const e of events)if(e.type==='military-court-sanction'&&!used.has(e.id))errors.push('orphan military court act: '+e.id);
 for(const e of events)if(e.type==='court-coup-result'&&e.metadata?.outcome==='FAILED'&&!events.some(x=>x.type==='military-court-sanction'&&x.id===`${e.metadata?.courtCoupEventId}-ban`&&used.has(x.id)))errors.push('failed coup lacks formal ban: '+e.id);
 return errors;
}
