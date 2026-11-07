import {getRegimeStyleNameAtMonth} from '../Simulation/RegimeStyle';
import type {WorldSaveV1,RulerSaveV17} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {nextRoyalNobleAct} from '../Politics/RoyalNobility';
import {verifiedRoyalRegistration} from '../Politics/RoyalPersonRegistration';
/** Replay only actual committed boundaries. Final status must not leak into the past. */
export function validateRoyalNobility(save:WorldSaveV1):string[]{
 const events=save.worldHistory.events as WorldEvent[];if(events.some(e=>!e||typeof e!=='object'))return ['invalid royal noble history shape'];
 const errors:string[]=[],positions=new Map(events.map((e,i)=>[e.id,i])),people=save.registries.militaryCommandRegistry.people,seen=new Set<string>(),registrations=new Set<string>();
 for(const data of save.dynasties){try{
  const d={...data,rulers:(data.rulers as RulerSaveV17[]).map(importRulerSave)} as unknown as import('../Politics/Dynasty').Dynasty;
  for(const r of d.rulers)if(r.registration){if(!verifiedRoyalRegistration(r,d.factionId,events,save.world.worldMonth)||registrations.has(r.registration.eventId))throw Error('invalid royal registration identity/parent/boundary');registrations.add(r.registration.eventId);}
  const acts=d.royalNobility??[];if(!Array.isArray(acts))throw Error('royal noble acts must be an array');
  const replay={...d,royalNobility:[] as NonNullable<typeof d.royalNobility>};let previous=-1;
  for(const a of acts){
   if(!a||a.version!==1||a.factionId!==d.factionId||!Number.isSafeInteger(a.month)||a.month>save.world.worldMonth)throw Error('invalid royal noble act');
   const boundary=positions.get(a.eventId),e=boundary===undefined?undefined:events[boundary];
   if(boundary===undefined||boundary<=previous||seen.has(a.eventId)||e?.type!=='royal-noble-act'||e.actorFactionId!==d.factionId||(e.monthIndex??e.year)!==a.month||e.metadata?.royalNobleAct!==JSON.stringify(a))throw Error('invalid royal noble event/source sequence');
   const f=save.factions.find(f=>f.factionId===d.factionId),planned=nextRoyalNobleAct(replay,people,events.slice(0,boundary),a.month,undefined,f?getRegimeStyleNameAtMonth({...f,name:f.factionId,displayName:f.displayName??f.factionId,nameHistory:f.nameHistory??[],sovereigntyHistory:f.sovereigntyHistory??[]} as unknown as Parameters<typeof getRegimeStyleNameAtMonth>[0],a.month):undefined);
   if(JSON.stringify(planned)!==JSON.stringify(a))throw Error('royal noble historical replay mismatch');
   seen.add(a.eventId);replay.royalNobility.push(a);previous=boundary;
  }
 }catch(error){errors.push(`invalid royal nobility ${String(data.factionId)}: ${String(error)}`);}}
 for(const e of events)if(e.type==='royal-person-registered'&&!registrations.has(e.id))errors.push('orphan royal registration event');
 for(const e of events)if(e.type==='royal-noble-act'&&!seen.has(e.id))errors.push('orphan royal noble event');
 return errors;
}
