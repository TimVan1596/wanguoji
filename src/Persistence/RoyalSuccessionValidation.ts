import type {WorldEvent} from '../History/WorldHistory';
import type {RulerSaveV17} from './WorldSaveSchema';
import type {WorldSaveV1} from './WorldSaveSchema';
import {maySucceed} from '../Politics/RoyalSuccessionStanding';
import {importRulerSave} from './RulerSaveProjection';
export function validateRoyalSuccessionStanding(save:WorldSaveV1){
 const errors:string[]=[],used=new Set<string>(),events=save.worldHistory.events as WorldEvent[];
 for(const dy of save.dynasties)for(const data of dy.rulers as RulerSaveV17[]){
  const r=importRulerSave(data);
  if(r.successionHistory!==undefined&&!Array.isArray(r.successionHistory)){errors.push('invalid royal succession history');continue;}
  let last=-1;
  for(const a of r.successionHistory??[])try{
   const event=events.find(e=>e.id===a.eventId),source=events.find(e=>e.id===a.sourceEventId),attempt=events.find(e=>e.id===a.courtCoupEventId),p=save.registries.militaryCommandRegistry.people.find(p=>p.personId===a.militaryPersonId),issuer=(dy.rulers as RulerSaveV17[]).find(x=>x.rulerId===a.issuerRulerId);
   const record=JSON.parse(String(attempt?.metadata?.courtCoup));
   if(!(dy.houseEpochs as import('../Politics/DynasticRevolution').DynastyHouseEpoch[]|undefined)?.some(ep=>ep.foundingRulerId===a.epochFounderId&&ep.startMonth<=a.month&&(ep.endMonth??Infinity)>=a.month)||!Number.isSafeInteger(a.month)||a.month<last||a.month>save.world.worldMonth||used.has(a.eventId)||a.factionId!==dy.factionId||a.rulerId!==r.id||!issuer||issuer.accessionMonth===undefined||issuer.accessionMonth>a.month||(issuer.endMonth??Infinity)<a.month||(issuer.deathMonth??Infinity)<=a.month||!event||event.type!=='royal-succession-sanction'||event.actorFactionId!==dy.factionId||event.rulerId!==r.id||(event.monthIndex??event.year)!==a.month||event.metadata?.royalSuccessionAct!==JSON.stringify(a)||!p||p.royalIdentity?.rulerId!==r.id||r.militaryIdentity?.personId!==p.personId||!attempt||record.target.basis!=='SELF'||record.actorRulerId!==r.id||record.targetRulerId!==r.id||record.participant.personId!==p.personId||record.outcome!=='FAILED')throw Error('identity or authority');
   if(a.kind==='DISQUALIFIED'){
    if(a.issuerRulerId!==record.previousRulerId||a.month!==record.month||source?.type!=='court-coup-result'||source.id!==record.outcomeEventId||source.metadata?.outcome!=='FAILED'||!p.politicalHistory?.some(b=>b.kind==='COURT_BAN'&&b.courtCoupEventId===attempt.id)||a.restoresEventId)throw Error('unproven self coup sanction');
   }else if(a.kind==='RESTORED'){
    const ban=r.successionHistory?.find(b=>b.eventId===a.restoresEventId&&b.kind==='DISQUALIFIED');
    const authority=events.find(e=>e.id===a.authorityEventId),victimEnd=events.find(e=>e.id===a.victimEndEventId),victim=ban&&(dy.rulers as RulerSaveV17[]).find(r=>r.rulerId===ban.issuerRulerId);
    if(!authority||!['ruler-succession','ruler-deposed'].includes(authority.type)||(authority.rulerId!==a.issuerRulerId&&authority.metadata?.nextRulerId!==a.issuerRulerId)||!victim||!victimEnd||(victimEnd.monthIndex??victimEnd.year)>a.month||!(victimEnd.type==='ruler-deposed'&&victimEnd.metadata?.previousRulerId===victim.rulerId||victimEnd.type==='ruler-died'&&(victimEnd.rulerId===victim.rulerId||victimEnd.metadata?.rulerId===victim.rulerId))||!ban||ban.month+60>a.month||a.sourceEventId!==ban.eventId||r.successionHistory!.some(b=>b!==a&&b.kind==='RESTORED'&&b.restoresEventId===ban.eventId)||a.issuerRulerId===r.id)throw Error('unproven restoration');
   }else throw Error('unknown royal act');
   used.add(a.eventId);last=a.month;
  }catch(error){errors.push(`invalid royal succession act ${a?.eventId}: ${String(error)}`);}
  if(!maySucceed(r,save.world.worldMonth)&&((dy.heirIds as string[]).includes(r.id)||dy.designatedHeirId===r.id||dy.currentRulerId===r.id))errors.push('disqualified royal retains succession office');
  if(r.accessionYear!==undefined&&!maySucceed(r,r.accessionYear))errors.push('disqualified royal acceded without restoration');
 }
 for(const dy of save.dynasties)if(dy.successionVacancyMonth!==undefined){
  const month=dy.successionVacancyMonth as number,rulers=(dy.rulers as RulerSaveV17[]).map(importRulerSave),faction=save.factions.find(f=>f.factionId===dy.factionId);
  if(!Number.isSafeInteger(month)||month<0||month>save.world.worldMonth||dy.currentRulerId!=null||(dy.heirIds as string[]).length||!['EXILED','EXTINCT'].includes(faction?.status??'')||!rulers.some(r=>r.houseName===dy.houseName&&!maySucceed(r,month)&&(r.deathMonth??Infinity)>month&&(r.naturalDeathYear??Infinity)>month)||!rulers.some(r=>r.deathMonth===month&&r.accessionYear!==undefined))errors.push('invalid royal succession vacancy');
 }
 for(const e of events)if(e.type==='royal-succession-sanction'&&!used.has(e.id))errors.push('unbound royal succession event');
 return errors;
}
