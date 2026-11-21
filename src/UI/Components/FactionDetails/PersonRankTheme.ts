import {FAMILY_NOBLE_RANKS,type FamilyNobleRank} from '../../../Politics/FamilyNobleSuccession';
export type PersonThemeKind='PERSONAL'|'INHERITED'|'HISTORICAL'|'REVOKED'|'CIVIL'|'MILITARY'|'ROYAL'|'DEPOSED'|'EXILED'|'NEUTRAL';
/** A single semantic palette. History retains rank; source and validity remain explicit text. */
export function personRankTheme(kind:PersonThemeKind,rank?:FamilyNobleRank,officeLevel=0){
 const level=Math.max(0,rank?FAMILY_NOBLE_RANKS.indexOf(rank):0);
 if(kind==='REVOKED')return {borderColor:'#98514e',backgroundColor:'#f8e9e7',color:'#742f2c',borderStyle:'solid'};
 if(['PERSONAL','INHERITED','HISTORICAL'].includes(kind))return {borderColor:['#ccb5df','#ad80cc','#8f55b5','#65368b','#35154e'][level],backgroundColor:(kind==='HISTORICAL'?['#f5f0f9','#e0cbea','#b79acb','#79618e','#493355']:['#faf5ff','#ead6fb','#c49ce2','#8250b3','#4d2475'])[level],color:level>=3?'#ffffff':'#352040',borderStyle:kind==='HISTORICAL'?'dashed':'solid'};
 if(kind==='DEPOSED')return {borderColor:'#98856b',backgroundColor:'#eee7da',color:'#5c4f3c',borderStyle:'dashed'};
 if(kind==='EXILED')return {borderColor:'#7f8397',backgroundColor:'#ececf3',color:'#4f5267',borderStyle:'dashed'};
 if(kind==='ROYAL')return {borderColor:'#b29349',backgroundColor:['#fffef7','#fffbed','#fff6d7','#fae8b9','#efd183','#dbac39'][Math.min(5,Math.max(0,officeLevel))],color:'#5c451a',borderStyle:'solid'};
 if(kind==='MILITARY')return {borderColor:'#567e9e',backgroundColor:['#edf5ff','#b7d4f3','#5a94ca','#245781'][Math.min(3,Math.max(0,officeLevel))],color:officeLevel>=2?'#ffffff':'#244560',borderStyle:'solid'};
 if(kind==='CIVIL')return {borderColor:'#548975',backgroundColor:['#edf8f2','#badfca','#65aa87','#286447'][Math.min(3,Math.max(0,officeLevel))],color:officeLevel>=2?'#ffffff':'#214f36',borderStyle:'solid'};
 return {borderColor:'var(--gg-border)',backgroundColor:'var(--gg-panel)',color:'var(--gg-text)',borderStyle:'solid'};
}

export interface PersonThemeIdentity {sanction?:boolean;deposed?:boolean;exiled?:boolean;current?:boolean;founder?:boolean;temple?:boolean;monarch?:boolean;firstCandidate?:boolean;candidate?:boolean;noble?:{kind:'PERSONAL'|'INHERITED'|'HISTORICAL'|'REVOKED';rank:FamilyNobleRank};officeKind?:'文官'|'武官';officeLevel?:number;historical?:boolean;}
/** One priority contract for person cards, royal cards and family trees. Bloodline alone is not an office. */
export function personThemeDecision(i:PersonThemeIdentity):{kind:PersonThemeKind;rank?:FamilyNobleRank;level:number}{
 if(i.sanction||i.noble?.kind==='REVOKED')return {kind:'REVOKED',level:0};
 if(i.deposed)return {kind:'DEPOSED',level:0};if(i.exiled)return {kind:'EXILED',level:0};
 if(i.current)return {kind:'ROYAL',level:5};if(i.founder||i.temple)return {kind:'ROYAL',level:4};if(i.monarch)return {kind:'ROYAL',level:3};
 if(i.noble)return {kind:i.noble.kind,rank:i.noble.rank,level:0};
 if(i.officeKind)return {kind:i.officeKind==='文官'?'CIVIL':'MILITARY',level:i.officeLevel??0};
 if(i.firstCandidate)return {kind:'ROYAL',level:2};if(i.candidate)return {kind:'ROYAL',level:1};return {kind:'NEUTRAL',level:0};
}
export function resolvePersonTheme(i:PersonThemeIdentity){const d=personThemeDecision(i);return {...personRankTheme(d.kind,d.rank,d.level),...(i.historical&&['CIVIL','MILITARY'].includes(d.kind)?{borderStyle:'dashed'}:{})};}
export function royalThemeIdentity(r:{id:string;status:string;relationType?:string;reignOrdinal?:number;endReason?:string;templeName?:string;deathMonth?:number},month:number,scope:{currentRulerId?:string|null;designatedHeirId?:string;heirIds?:readonly string[]}){return {current:r.id===scope.currentRulerId&&r.status==='ruling',founder:r.relationType==='FOUNDER',temple:!!r.templeName&&r.deathMonth!==undefined&&r.deathMonth<=month,monarch:r.reignOrdinal!==undefined,deposed:r.status==='deposed'||r.endReason==='被废',exiled:r.status==='exiled',firstCandidate:r.id===scope.designatedHeirId,candidate:scope.heirIds?.includes(r.id)};}
