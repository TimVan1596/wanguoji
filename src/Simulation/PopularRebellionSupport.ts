import {getFactionStability} from "../Components/City";
import {calculateImperialStrain} from "./ImperialStrain";
import Game from "../Game/Game";
import type City from "../Components/City";
import type User from "../Components/User";
import Military from "../Politics/MilitaryCommandRegistry";
import {getLocalRestorationArea,isInLocalRestorationArea} from "./LocalRestorationSupport";
import {getLogicalGridCoordinate} from "./LogicalUnitState";
import {REBEL_LOW_LOYALTY_USER_THRESHOLD} from "../config/simulation";

/** Derived willingness, not a rewrite of personal loyalty. No RNG or session state. */
export function localPoliticalPressure(city: City, month: number) {
  const recent = city.lastCapturedYear !== undefined && city.lastCapturedYear <= month && month-city.lastCapturedYear < 24;
  return Math.min(45, Math.max(0,50-city.loyalty)*.8 + Math.max(0,Math.min(100,city.devastation))*.15 + (recent?8:0));
}

export function assessPopularSupport(city: City, month: number) {
  const result={users:[] as User[],validOrdinary:0,identityBlocked:0,outsideArea:0,discontentBlocked:0,pressure:localPoliticalPressure(city,month)};
  const owner=city.ownerTeam,core=Game.Core;
  if(!core?.logicalUnitRegistry || !owner || owner.status!=="ACTIVE" || city.destroyed)return result;
  const area=getLocalRestorationArea(city),seenUnits=new Set<string>(),seenIds=new Set<number>();
  const formations=Military.getFormations().filter(f=>f.status==="ACTIVE");
  const remaining=new Map(formations.map(f=>[f.commandId,Math.max(0,f.memberUnitIds.length-2)]));
  for(const user of [...owner.users].sort((a,b)=>a.loyalty-b.loyalty||a.id-b.id||a.bornMonth-b.bornMonth)){
    const p=user.player,id=p?.logicalUnitId,e=id?core.logicalUnitRegistry.getEntry(id):undefined,s=e?.state;
    const assigned=formations.filter(f=>f.memberUnitIds.includes(id??""));
    if(!id||!s||e?.player!==p||!s.alive||s.unitId!==id||s.userId!==user.id||s.factionId!==owner.name||s.role!=="NORMAL"||s.rulerId||
      user.isDestroyed||user.team!==owner||user.role!=="NORMAL"||user.rulerId||user.militaryPersonId||!Number.isSafeInteger(user.id)||!Number.isSafeInteger(user.bornMonth)||
      p.user!==user||p.team!==owner||p.role!=="NORMAL"||p.rulerId||!p.active||p.parent||p.children?.length||user.slaveGroup?.npcs?.size||user.slaveGroup?.children?.size||
      seenUnits.has(id)||seenIds.has(user.id)||assigned.length>1||assigned.some(f=>f.factionId!==owner.name||!remaining.get(f.commandId))){result.identityBlocked++;continue;}
    seenUnits.add(id);seenIds.add(user.id);result.validOrdinary++;
    if(!Number.isFinite(s.logicalX)||!Number.isFinite(s.logicalY)){result.identityBlocked++;continue;}
    const g=getLogicalGridCoordinate(s.logicalX,s.logicalY,Game.BlockSize),block=core.map?.getBlock(g.gridX,g.gridY);
    if(!block||block.team!==owner||block.city&&block.city!==city||!isInLocalRestorationArea(city,s,area)){result.outsideArea++;continue;}
    if(user.loyalty-result.pressure>=REBEL_LOW_LOYALTY_USER_THRESHOLD){result.discontentBlocked++;continue;}
    result.users.push(user);for(const f of assigned)remaining.set(f.commandId,remaining.get(f.commandId)!-1);
  }
  return result;
}

/** A single collapsed province need not drag the entire country's mean below 55.
 * The exception needs extreme local disaffection plus actual destruction or imperial strain. */
export function hasPopularPoliticalCrisis(city:City,_month:number,totalCells:number){
  const owner=city.ownerTeam;if(!owner||owner.status!=="ACTIVE"||city.destroyed||city.loyalty>26)return false;
  return (getFactionStability(owner)??100)<=55 || city.loyalty<=18 && (city.devastation>=70||calculateImperialStrain(owner,totalCells)>=72);
}
