import {evaluatePopularPoliticalCrisis} from './PopularPoliticalCrisis';
import {buildPopularDistricts,emptyPopularSpatialCounts} from "./PopularDistricts";
import {getFactionStability} from "../Components/City";
import {calculateImperialStrain} from "./ImperialStrain";
import Game from "../Game/Game";
import type City from "../Components/City";
import type User from "../Components/User";
import Military from "../Politics/MilitaryCommandRegistry";
import {getLocalRestorationArea,isInLocalRestorationArea} from "./LocalRestorationSupport";
import {getLogicalGridCoordinate} from "./LogicalUnitState";
import {REBEL_LOW_LOYALTY_USER_THRESHOLD,REBEL_LOYALTY_THRESHOLD} from "../config/simulation";

/** Derived willingness, not a rewrite of personal loyalty. No RNG or session state. */
export function localPoliticalPressure(city: City, month: number) {
  const recent = city.lastCapturedYear !== undefined && city.lastCapturedYear <= month && month-city.lastCapturedYear < 24;
  return Math.min(45, Math.max(0,50-city.loyalty)*.8 + Math.max(0,Math.min(100,city.devastation))*.15 + (recent?8:0));
}

export function assessPopularSupport(city: City, month: number) {
  const result={users:[] as User[],validOrdinary:0,identityBlocked:0,outsideArea:0,discontentBlocked:0,pressure:localPoliticalPressure(city,month),spatial:emptyPopularSpatialCounts()};
  const owner=city.ownerTeam,core=Game.Core;
  if(!core?.logicalUnitRegistry || !owner || owner.status!=="ACTIVE" || city.destroyed || !city.block ||
    !Number.isFinite(city.block.x)||!Number.isFinite(city.block.y)||typeof core.map?.getBlock!=="function")return result;
  const idCounts=new Map<number,number>(),unitCounts=new Map<string,number>();
  for(const u of owner.users){idCounts.set(u.id,(idCounts.get(u.id)??0)+1);const id=u.player?.logicalUnitId;if(id)unitCounts.set(id,(unitCounts.get(id)??0)+1);}
  const area=getLocalRestorationArea(city),seenUnits=new Set<string>(),seenIds=new Set<number>();
  const districts=buildPopularDistricts(owner,core.map,Game.BlockSize);
  if(!area.size)result.spatial.emptyLegacyArea++;
  if(![...districts.district.values()].includes(city.id))result.spatial.emptyDistrict++;
  const formations=Military.getFormations().filter(f=>f.status==="ACTIVE");
  const remaining=new Map(formations.map(f=>[f.commandId,Math.max(0,f.memberUnitIds.length-2)]));
  for(const user of [...owner.users].sort((a,b)=>a.loyalty-b.loyalty||a.id-b.id||a.bornMonth-b.bornMonth)){
    const p=user.player,id=p?.logicalUnitId,e=id?core.logicalUnitRegistry.getEntry(id):undefined,s=e?.state;
    const assigned=formations.filter(f=>f.memberUnitIds.includes(id??""));
    const referenceInvalid=!id||!s||e?.player!==p||!s.alive||s.unitId!==id||s.userId!==user.id||s.factionId!==owner.name;
    if(referenceInvalid){result.spatial.referenceMismatch++;
      const x=core.logicalGameplayAuthority?s?.logicalX:p?.x,y=core.logicalGameplayAuthority?s?.logicalY:p?.y;
      if(typeof x==="number"&&typeof y==="number"&&Number.isFinite(x)&&Number.isFinite(y)&&core.map.blocks?.[Math.floor(x/Game.BlockSize)]?.[Math.floor(y/Game.BlockSize)]?.team===owner)result.spatial.referenceWithOwnedPosition++;
    }
    if(!id||idCounts.get(user.id)!==1||unitCounts.get(id)!==1||!s||e?.player!==p||!s.alive||s.unitId!==id||s.userId!==user.id||s.factionId!==owner.name||s.role!=="NORMAL"||s.rulerId||
      user.isDestroyed||user.team!==owner||user.role!=="NORMAL"||user.rulerId||user.militaryPersonId||user.historicalPersonId||!Number.isSafeInteger(user.id)||!Number.isSafeInteger(user.bornMonth)||
      p.user!==user||p.team!==owner||p.role!=="NORMAL"||p.rulerId||!p.active||p.parent||p.children?.length||user.slaveGroup?.npcs?.size||user.slaveGroup?.children?.size||
      seenUnits.has(id)||seenIds.has(user.id)||assigned.length>1||assigned.some(f=>f.factionId!==owner.name||!remaining.get(f.commandId))){result.identityBlocked++;continue;}
    seenUnits.add(id);seenIds.add(user.id);result.validOrdinary++;
    // Registry validates identity in both runtimes, but is spatial authority only in logical mode.
    const x=core.logicalGameplayAuthority?s.logicalX:p.x,y=core.logicalGameplayAuthority?s.logicalY:p.y;
    if(core.logicalGameplayAuthority)result.spatial.logicalPosition++;else{
      result.spatial.arcadePosition++;
      if(Number.isFinite(s.logicalX)&&Number.isFinite(s.logicalY)&&Math.hypot(x-s.logicalX,y-s.logicalY)>Game.BlockSize)result.spatial.staleRegistryPosition++;
    }
    const g=getLogicalGridCoordinate(x,y,Game.BlockSize);
    const block:import("../Components/Block").default|undefined=core.map.blocks?.[g.gridX]?.[g.gridY];
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||!block){result.spatial.invalidPosition++;result.outsideArea++;continue;}
    if(!block.team){result.spatial.unowned++;result.outsideArea++;continue;}
    if(block.team!==owner){result.spatial.foreign++;result.outsideArea++;continue;}
    if(block.city&&block.city!==city&&block.city.ownerFactionId===owner.name){result.spatial.otherCity++;result.outsideArea++;continue;}
    const legacy=isInLocalRestorationArea(city,{...s,logicalX:x,logicalY:y},area);
    if(!legacy)result.spatial.outsideLegacy++;
    const localCity=districts.district.get(`${g.gridX},${g.gridY}`);
    if(!localCity){result.spatial.disconnected++;result.outsideArea++;continue;}
    if(localCity!==city.id){result.spatial.otherDistrict++;result.outsideArea++;continue;}
    if(!legacy)result.spatial.recoveredDistrict++;
    if(user.loyalty-result.pressure>=REBEL_LOW_LOYALTY_USER_THRESHOLD){result.discontentBlocked++;continue;}
    result.users.push(user);for(const f of assigned)remaining.set(f.commandId,remaining.get(f.commandId)!-1);
  }
  return result;
}

export function popularPoliticalCrisis(city:City,month:number,totalCells:number){
 const owner=city.ownerTeam;
 if(!owner||!city.block||owner.status!=="ACTIVE"||city.destroyed)return {eligible:false,reason:"INVALID_CITY"};
 return evaluatePopularPoliticalCrisis({loyalty:city.loyalty,devastation:city.devastation,captureCount:city.captureCount,lastCapturedMonth:city.lastCapturedYear,worldMonth:month,stability:getFactionStability(owner)??100,strain:city.loyalty<=REBEL_LOYALTY_THRESHOLD?calculateImperialStrain(owner,totalCells):0});
}
export function hasPopularPoliticalCrisis(city:City,month:number,totalCells:number){return popularPoliticalCrisis(city,month,totalCells).eligible;}
