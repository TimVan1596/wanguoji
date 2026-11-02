import type {Ruler} from './Dynasty';
import {hasRecordedRulerDeath} from './RulerLifeState';
import {unresolvedSuccessionAct} from './RoyalSuccessionStanding';
import {getRulerTitleAtMonth,type FactionTitleState} from './RulerTitleRules';
import {getFactionDisplayNameAtMonth} from '../Simulation/FactionIdentity';
/** Only saved names, actual reign and death at the reading month authorize a royal title. */
export function genealogyRulerHeading(r:Ruler,source:Omit<FactionTitleState,'sovereigntyRank'>&{sovereigntyRank?:string},month:number,honor?:{primary?:string}){
 const faction: FactionTitleState={...source,sovereigntyRank:source.sovereigntyRank==='KING'||source.sovereigntyRank==='EMPEROR'||source.sovereigntyRank==='LEADER'?source.sovereigntyRank:undefined};
 const personal=r.houseName.replace(/氏$/,'')+r.givenName;
 if(unresolvedSuccessionAct(r,month))return `${personal} · 承统资格已废`;
 const reigned=r.accessionYear!==undefined&&r.accessionYear<=month&&r.reignOrdinal!==undefined;
 if(!reigned)return honor?.primary??personal;
 const at=Math.min(month,r.endYear??month),country=getFactionDisplayNameAtMonth({...faction,displayName:faction.displayName??faction.name,nameHistory:faction.nameHistory?.map(h=>({...h,reason:h.reason??'historical'}))??[]},at),rank=getRulerTitleAtMonth(faction,at);
 if(hasRecordedRulerDeath(r)&&r.deathMonth!<=month){const epithet=r.posthumousEpithet,style=r.templeName??(epithet?epithet+(/[王帝]$/.test(epithet)||rank==='首领'?'':rank):`故${rank}`);return `${country} · ${style} · ${personal}`;}
 return `${country} · ${r.endYear!==undefined&&r.endYear<=month?'原':''}${country}${rank} · ${personal}`;
}
