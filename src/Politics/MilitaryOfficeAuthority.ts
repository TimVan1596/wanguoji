import type {WorldEvent} from "../History/WorldHistory";
import type {Dynasty} from "./Dynasty";
import {formatRulerTitleAtMonth,type FactionTitleState} from "./RulerTitleRules";

/** Called by the simulation event writer, not by the reader or the military registry.
 * Uses existing event rulerId/metadata fields. No new office rule, RNG or personal ceremony is implied. */
export function freezeMilitaryOfficeAuthority(event:WorldEvent,team:(FactionTitleState&{status:string})|undefined,dynasty:Dynasty|undefined):WorldEvent {
  if(event.type!=="military-office-granted"||!team||team.status!=="ACTIVE"||team.identityStage!=="STATE"||!dynasty||dynasty.factionId!==event.actorFactionId||team.name!==event.actorFactionId)return event;
  const month=event.monthIndex??event.year,ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId);
  if(team.stateFoundedMonth===undefined||team.stateFoundedMonth>month)return event;
  if(!ruler||ruler.status!=="ruling"||ruler.accessionYear===undefined||ruler.accessionYear>month||ruler.endYear!==undefined&&ruler.endYear<month||ruler.deathMonth!==undefined&&ruler.deathMonth<=month)return event;
  return {...event,rulerId:ruler.id,metadata:{...event.metadata,authorizingRulerTitle:formatRulerTitleAtMonth(team,`${ruler.houseName.replace(/氏$/,"")}${ruler.givenName}`,month)}};
}
