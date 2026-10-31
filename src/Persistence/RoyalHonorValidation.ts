import type {Dynasty} from '../Politics/Dynasty';
import type {WorldSaveV1,RulerSaveV17} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {getRecordedKinRelation} from '../Politics/DynasticCandidateRules';
import {effectiveRoyalHonor,ROYAL_HONOR_ADVANTAGE,royalHonorText,royalHonorMerits,royalName,type RoyalHonor} from '../Politics/RoyalHonors';
import {formatRulerTitleAtMonth} from '../Politics/RulerTitleRules';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** Audits frozen grants against real kin, sovereign office and prior canonical sources. */
export function validateRoyalHonors(save:WorldSaveV1):string[]{
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,index)=>[e.id,{e,index}])),seen=new Set<string>();
 for(const d of save.dynasties){
  const records=d.rulers as RulerSaveV17[],rulers=records.map(importRulerSave),f=save.factions.find(f=>f.factionId===d.factionId);
  const grants:RoyalHonor[]=[];
  for(const r of rulers){if(r.royalHonors!==undefined&&!Array.isArray(r.royalHonors)){errors.push('invalid royal honor list');continue;}grants.push(...(r.royalHonors??[]));}
  for(const owner of rulers)for(const g of Array.isArray(owner.royalHonors)?owner.royalHonors:[]){try{
   const recipient=rulers.find(r=>r.id===g.recipientRulerId),issuer=rulers.find(r=>r.id===g.issuerRulerId),source=byId.get(g.eventId),m=g.month,epoch=(d.houseEpochs as Dynasty['houseEpochs'])?.find(e=>e.foundingRulerId===g.epochFounderId),prior=events.slice(0,source?.index??0);
   if(!f||!recipient||!issuer||!source||g.version!==1||owner!==recipient||seen.has(g.eventId)||g.factionId!==d.factionId||!Number.isSafeInteger(m)||m<0||m>save.world.worldMonth||m%12!==0||g.eventId!==`royal-honor-${g.factionId}-${g.recipientRulerId}-${g.epochFounderId}-${g.rank}`||!['FENGJUN','QINWANG'].includes(g.rank)||g.sovereigntyRank!==(g.rank==='QINWANG'?'EMPEROR':'KING')||source.e.type!=='royal-honor-granted'||source.e.actorFactionId!==d.factionId||source.e.rulerId!==issuer.id||source.e.metadata?.recipientRulerId!==recipient.id||source.e.metadata.royalHonor!==JSON.stringify(g)||at(source.e)!==m||source.e.title!==royalHonorText(g))throw Error('source or grant identity');
   seen.add(g.eventId);
   const endedBefore=(id:string)=>prior.some(e=>['ruler-succession','ruler-deposed'].includes(e.type)&&e.metadata?.previousRulerId===id||e.type==='dynasty-usurped'&&e.metadata?.predecessorRulerId===id||['ruler-died','ruler-captured','heir-died'].includes(e.type)&&(e.rulerId===id||e.metadata?.rulerId===id));
   if(!epoch||epoch.startMonth>m||epoch.endMonth!==undefined&&epoch.endMonth<m||g.houseName!==recipient.houseName||g.houseName!==issuer.houseName||g.houseName!==epoch.houseName||issuer.id===recipient.id||issuer.accessionYear===undefined||m-issuer.accessionYear<12||issuer.endYear!==undefined&&issuer.endYear<m||issuer.deathMonth!==undefined&&issuer.deathMonth<m||endedBefore(issuer.id)||f.stateFoundedMonth===undefined||f.stateFoundedMonth>m||m-recipient.bornYear<288||g.bornMonth!==recipient.bornYear||recipient.deathMonth!==undefined&&recipient.deathMonth<m||(recipient.naturalDeathYear??recipient.plannedEndYear??Infinity)<=m||recipient.accessionYear!==undefined&&recipient.accessionYear<m||endedBefore(recipient.id)||g.recipientName!==royalName(recipient)||g.issuerName!==royalName(issuer)||!g.relation||g.relation==='COLLATERAL_KIN'||getRecordedKinRelation(recipient,issuer,rulers)!==g.relation)throw Error('real kin, life or office');
   if(prior.some(e=>e.type==='dynasty-usurped'&&e.actorFactionId===d.factionId&&e.rulerId!==g.epochFounderId&&at(e)>=epoch.startMonth))throw Error('ended house');
   const terminal=prior.filter(e=>(['faction-exiled','faction-extinct','faction-dissolved'].includes(e.type)&&e.targetFactionId===d.factionId)||e.type==='faction-restored'&&e.actorFactionId===d.factionId||e.type==='faction-submitted'&&e.metadata?.submittedFactionId===d.factionId||e.type==='faction-merged'&&e.metadata?.absorbedFactionId===d.factionId).at(-1);
   if(terminal&&terminal.type!=='faction-restored')throw Error('not in-country');
   const histories=f.sovereigntyHistory as Array<{rank:string;startMonth:number}>;
   const rank=histories.filter(h=>h.startMonth<m||h.startMonth===m&&(h.rank!=='EMPEROR'||prior.some(e=>e.type==='emperor-proclaimed'&&e.actorFactionId===d.factionId&&at(e)===m))).sort((a,b)=>a.startMonth-b.startMonth).at(-1)?.rank??'KING';
   if(rank!==g.sovereigntyRank||g.rank==='QINWANG'&&!prior.some(e=>e.type==='emperor-proclaimed'&&e.actorFactionId===d.factionId))throw Error('sovereign rank');
   if(![f.factionId,f.displayName,...f.nameHistory.map(h=>h.name)].includes(g.countryName)||g.issuerTitle!==formatRulerTitleAtMonth({name:d.factionId,displayName:g.countryName,nameHistory:[{name:g.countryName,startMonth:0}],identityStage:'STATE',stateFoundedMonth:f.stateFoundedMonth,sovereigntyRank:g.sovereigntyRank,sovereigntyHistory:[{rank:g.sovereigntyRank,startMonth:f.stateFoundedMonth}]},g.issuerName,m))throw Error('event-time names');
   const earlier=grants.filter(h=>(byId.get(h.eventId)?.index??Infinity)<source.index);
   if(earlier.some(h=>m-h.month<36)||earlier.some(h=>h.recipientRulerId===g.recipientRulerId&&h.epochFounderId===g.epochFounderId&&h.rank===g.rank))throw Error('cooldown or repeated title');
   const occupied=new Set(earlier.filter(h=>h.epochFounderId===g.epochFounderId).filter(h=>{const r=rulers.find(r=>r.id===h.recipientRulerId)!;return (r.deathMonth===undefined||r.deathMonth>=m)&&(r.naturalDeathYear??r.plannedEndYear??Infinity)>m&&(r.accessionYear===undefined||r.accessionYear>=m)&&!endedBefore(r.id);}).map(h=>h.recipientRulerId));
   if(!occupied.has(recipient.id)&&occupied.size>=(g.rank==='QINWANG'?4:2))throw Error('title capacity');
   if(!Array.isArray(g.meritEventIds)||new Set(g.meritEventIds).size!==g.meritEventIds.length||g.meritEventIds.some(id=>(byId.get(id)?.index??Infinity)>=source.index))throw Error('military source order');
   const merits=royalHonorMerits(recipient,save.registries.militaryCommandRegistry.people,save.registries.militaryCommandRegistry.formations,prior,m,d.factionId);
   if(!['KIN_SENIORITY','MILITARY_MERIT'].includes(g.basis)||g.basis==='MILITARY_MERIT'&&(!g.meritEventIds.length||JSON.stringify(merits)!==JSON.stringify(g.meritEventIds))||g.basis==='KIN_SENIORITY'&&(g.meritEventIds.length>0||merits.length>0))throw Error('grant reason');
  }catch(e){errors.push(`invalid royal honor: ${String(g?.eventId)} (${String(e)})`);}}
 }
 for(const e of events)if(e.type==='royal-honor-granted'&&!seen.has(e.id))errors.push('unbound royal honor event');
 if(!errors.length)errors.push(...validHonorSelections(save));
 return errors;
}

function validHonorSelections(save:WorldSaveV1):string[]{
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i]));
 for(const [index,event] of events.entries())if(event.type==='ruler-deposed'&&typeof event.metadata?.depositionSelection==='string')try{
  const selection=JSON.parse(event.metadata.depositionSelection),d=save.dynasties.find(d=>d.factionId===event.actorFactionId)!,f=save.factions.find(f=>f.factionId===d.factionId)!,month=at(event),prior=events.slice(0,index);
  const epochs=(d.houseEpochs as Dynasty['houseEpochs'])?.map(e=>({...e,endMonth:e.endMonth===month&&!prior.some(p=>p.type==='dynasty-usurped'&&p.actorFactionId===d.factionId&&at(p)===month)?undefined:e.endMonth}));
  const imperial=(f.sovereigntyHistory as Array<{rank:string;startMonth:number}>).filter(h=>h.startMonth<=month&&(h.rank!=='EMPEROR'||prior.some(p=>p.type==='emperor-proclaimed'&&p.actorFactionId===d.factionId&&at(p)<=month))).sort((a,b)=>a.startMonth-b.startMonth).at(-1)?.rank??'KING';
  let hasHonor=false;
  for(const candidate of selection.candidates){
   const r=importRulerSave((d.rulers as RulerSaveV17[]).find(r=>r.rulerId===candidate.rulerId)!);
   r.royalHonors=r.royalHonors?.filter(g=>(positions.get(g.eventId)??Infinity)<index);
   if(r.accessionYear===month)r.accessionYear=undefined;
   if(r.deathMonth===month&&!prior.some(p=>['ruler-died','heir-died'].includes(p.type)&&(p.rulerId===r.id||p.metadata?.rulerId===r.id)))r.deathMonth=undefined;
   const g=effectiveRoyalHonor(r,{houseEpochs:epochs},month,imperial),proof=g?{eventId:g.eventId,rank:g.rank,epochFounderId:g.epochFounderId}:undefined;
   hasHonor||=!!g;
   if(JSON.stringify(proof)!==JSON.stringify(candidate.royalHonor)||g&&candidate.honorAdvantage!==ROYAL_HONOR_ADVANTAGE[g.rank])throw Error('actual prior honor does not match candidate advantage');
  }
  if((selection.version===4)!==hasHonor)throw Error('honor selection version or sources');
 }catch(e){errors.push(`invalid royal honor selection ${event.id}: ${String(e)}`);}
 return errors;
}
