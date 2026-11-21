import {FAMILY_NOBLE_RANKS,type FamilyNobleRank} from '../../../Politics/FamilyNobleSuccession';
/** Shared by royal and contributor genealogies. Text labels remain authoritative. */
export function personRankTheme(kind:'PERSONAL'|'INHERITED'|'HISTORICAL'|'REVOKED'|'CIVIL'|'MILITARY'|'NEUTRAL',rank?:FamilyNobleRank){
 const level=rank?FAMILY_NOBLE_RANKS.indexOf(rank):0;
 if(kind==='REVOKED')return {borderColor:'#985f59',backgroundColor:'#f7eeee',color:'#753c36',borderStyle:'solid'};
 if(kind==='PERSONAL')return {borderColor:'#52768f',backgroundColor:['#f0f5f9','#e5eef6','#d8e6f2','#c9dcec','#b8d0e4'][level],color:'#243e53',borderStyle:'solid'};
 if(kind==='INHERITED')return {borderColor:'#60866b',backgroundColor:['#f1f7f1','#e6f1e6','#d9e9db','#c9dfcd','#b8d2bd'][level],color:'#294b34',borderStyle:'solid'};
 if(kind==='HISTORICAL')return {borderColor:'#a1a7ac',backgroundColor:'var(--gg-panel)',color:'var(--gg-text-muted)',borderStyle:'dashed'};
 if(kind==='CIVIL')return {borderColor:'#538e7b',backgroundColor:'#edf5f2',color:'#305e50',borderStyle:'solid'};
 if(kind==='MILITARY')return {borderColor:'#638596',backgroundColor:'#eff4f6',color:'#3b5f70',borderStyle:'solid'};
 return {borderColor:'var(--gg-border)',backgroundColor:'var(--gg-panel)',color:'var(--gg-text)',borderStyle:'solid'};
}
