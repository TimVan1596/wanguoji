import type {WorldEvent} from "../History/WorldHistory";
import type {RulerSaveV17,WorldSaveV1} from "./WorldSaveSchema";
import {importRulerSave} from "./RulerSaveProjection";
import {formatRulerTitleAtMonth,type FactionTitleState} from "../Politics/RulerTitleRules";

/** Legacy events without an issuing-ruler reference remain unattributed; never backfill them. */
export function validateMilitaryOfficeAuthorities(save:WorldSaveV1){
  const errors:string[]=[];
  for(const e of save.worldHistory.events as WorldEvent[]){
    if(e.type!=="military-office-granted"||e.rulerId===undefined&&e.metadata?.authorizingRulerTitle===undefined)continue;
    const month=e.monthIndex??e.year,faction=save.factions.find(f=>f.factionId===e.actorFactionId);
    const dynasty=save.dynasties.find(d=>d.factionId===e.actorFactionId),saved=(dynasty?.rulers as RulerSaveV17[]|undefined)?.find(r=>r.rulerId===e.rulerId);
    const r=saved?importRulerSave(saved):undefined;
    if(!faction||faction.stateFoundedMonth===undefined||faction.stateFoundedMonth>month||!r||r.accessionYear===undefined||r.accessionYear>month||r.endYear!==undefined&&r.endYear<month||r.deathMonth!==undefined&&r.deathMonth<month||
      e.metadata?.authorizingRulerTitle!==formatRulerTitleAtMonth({...faction,name:faction.factionId,nameHistory:faction.nameHistory as FactionTitleState["nameHistory"],sovereigntyHistory:faction.sovereigntyHistory as FactionTitleState["sovereigntyHistory"],sovereigntyRank:faction.sovereigntyRank as FactionTitleState["sovereigntyRank"]},`${r.houseName.replace(/氏$/,"")}${r.givenName}`,month))errors.push(`military office issuing ruler invalid: ${e.id}`);
  }
  return errors;
}
