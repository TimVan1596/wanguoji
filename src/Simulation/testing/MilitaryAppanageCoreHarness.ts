import {checkCityAppanageView} from './CityAppanageCoreHarness';
import {checkMilitaryProjectionCache} from './MilitaryArchiveCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import Dynasty from '../../Politics/Dynasty';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
export async function checkMilitaryAppanages(core:any,original:WorldSaveV1,id:string,check:(v:unknown,s:string)=>void,initial:WorldSaveV1){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),strict=()=>exportWorldSave(core),update=(m:number)=>Military.updateAppanages(m,core.teams,Dynasty.getAll(),core.allCities);
 const restore=(save:WorldSaveV1)=>{core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(save));return Military.getPerson(id)!;};
 await checkCityAppanageView(core,initial,id,check);
 let p=restore(initial);clock(216);Military.updateNobility(216,core.teams,Dynasty.getAll());update(216);const first=p.appanageHistory?.[0];
 for(const m of [228,240]){clock(m);Military.updateNobility(m,core.teams,Dynasty.getAll());update(m);}
 check(first&&p.nobilityHistory?.at(-1)?.rank==='GONG'&&p.appanageHistory?.length===1&&p.appanageHistory[0].cityId===first.cityId,'real baron-to-marquis-to-duke promotions preserve one original appanage without duplicate grants');strict();
 p=restore(original);clock(240);const deniedCountry=core.teams.find((t:any)=>t.name===p.factionId)!,occupier=core.teams.find((t:any)=>t!==deniedCountry&&t.status==='ACTIVE')!;
 for(const c of core.allCities.filter((c:any)=>p.nobilityHistory!.some(g=>g.cityIds.includes(c.id))))if(c.ownerTeam===deniedCountry)c.capture(occupier,240);update(240);
 check(!p.appanageHistory?.length&&p.nobilityHistory?.at(-1)?.rank==='GONG','a real title remains valid when none of its merit cities are currently available as an estate');strict();
 p=restore(original);clock(240);const before=strict(),writer=History.addEvent;
 History.addEvent=function(e){const result=writer.call(this,e);if(e.type==='military-appanage')throw Error('injected estate write failure');return result;};try{update(240);}finally{History.addEvent=writer;}
 check(diffCanonicalWorldSave(before,strict()).matched,'failed real appanage grant restores the entire record and original history');
 const rng=JSON.stringify(random.exportState()),population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),army=JSON.stringify(Military.getFormations());update(240);const g=p.appanageHistory?.[0];
 check(g?.kind==='GRANTED'&&g.personId===p.personId&&p.nobilityHistory?.some(n=>n.eventId===g.nobleGrantEventId),'actual decorated officer receives a distinct formal appanage from a living sovereign');if(!g)throw Error('No estate fixture');
 let city=core.allCities.find((c:any)=>c.id===g.cityId)!;check(city.ownerFactionId===g.factionId&&p.nobilityHistory!.some(n=>n.cityIds.includes(city.id)),'estate is a real currently owned city with this person’s own verified capture');
 check(JSON.stringify(random.exportState())===rng&&population===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&army===JSON.stringify(Military.getFormations()),'appanage changes no population, military units, command, ownership or RNG');
 const granted=strict();await checkMilitaryProjectionCache(core,granted,id,check);p=Military.getPerson(id)!;city=core.allCities.find((c:any)=>c.id===g.cityId)!;update(240);check(diffCanonicalWorldSave(granted,strict()).matched,'same-month settlement cannot duplicate a grant or create a second exclusive estate');
 const ps=Military.getPeople().flatMap(p=>p.appanageHistory?.filter(a=>a.kind==='GRANTED')??[]);check(new Set(ps.map(a=>[a.factionId,a.epochFounderId,a.cityId].join('|'))).size===ps.length,'same royal house cannot assign conflicting exclusive estates');
 for(const field of ['cityId','rulerId','sourceEventId','meritEventId','nobleGrantEventId']){const bad:any=structuredClone(granted),record=bad.registries.militaryCommandRegistry.people.find((x:any)=>x.personId===id).appanageHistory[0];record[field]='fabricated';const e=bad.worldHistory.events.find((e:any)=>e.id===record.eventId);e.metadata.appanage=JSON.stringify(record);check(!validateWorldSave(bad).valid,'strict appanage proof rejects forged '+field);}
 const home=core.teams.find((t:any)=>t.name===g.factionId)!,enemy=core.teams.find((t:any)=>t!==home&&t.status==='ACTIVE')!;
 clock(241);city.capture(enemy,241);update(241);check(p.appanageHistory?.at(-1)?.kind==='LOST'&&p.nobilityHistory?.at(-1)?.rank==='GONG'&&p.status==='ACTIVE','real enemy conquest loses the estate but retains peerage and existing military service');strict();
 clock(242);city.revoltTo(home,242);update(242);check(p.appanageHistory?.at(-1)?.kind==='RESTORED'&&p.appanageHistory.filter(a=>a.kind==='GRANTED').length===1,'actual political reconquest restores the original estate without inventing a new peerage');const restored=strict();
 p=restore(granted);clock(241);Military.endPersonCommands(id,241,'DISMISSED');update(241);check(p.appanageHistory?.at(-1)?.kind==='GRANTED','retirement preserves a personal nominal estate without retaining command');strict();
 p=restore(granted);clock(241);const body=core.teams.find((t:any)=>t.name===p.factionId)!.getUserById(p.sourceUserId)!;body.destroyUser(false,{cause:'BATTLE_DEATH',month:241,damageSource:'HOSTILE_HOME_OCCUPATION'});update(241);check(p.appanageHistory?.at(-1)?.reason==='DEATH','actual military death ends the personal estate without inheritance');strict();
 p=restore(granted);clock(241);const old=core.teams.find((t:any)=>t.name===p.factionId)!,next=core.teams.find((t:any)=>t!==old&&t.status==='ACTIVE')!;old.getUserById(p.sourceUserId)!.setTeam(next,{cause:'LIVE_TRANSFER',month:241});update(241);check(p.appanageHistory?.at(-1)?.reason==='TRANSFER','real transfer ends the old-country estate and cannot relabel it as foreign property');strict();
 p=restore(granted);clock(241);const country=core.teams.find((t:any)=>t.name===g.factionId)!,conqueror=core.teams.find((t:any)=>t!==country&&t.status==='ACTIVE')!;for(const c of [...country.cities] as any[])c.capture(conqueror,241);update(241);check(p.appanageHistory?.at(-1)?.kind==='ENDED','actual loss of the country’s final city ends its former estate');strict();
 restore(restored);const run=()=>{restore(restored);core.setWorldRunning(true);for(let m=0;m<12;m++){for(let i=0;i<30;i++)core.advanceLogicalStep(1000/30);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const a=run(),b=run();check(diffCanonicalWorldSave(a,b).matched,'estate identity and loss/recovery resume twelve real months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'estate lifecycle saves and reads a second time without new grants');restore(original);
}
