import {runMilitaryBalance} from "./MilitaryBalanceHarness";
import Military from "../../Politics/MilitaryCommandRegistry";
import City from "../../Components/City";
import Team from "../../Components/Team";
import Game from "../../Game/Game";
import Diplomacy from "../../Politics/Diplomacy";
import {getVerifiedLocalCasualtyUsers} from "../PopulationCasualtyGeography";
import {siegeParticipants} from "../SiegeParticipants";

/** Read-only instrumentation around actual Core/Phaser City and User transactions.
 * No replacement combat, RNG, UI-derived state, or persisted diagnostic state. */
export async function runSiegeTurnover(seed:string,years=100){
 const capture=City.prototype.capture,revolt=City.prototype.revoltTo,update=City.prototype.updateDefense;
 const siege=(City.prototype as any).updateSiege,casualty=Team.prototype.removeOneUser;
 const transfers:Array<{cityId:string;month:number;kind:string;from:string;to:string;defenseBefore:number;defenseAfter:number}>=[];
 const cities=new Map<string,{id:string;name:string;captureCount:number;devastation:number;maxDevastation:number;defense:number;maxDefense:number;destroyed:boolean}>();
 const episodes:any[]=[],open=new Map<string,any>(),strength:Record<string,number>={};
 let cityMonths=0,devastationSum=0,damage=0,localLoss=0,nationalFallbackLoss=0,noVictim=0;
 let listener:(()=>void)|undefined,scene:Phaser.Scene|undefined;
 const checkpoints:any[]=[];
 let capitalSamples=0,capitalLocalTotal=0,capitalUnassignedTotal=0,emptyCapitalSamples=0,lastStrongholdLosses=0;
 const quantile=(xs:number[],p:number)=>{const a=xs.slice().sort((a,b)=>a-b);return a.length?a[Math.ceil((a.length-1)*p)]:0;};
 const collect=(month:number)=>{
  const counts=[...cities.values()].map(c=>c.captureCount);
  const windows=Object.fromEntries([12,24,60,120].map(window=>{
   const exposed=transfers.filter(t=>t.kind==="CAPTURE"&&t.month<=month-window);
   const repeated=exposed.filter(t=>transfers.some(n=>n.cityId===t.cityId&&n.month>=t.month&&n!==t&&n.month-t.month<=window&&transfers.indexOf(n)>transfers.indexOf(t)));
   return [window,{fullyObservedCaptures:exposed.length,recaptured:repeated.length,ratio:exposed.length?repeated.length/exposed.length:null}];
  }));
  checkpoints.push({month,cityMonths,meanDevastation:cityMonths?devastationSum/cityMonths:0,damage,
   localLoss,nationalFallbackLoss,noEligibleVictim:noVictim,recaptureWindows:windows,
   cumulativeTransfers:{median:quantile(counts,.5),p90:quantile(counts,.9),max:Math.max(0,...counts)},
   capitalDefense:{samples:capitalSamples,meanLocal:capitalSamples?capitalLocalTotal/capitalSamples:0,meanUnassignedLocal:capitalSamples?capitalUnassignedTotal/capitalSamples:0,emptyRatio:capitalSamples?emptyCapitalSamples/capitalSamples:0},lastStrongholdLosses,
   cities:[...cities.values()],completedEpisodes:episodes.filter(e=>e.endMonth<=month),ongoingEpisodes:[...open.values()].map(e=>({...e})),strength:{...strength}});
 };
 const watch=()=>{if(listener||!Game.Core?.scene)return;scene=Game.Core.scene;listener=()=>{const m=Game.Core.simulator!.year;
  const core=Game.Core;for(const team of core.teams){const cap=team.capitalCity;if(team.status!=="ACTIVE"||!cap||cap.destroyed)continue;const locals=siegeParticipants(cap,team,core,Game.BlockSize,false),assigned=new Set(Military.getFormations().filter(f=>f.status==="ACTIVE").flatMap(f=>f.memberUnitIds));capitalSamples++;capitalLocalTotal+=locals.length;capitalUnassignedTotal+=locals.filter(u=>!assigned.has(u.player.logicalUnitId??"")).length;if(!locals.length)emptyCapitalSamples++;}
if(m>0&&(m%1200===0||m===years*12)&&!checkpoints.some(c=>c.month===m))collect(m);};scene.sys.events.on("postupdate",listener);};
 const transfer=(city:City,month:number,kind:string,owner:string,before:number)=>{
  if(city.ownerFactionId!==owner)transfers.push({cityId:city.id,month,kind,from:owner,to:city.ownerFactionId,defenseBefore:before,defenseAfter:city.defense});
 };
 City.prototype.capture=function(...args:Parameters<typeof capture>){const owner=this.ownerFactionId,before=this.defense,last=this.ownerTeam?.cities.length===1;const result=capture.apply(this,args);if(last&&this.ownerFactionId!==owner)lastStrongholdLosses++;transfer(this,args[1],"CAPTURE",owner,before);return result;};
 City.prototype.revoltTo=function(...args:Parameters<typeof revolt>){const owner=this.ownerFactionId,before=this.defense;const result=revolt.apply(this,args);transfer(this,args[1],"REVOLT",owner,before);return result;};
 City.prototype.updateDefense=function(...args:Parameters<typeof update>){watch();const result=update.apply(this,args);cityMonths++;devastationSum+=this.devastation;
  cities.set(this.id,{id:this.id,name:this.name,captureCount:this.captureCount,devastation:this.devastation,maxDevastation:Math.max(cities.get(this.id)?.maxDevastation??0,this.devastation),defense:this.defense,maxDefense:this.maxDefense,destroyed:this.destroyed});return result;};
 (City.prototype as any).updateSiege=function(month:number,...args:unknown[]){
  const owner=this.ownerTeam,rows=[...this.siegeContacts.values()].filter((c:any)=>owner&&month-c.year<=1&&Diplomacy.canAttack(c.team.name,owner.name,month));
  const before=this.defense,oldOwner=this.ownerFactionId;
  if(rows.length&&!open.has(this.id))open.set(this.id,{cityId:this.id,startMonth:month,owner:oldOwner,attacker:rows.slice().sort((a:any,b:any)=>b.count-a.count)[0].team.name});
  for(const c of rows as any[]){const a=siegeParticipants(this,c.team,Game.Core,Game.BlockSize,true).length,d=owner?siegeParticipants(this,owner,Game.Core,Game.BlockSize,false).length:0;const k=`${a}:${d}:${this.defense}:${this.maxDefense}`;strength[k]=(strength[k]??0)+1;}
  const result=siege.call(this,month,...args);damage+=Math.max(0,before-this.defense);
  const e=open.get(this.id);
  if(e&&(this.ownerFactionId!==oldOwner||!this.underSiege||this.destroyed)){
   const reason=this.ownerFactionId!==oldOwner?"CAPTURED":this.destroyed?"DESTROYED":!Diplomacy.canAttack(e.attacker,oldOwner,month)?"DIPLOMACY_OR_POLITICAL_END":"NO_VALID_CONTACT";
   episodes.push({...e,endMonth:month,durationMonths:month-e.startMonth+1,reason});open.delete(this.id);
  }
  return result;
 };
 Team.prototype.removeOneUser=function(...args:Parameters<typeof casualty>){
  const context=args[1],watched=args[0]==="SIEGE_LOSS"&&context?.damageSource==="CITY_SIEGE";
  const local=watched?getVerifiedLocalCasualtyUsers(this,context?.triggerCityId,Game.Core,Game.BlockSize):undefined;
  const user=casualty.apply(this,args);if(watched){if(!user)noVictim++;else if(local!.has(user))localLoss++;else nationalFallbackLoss++;}return user;
 };
 try{
  const balance=await runMilitaryBalance(seed,years);
  return {seed,years,scope:"real Core/Phaser; capture/revolt ownership transactions; right-censored retake windows excluded",balance,transfers,checkpoints};
 }finally{
  City.prototype.capture=capture;City.prototype.revoltTo=revolt;City.prototype.updateDefense=update;(City.prototype as any).updateSiege=siege;Team.prototype.removeOneUser=casualty;
  if(listener)scene?.sys.events.off("postupdate",listener);
 }
}
