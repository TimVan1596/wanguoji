import {FAMILY_NOBLE_RANKS,type FamilyNobleRank} from '../../../Politics/FamilyNobleSuccession';
export type PersonThemeKind='PERSONAL'|'INHERITED'|'HISTORICAL'|'REVOKED'|'CIVIL'|'MILITARY'|'ROYAL'|'NEUTRAL';
/** A single semantic palette. History retains rank; source and validity remain explicit text. */
export function personRankTheme(kind:PersonThemeKind,rank?:FamilyNobleRank,officeLevel=0){
 const level=Math.max(0,rank?FAMILY_NOBLE_RANKS.indexOf(rank):0);
 if(kind==='REVOKED')return {borderColor:'#98514e',backgroundColor:'#f8e9e7',color:'#742f2c',borderStyle:'solid'};
 if(['PERSONAL','INHERITED','HISTORICAL'].includes(kind))return {borderColor:['#aa91b9','#9b7cad','#8b659f','#79518e','#673a7e'][level],backgroundColor:(kind==='HISTORICAL'?['#f6f1f8','#eee6f2','#e7dbed','#decfe6','#d4c1df']:['#f1e8f7','#e7d9ef','#dac5e6','#ccb0dc','#bd99d0'])[level],color:'#482b5a',borderStyle:kind==='HISTORICAL'?'dashed':'solid'};
 if(kind==='ROYAL')return {borderColor:'#b29349',backgroundColor:['#fff6dc','#f8e6b4','#eed18c'][Math.min(2,Math.max(0,officeLevel))],color:'#5c451a',borderStyle:'solid'};
 if(kind==='MILITARY')return {borderColor:'#567e9e',backgroundColor:['#eff4fa','#e0ebf5','#cddfed','#b6cfe2'][Math.min(3,Math.max(0,officeLevel))],color:'#2c4c65',borderStyle:'solid'};
 if(kind==='CIVIL')return {borderColor:'#548975',backgroundColor:'#e8f3ed',color:'#315b48',borderStyle:'solid'};
 return {borderColor:'var(--gg-border)',backgroundColor:'var(--gg-panel)',color:'var(--gg-text)',borderStyle:'solid'};
}
