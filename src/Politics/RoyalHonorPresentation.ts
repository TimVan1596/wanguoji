import type {Dynasty,Ruler} from './Dynasty';
import {ROYAL_HONOR_NAMES,type RoyalHonor} from './RoyalHonors';
/** Read-only event-time honor. Sovereignty, peerage and posthumous names remain separate. */
export function royalHonorHeading(r:Ruler|undefined,d:Pick<Dynasty,'houseEpochs'>|undefined,month:number,options:{factionId?:string;epochFounderId?:string;status?:string;statusMonth?:number;before?:(g:RoyalHonor)=>boolean}={}){
 if(!r||!d)return;
 const g=r.royalHonors?.filter(g=>g.month<=month&&g.recipientRulerId===r.id&&(!options.factionId||g.factionId===options.factionId)&&(!options.epochFounderId||g.epochFounderId===options.epochFounderId)&&(!options.before||options.before(g))).at(-1);if(!g)return;
 const statusMonth=options.statusMonth??month;
 const epoch=d.houseEpochs?.find(e=>e.foundingRulerId===g.epochFounderId),accessed=r.accessionYear!==undefined&&r.accessionYear<=statusMonth;
 const ended=!epoch||epoch.endMonth!==undefined&&epoch.endMonth<=statusMonth||r.displacedByUsurpationMonth!==undefined&&r.displacedByUsurpationMonth<=statusMonth||options.status==='EXTINCT';
 const deceased=r.deathMonth!==undefined&&r.deathMonth<=statusMonth;
 const text=`${g.countryName} · ${ROYAL_HONOR_NAMES[g.rank]} · ${g.recipientName}`;
 return {grant:g,text,primary:!accessed&&!ended?text:undefined,secondary:accessed?`登位前：${text}`:ended?`旧朝荣衔：${text}`:deceased?'生前荣衔':undefined};
}
