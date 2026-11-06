import type {RulerSaveV17} from './WorldSaveSchema';
import type {WorldSaveV1} from './WorldSaveSchema';
import {verifyAppointmentSelection,type AppointmentSelection} from '../Politics/AppointmentSelection';
/** Validate frozen selection against its one actual appointment, issuer and stable identity. */
export function validateAppointmentSelections(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as import('../History/WorldHistory').WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}])),state=save.registries.militaryCommandRegistry;
 for(const p of state.people)for(const appointment of p.appointments){const event=byId.get(`military-appointment-${appointment.commandId}`)?.e,raw=event?.metadata?.appointmentSelection;
  if(raw===undefined&&appointment.selection===undefined)continue;
  try{const a=JSON.parse(String(raw)) as AppointmentSelection,row=a.rows[a.selectedIndex],issuer=(save.dynasties.find(d=>d.factionId===a.factionId)?.rulers as RulerSaveV17[]|undefined)?.find(r=>r.rulerId===a.rulerId);
   const officeIssuer=byId.get(`military-office-${appointment.commandId}-XIAOWEI`)?.e.rulerId;
   if(officeIssuer!==undefined&&officeIssuer!==a.rulerId)throw Error('appointment issuing ruler differs from actual initial office');
   if(!verifyAppointmentSelection(a)||JSON.stringify(appointment.selection)!==JSON.stringify(a)||a.policy!==(state.appointmentAbilityPolicy??'BASELINE')||a.month!==appointment.startMonth||a.factionId!==appointment.factionId||!row||row.firstAppointment!==(p.appointments.indexOf(appointment)===0)||row.bornMonth!==p.bornMonth||row.sourceUserId!==undefined&&row.sourceUserId!==p.sourceUserId||row.rulerId!==undefined&&row.rulerId!==p.royalIdentity?.rulerId||!issuer||issuer.accessionMonth===undefined||issuer.accessionMonth>a.month||(issuer.endMonth??Infinity)<a.month||(issuer.deathMonth??Infinity)<a.month)throw Error('identity, authority or selection');
   for(const r of a.rows){if(r.abilities.source.kind==='ROYAL'&&!save.dynasties.some(d=>(d.rulers as RulerSaveV17[]).some(k=>k.rulerId===r.rulerId&&k.bornMonth===r.bornMonth)))throw Error('royal ability source');if(r.titleEventId){const house=state.families?.find(f=>f.familyId===r.familyId),act=house?.nobleSuccession?.find(a=>a.eventId===r.titleEventId),prior=house?.nobleSuccession?.filter(a=>(byId.get(a.eventId)?.i??Infinity)<byId.get(event!.id)!.i).at(-1);if(!act||act.kind!=='SUCCEEDED'||act.holderMemberId!==r.memberId||prior?.eventId!==act.eventId||house!.factionId!==a.factionId||house!.epochFounderId!==a.epochFounderId)throw Error('inactive or foreign title advantage');const e=byId.get(r.titleEventId);if(!e||e.e.type!=='family-title-succeeded'||(e.e.monthIndex??e.e.year)>a.month||e.i>=byId.get(event!.id)!.i||e.e.metadata?.familyId!==r.familyId)throw Error('title source');}if(r.familyId){const f=state.families?.find(f=>f.familyId===r.familyId),m=f?.members.find(m=>m.memberId===r.memberId);if(!m||m.sourceUserId!==r.sourceUserId||m.bornMonth!==r.bornMonth||m.enteredMonth>a.month||m.source==='NATURAL_GROWTH'&&(byId.get(`${m.memberId}-entered`)?.i??Infinity)>=byId.get(event!.id)!.i||(m.deathHistoryIndex??Infinity)<=byId.get(event!.id)!.i||(m.deathMonth??Infinity)<a.month)throw Error('family source');}}
  }catch(e){errors.push(`invalid appointment selection ${appointment.commandId}: ${String(e)}`);}
 }
 return errors;
}
