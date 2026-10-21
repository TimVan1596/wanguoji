import type {Ruler} from "../../../Politics/Dynasty";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {getFactionColorAtMonth,type FactionColorHistoryEntry} from "../../../Simulation/FactionColorHistory";
import type {SovereigntyHistoryEntry} from "../../../Simulation/FactionIdentity";
import {hasRecordedRulerDeath} from "../../../Politics/RulerLifeState";
export type PortraitRole="LEADER"|"KING"|"EMPEROR"|"PIJIANG"|"JIANGJUN"|"SHANGJIANGJUN"|"UNKNOWN";
interface PortraitFaction {color:number;colorHistory?:FactionColorHistoryEntry[];sovereigntyHistory?:SovereigntyHistoryEntry[];identityStage?:string;stateFoundedMonth?:number;sovereigntyRank?:string;}
/** Ended offices use their final pre-transition month, not the succeeding dynasty's colors. */
export function royalPortraitContext(ruler:Pick<Ruler,"accessionYear"|"endYear"|"deathMonth"|"deathReason"|"bornYear">,faction:PortraitFaction,worldMonth:number){
 const month=ruler.endYear===undefined?worldMonth:Math.max(ruler.accessionYear??0,ruler.endYear-1);
 const recorded=faction.sovereigntyHistory?.find(e=>e.startMonth<=month&&(e.endMonth===undefined||e.endMonth>=month));
 const role:PortraitRole=recorded?.rank??(faction.stateFoundedMonth!==undefined&&month<faction.stateFoundedMonth?"LEADER":faction.identityStage==="STATE"?"KING":"LEADER");
 return {role,color:getFactionColorAtMonth(faction,month),deceased:hasRecordedRulerDeath(ruler),month};
}
/** A foreign/retired person's portrait represents the viewed country's last actual service, not later foreign rank. */
export function militaryPortraitContext(person:MilitaryPerson,factionId:string,faction:PortraitFaction|undefined,worldMonth:number){
 const appointment=person.appointments.filter(a=>a.factionId===factionId).at(-1);
 const month=Math.min(worldMonth,person.deathMonth??worldMonth,appointment?.endMonth===undefined?worldMonth:Math.max(appointment.startMonth,appointment.endMonth-1));
 const office=appointment?.officeHistory?.filter(g=>g.month<=month).at(-1)?.office;
 const role:PortraitRole=office??"UNKNOWN";
 return {role,color:faction?getFactionColorAtMonth(faction,month):undefined,deceased:person.status==="DEAD"&&person.deathMonth!==undefined,month,
  historical:appointment?.endMonth!==undefined||person.factionId!==factionId};
}
