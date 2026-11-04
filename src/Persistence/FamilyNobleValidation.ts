import type {WorldSaveV1,RulerSaveV17} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {createFamilyNobleContext,familyAtEvidenceBoundary,planFamilyNobleTransition,familyResidenceAt,familyNobleText} from '../Politics/FamilyNobleSuccession';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** Replay the actual finite chain against the historical evidence boundary, never today's title/name. */
export function validateFamilyNobility(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],state=save.registries.militaryCommandRegistry,positions=new Map(events.map((e,i)=>[e.id,i])),bound=new Set<string>();
 const dynasties=save.dynasties.map(d=>({factionId:String(d.factionId),houseEpochs:d.houseEpochs as import('../Politics/DynasticRevolution').DynastyHouseEpoch[]|undefined,rulers:(d.rulers as RulerSaveV17[]).map(importRulerSave)}));
 for(const f of state.families??[])try{
  if(f.nobleSuccession!==undefined&&!Array.isArray(f.nobleSuccession))throw Error('title chain must be an array');
  // Each additional period needs its own unused, real grant. Within a period the
  // original maximum of five death/succession resolutions remains unchanged.
  const periodSources=new Set<string>(),periodResolutions=new Map<number,number>();
  for(const act of f.nobleSuccession??[]){
   const period=act.period??1;
   if(!Number.isSafeInteger(period)||period<1)throw Error('invalid hereditary period');
   if(act.kind==='STARTED'){
    if(act.version!==2||period!==periodSources.size+2||periodSources.has(act.sourceGrantEventId)||!state.people.some(p=>p.nobilityHistory?.some(g=>g.eventId===act.sourceGrantEventId)))throw Error('period requires a unique real grant');
    periodSources.add(act.sourceGrantEventId);
   }else{
    const count=(periodResolutions.get(period)??0)+1;
    if(count>5)throw Error('period exceeds original finite descent chain');
    periodResolutions.set(period,count);
   }
  }
  for(const member of f.members){
   for(const field of ['deathHistoryIndex','exitHistoryIndex'] as const){const v=member[field];if(v!==undefined&&(!Number.isSafeInteger(v)||v<0||v>events.length))throw Error('invalid life evidence boundary');}
   if(member.deathMonth!==undefined){const own=events.findIndex(e=>e.type==='family-member-died'&&e.metadata?.familyId===f.familyId&&e.metadata?.memberId===member.memberId),mil=events.findIndex(e=>e.type==='military-person-died'&&e.metadata?.personId===member.militaryPersonId&&at(e)===member.deathMonth),source=member.militaryPersonId?mil:own;if(member.deathHistoryIndex===undefined||source<0||events[source].metadata?.deathCause!==member.deathCause||member.deathHistoryIndex>source||!member.militaryPersonId&&member.deathHistoryIndex!==own)throw Error('missing contemporaneous actual death boundary');}
   if(member.factionHistory!==undefined&&!Array.isArray(member.factionHistory))throw Error('invalid family residence history');
   let previousMonth=member.enteredMonth,previousIndex=-1,previousFaction=f.factionId;
   for(const h of member.factionHistory??[]){if(!Number.isSafeInteger(h.month)||h.month<previousMonth||h.month>save.world.worldMonth||h.month>(member.deathMonth??Infinity)||!Number.isSafeInteger(h.eventIndex)||h.eventIndex<previousIndex||h.eventIndex>events.length||h.factionId===previousFaction||!save.factions.some(t=>t.factionId===h.factionId))throw Error('invalid actual population transfer');previousMonth=h.month;previousIndex=h.eventIndex;previousFaction=h.factionId;}
   const u=save.users.find(u=>u.userId===member.sourceUserId&&u.bornMonth===member.bornMonth);if(u&&u.factionId!==familyResidenceAt(f,member,save.world.worldMonth))throw Error('family residence differs from original User');
  }
  const prefix:NonNullable<typeof f.nobleSuccession>=[];let previousPosition=-1;
  for(const a of f.nobleSuccession??[]){const i=positions.get(a.eventId),e=i===undefined?undefined:events[i];if(i===undefined||i<=previousPosition||!e||a.month>save.world.worldMonth||a.month<f.foundedMonth||![1,2].includes(a.version)||a.step!==prefix.length+1||a.eventId!==`${f.familyId}-succession-${a.step}`)throw Error('invalid title sequence');
   if(e.metadata?.familyNoblePolicy!==undefined&&!['SINGLE','RENEWAL'].includes(String(e.metadata.familyNoblePolicy))||e.metadata?.familyNoblePolicy==='RENEWAL'&&state.familyNoblePolicy!=='RENEWAL')throw Error('invalid title policy source');
   const historical=familyAtEvidenceBoundary({...f,nobleSuccession:prefix},a.month,i,events),prior=events.slice(0,i),c={...createFamilyNobleContext(a.month,[historical],state.people,prior,dynasties),renewable:e.metadata?.familyNoblePolicy==='RENEWAL'},expected=planFamilyNobleTransition(historical,c);
   if(!expected||JSON.stringify(expected)!==JSON.stringify(a))throw Error('title outcome differs from real prior grant, death, kinship, residence, politics or deterministic heir');
   if(e.type!==(a.kind==='STARTED'?'family-title-started':a.kind==='SUCCEEDED'?'family-title-succeeded':'family-title-ended')||e.actorFactionId!==f.factionId||at(e)!==a.month||e.metadata?.familyId!==f.familyId||e.metadata?.familyNobleAct!==JSON.stringify(a)||e.title!==familyNobleText(f,a))throw Error('title history source mismatch');
   for(const id of a.sourceEventIds)if(!prior.some(e=>e.id===id))throw Error('missing prior title or death evidence');
   const m=f.members.find(m=>m.memberId===a.previousMemberId)!;if(a.sourceEventIds.includes(`${f.familyId}-${m.memberId}-death`))bound.add(`${f.familyId}-${m.memberId}-death`);
   prefix.push(a);previousPosition=i;bound.add(a.eventId);
  }
 }catch(e){errors.push(`invalid family title ${f.familyId}: ${String(e)}`);}
 for(const e of events){if(['family-title-started','family-title-succeeded','family-title-ended'].includes(e.type)&&!bound.has(e.id))errors.push(`orphan family title ${e.id}`);
 if(e.type==='family-member-died'){
  const f=state.families?.find(f=>f.familyId===e.metadata?.familyId),m=f?.members.find(m=>m.memberId===e.metadata?.memberId);
  if(!f||!m||e.id!==`${f.familyId}-${m.memberId}-death`||m.deathMonth!==at(e)||e.metadata?.sourceUserId!==m.sourceUserId||e.metadata?.bornMonth!==m.bornMonth||e.metadata?.deathCause!==m.deathCause)errors.push(`invalid family death source ${e.id}`);
 }}
 return errors;
}
