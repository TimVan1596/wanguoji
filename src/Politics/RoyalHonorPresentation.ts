import {unresolvedSuccessionAct} from './RoyalSuccessionStanding';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty,Ruler} from './Dynasty';
import {ROYAL_HONOR_NAMES,type RoyalHonor} from './RoyalHonors';
/** Read-only event-time honor. Sovereignty, peerage and posthumous names remain separate. */
export function royalHonorHeading(r:Ruler|undefined,d:Pick<Dynasty,'houseEpochs'>|undefined,month:number,options:{local?:boolean;revoked?:(g:RoyalHonor)=>boolean;person?:MilitaryPerson;factionId?:string;epochFounderId?:string;status?:string;statusMonth?:number;before?:(g:RoyalHonor)=>boolean}={}){
 if(!r||!d)return;
 const g=r.royalHonors?.filter(g=>g.month<=month&&g.recipientRulerId===r.id&&(!options.factionId||g.factionId===options.factionId)&&(!options.epochFounderId||g.epochFounderId===options.epochFounderId)&&(!options.before||options.before(g))).sort((a,b)=>a.month-b.month).at(-1);if(!g)return;
 const statusMonth=options.statusMonth??month;
 const disqualified=unresolvedSuccessionAct(r,statusMonth);
 const epoch=d.houseEpochs?.find(e=>e.foundingRulerId===g.epochFounderId),accessed=r.accessionYear!==undefined&&r.accessionYear<=statusMonth;
 const ended=!epoch||epoch.endMonth!==undefined&&epoch.endMonth<=statusMonth||r.displacedByUsurpationMonth!==undefined&&r.displacedByUsurpationMonth<=statusMonth||options.status==='EXTINCT';
 const inactive=options.status!==undefined&&options.status!=='ACTIVE';
 const deceased=r.deathMonth!==undefined&&r.deathMonth<=statusMonth;
 const person=options.person,revoked=g.rank==='ZHENGUOGONG'&&(options.revoked?.(g)||person?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId&&h.month<=month));
 const departed=person?.appointments.some(a=>a.factionId===g.factionId&&a.endReason==='TRANSFERRED'&&a.endMonth!==undefined&&a.endMonth<=statusMonth);
 const text=`${g.countryName} · ${ROYAL_HONOR_NAMES[g.rank]} · ${g.recipientName}`;
 return {grant:g,text,primary:!accessed&&!ended&&!inactive&&!revoked&&!departed&&!disqualified?(options.local?`${ROYAL_HONOR_NAMES[g.rank]} · ${g.recipientName}`:text):undefined,secondary:disqualified?`旧荣衔：${text} · 承统资格已废${revoked?' · 旧爵已追夺':''}`:revoked?`旧荣衔：${text}（旧爵已追夺）`:departed?`旧国荣衔：${text}`:accessed?`登位前：${text}`:ended?`旧朝荣衔：${text}`:inactive?`流亡荣衔：${text}`:deceased?'生前荣衔':undefined};
}
