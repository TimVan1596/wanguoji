import type {WorldEvent} from "../History/WorldHistory";
import type {RulerSaveV17,WorldSaveV1,FactionSaveV1} from "./WorldSaveSchema";
import {importRulerSave} from "./RulerSaveProjection";
import {formatRulerTitleAtMonth,type FactionTitleState} from "../Politics/RulerTitleRules";
import {getHistoricalFactionIdentity} from "../History/HistoricalFactionIdentity";

const titleState=(f:FactionSaveV1):FactionTitleState=>({...f,name:f.factionId,nameHistory:f.nameHistory as FactionTitleState["nameHistory"],sovereigntyHistory:f.sovereigntyHistory as FactionTitleState["sovereigntyHistory"],sovereigntyRank:f.sovereigntyRank as FactionTitleState["sovereigntyRank"]});
/** Month histories cannot order an earlier grant/battle before a later same-month rename.
 * Frozen snapshots can use the immediately preceding identity only at that recorded boundary. */
const boundaryMonths=(f:FactionSaveV1,month:number)=>[month,...(month>0&&[...f.nameHistory,...(f.sovereigntyHistory as any[]??[])].some(h=>h.startMonth===month)?[month-1]:[])];

/** Existing events without an issuing-ruler reference remain unattributed; never backfill them. */
export function validateMilitaryOfficeAuthorities(save:WorldSaveV1){
  const errors:string[]=[],factions=new Map(save.factions.map(f=>[f.factionId,f])),dynasties=new Map(save.dynasties.map(d=>[d.factionId,d]));
  for(const e of save.worldHistory.events as WorldEvent[]){
    if(e.type!=="military-office-granted"||e.rulerId===undefined&&e.metadata?.authorizingRulerTitle===undefined)continue;
    const month=e.monthIndex??e.year,faction=factions.get(e.actorFactionId??"");
    const dynasty=dynasties.get(e.actorFactionId??""),saved=(dynasty?.rulers as RulerSaveV17[]|undefined)?.find(r=>r.rulerId===e.rulerId);
    const r=saved?importRulerSave(saved):undefined;
    if(!faction||faction.stateFoundedMonth===undefined||faction.stateFoundedMonth>month||!r||r.accessionYear===undefined||r.accessionYear>month||r.endYear!==undefined&&r.endYear<month||r.deathMonth!==undefined&&r.deathMonth<month||
      !boundaryMonths(faction,month).filter(m=>m>=faction.stateFoundedMonth!).some(m=>e.metadata?.authorizingRulerTitle===formatRulerTitleAtMonth(titleState(faction),`${r.houseName.replace(/氏$/,"")}${r.givenName}`,m)))errors.push(`military office issuing ruler invalid: ${e.id}`);
  }
  return errors;
}

export function validateMilitaryBattleNames(save:WorldSaveV1){
  const errors:string[]=[],factions=new Map(save.factions.map(f=>[f.factionId,f]));
  const cities=new Map([...save.cities,...save.registries.archivedCities as any[]].map(c=>[c.cityId??c.id,c]));
  for(const e of save.worldHistory.events as WorldEvent[]){
    if(!["city-captured","city-recovered","capital-fallen"].includes(e.type))continue;
    const month=e.monthIndex??e.year;
    for(const [key,id] of [["attackerNameAtEvent",e.actorFactionId],["defenderNameAtEvent",e.previousOwnerFactionId??e.targetFactionId]] as const){
      const name=e.metadata?.[key];if(name===undefined)continue;
      const f=id?factions.get(id):undefined;
      if(!f||typeof name!=="string"||!name.trim()||!boundaryMonths(f,month).some(m=>getHistoricalFactionIdentity({...f,name:f.factionId,nameHistory:f.nameHistory as any,sovereigntyHistory:f.sovereigntyHistory as any},m).name===name))errors.push(`military battle faction snapshot invalid: ${e.id}`);
    }
    if(e.metadata?.founderCapital!==undefined){
      const city=cities.get(e.cityId),known=city&&Array.isArray(city.history)?city.history.some((h:any)=>h.type==="capital-started"):undefined;
      if(e.type!=="city-recovered"||known===undefined||e.metadata.founderCapital!==(known?1:0))errors.push(`military recovered capital snapshot invalid: ${e.id}`);
    }
  }
  return errors;
}
