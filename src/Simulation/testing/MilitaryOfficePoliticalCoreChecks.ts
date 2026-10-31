import {checkMilitaryUsurper} from "./MilitaryUsurperCoreChecks";
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {getOfficePromotion} from '../../Politics/MilitaryOffice';
import {evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
/** Same genuine army/court snapshot: office selects the participant, never a new coup lottery or monarch. */
export function checkOfficePoliticalChoice(core:any,base:ReturnType<typeof exportWorldSave>,ids:string[],factionId:string,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(base));const t=core.teams.find((t:any)=>t.name===factionId)!,q=Military.getPerson(ids[1])!,a=q.appointments[0];
  const promote=(m:number)=>{clock(m);const g=getOfficePromotion(a,Military.getChronicle(q,m,factionId),m);check(g,'real office promotion has its original service and unused military evidence');if(!g)throw Error('No lawful promotion');(Military as any).grantOffice(q,a,g);};
  promote(216);promote(240);
  const enemy=core.teams.find((x:any)=>x!==t&&x.status==='ACTIVE')!,body=t.getUserById(q.sourceUserId)!,towns=t.cities.filter((c:any)=>!c.isCapital).slice(0,2);
  for(const [i,c] of towns.entries()){const m=252+i*12;clock(m);c.capture(enemy,m);body.player.setPosition(c.block.x,c.block.y);body.player.body.reset(c.block.x,c.block.y);const s=core.logicalUnitRegistry.getEntry(body.player.logicalUnitId).state;s.logicalX=c.block.x;s.logicalY=c.block.y;c.capture(t,m,undefined,a.commandId,q.personId);}
  promote(276);check(a.officeHistory?.at(-1)?.office==='SHANGJIANGJUN','real second commander reaches marshal through production promotion, without changing promotion rules');
  checkMilitaryUsurper(core,exportWorldSave(core),factionId,q.personId,check);
  const modern=Military.getPoliticalInfluence(t,276,core.logicalUnitRegistry),plain=Military.getPoliticalInfluence(t,276,core.logicalUnitRegistry,false,false);
  check(modern.candidates[0]?.personId===ids[1]&&plain.candidates[0]?.personId===ids[0],'verified marshal outranks the colonel among equal base strengths, before any noble award');
  check(modern.candidates.every(c=>c.strength===plain.candidates.find(p=>p.personId===c.personId)!.strength),'office standing does not change military eligibility or the crisis-risk strength');
  t.capitalCity.capture(enemy,276);for(const c of t.cities)c.loyalty=20;const crisis=exportWorldSave(core),results:any[]=[];
  for(const enabled of [false,true]){
   hydrateWorldSave(core,structuredClone(crisis));const team=core.teams.find((x:any)=>x.name===factionId),dy=Dynasty.get(factionId)!,r=Dynasty.getCurrentRuler(factionId)!,get=Military.getPoliticalInfluence,next=random.next;let calls=0;
   if(!enabled)Military.getPoliticalInfluence=function(...args){return get.call(this,args[0],args[1],args[2],false,false);};
   const e=evaluateDepositionOpportunity({factionId,status:team.status,identityStage:team.identityStage,cityCount:team.cities.length,stability:getFactionStability(team),currentRuler:r,rulers:dy.rulers,houseName:dy.houseName,worldMonth:276,events:History.getEvents(),military:Military.getPoliticalInfluence(team,276,core.logicalUnitRegistry)});check(e.eligible&&e.militaryParticipant,'existing capital-loss crisis admits the same legitimate military-backed court opportunity');
   random.next=function(){const draw=next.call(random);return calls++===0?e.probability*.75:draw;};
   try{(Dynasty as any).evaluateInReignDeposition(team,dy,r,276);}finally{random.next=next;Military.getPoliticalInfluence=get;}
   const event=History.getEvents().find(e=>e.type==='ruler-deposed'&&e.year===276)!,proof=JSON.parse(String(event?.metadata?.militaryParticipation));check(proof?.participant.personId===ids[enabled?1:0],'real court transaction records the selected officer, independently of its legal royal successor');
   const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'actual selected office policy survives strict save validation');
   if(enabled){check(proof.version===3&&proof.participant.officeStanding.office==='SHANGJIANGJUN','versioned political evidence freezes the actual marshal office and its source event');for(const field of ['office','eventId','appointmentEventId']){const bad=structuredClone(saved),row=(bad.worldHistory.events as import("../../History/WorldHistory").WorldEvent[]).find(e=>e.id===event.id)!,p=JSON.parse(String(row.metadata!.militaryParticipation));p.participant.officeStanding[field]='forged';row.metadata!.militaryParticipation=JSON.stringify(p);check(!validateWorldSave(bad).valid,'strict save rejects forged selected office or appointment provenance');}}
   results.push({calls,probability:e.probability,rng:random.exportState(),king:dy.currentRulerId});
  }
  check(JSON.stringify(results[0])===JSON.stringify(results[1]),'office changes the actual military participant with identical success probability, RNG draws and royal successor');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
