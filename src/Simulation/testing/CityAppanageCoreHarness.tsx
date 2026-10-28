import {AppanageCards} from '../../UI/Components/CityDetails/CityAppanages';
import {daliangAppanageFixture} from './CityAppanageViewFixture';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedCityId,setRightPanelTab} from '../../store/rootSlice';
import RightSlider from '../../UI/Components/RightSlider';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import Factions from '../FactionRegistry';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {cityAppanageHistory} from '../../History/CityAppanageHistory';
export async function checkCityAppanageView(core:any,initial:any,id:string,check:(v:unknown,s:string)=>void){
 core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(initial));const p=Military.getPerson(id)!,home=core.teams.find((t:any)=>t.name===p.factionId)!,enemy=core.teams.find((t:any)=>t!==home&&t.status==='ACTIVE')!,clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),update=(m:number)=>Military.updateAppanages(m,core.teams,Dynasty.getAll(),core.allCities);
 const host=document.createElement('div');host.style.cssText='height:800px;width:350px;position:absolute;top:0';document.body.append(host);const root=createRoot(host),tick=()=>new Promise(r=>setTimeout(r,50));
 try{
  clock(216);const site=core.map.blocks.flat().find((b:any)=>!b.city&&core.allCities.every((c:any)=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>160))!;check(site,'real terrain supports a destructible appanage city');site.claimForTeam(enemy);const city=Factions.foundCity(enemy,site,undefined,216)!;
  const body=home.getUserById(p.sourceUserId)!;body.player.setPosition(city.block.x,city.block.y);body.player.body.reset(city.block.x,city.block.y);core.logicalUnitRegistry.getEntry(body.player.logicalUnitId).state.logicalX=city.block.x;core.logicalUnitRegistry.getEntry(body.player.logicalUnitId).state.logicalY=city.block.y;
  city.capture(home,216,undefined,p.appointments[0].commandId,p.personId);
  const oldCities=p.capturedEventIds.map(event=>History.getEvents().find(e=>e.id===event)?.cityId);for(const c of core.allCities.filter((c:any)=>c!==city&&c.ownerTeam===home&&oldCities.includes(c.id)))c.capture(enemy,216);
  Military.updateNobility(216,core.teams,Dynasty.getAll());update(216);check(p.appanageHistory?.[0]?.cityId===city.id,'real sovereign grants the only currently owned merit city, using its true ID');clock(228);Military.updateNobility(228,core.teams,Dynasty.getAll());update(228);exportWorldSave(core);
  const refresh=(m:number)=>flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(m));});
  flushSync(()=>{refresh(228);store.dispatch(setSelectedCityId(city.id));store.dispatch(setRightPanelTab('city'));root.render(<Provider store={store}><RightSlider onReturnToMenu={()=>{}} onSave={async()=>''} onSaveGame={()=>{}} onManageSaves={()=>{}} onSettings={()=>{}} saving={false}/></Provider>);});
  const openTab=()=>{const b=host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]:last-child');if(b?.textContent==='封邑')flushSync(()=>b.click());};
  check(host.querySelector('[role="tabpanel"][aria-label="概况"]'),'city initially presents the compact overview tab');openTab();
  check(host.querySelectorAll('[data-appanage-grant]').length===1&&!host.querySelector('[data-appanage-event]'),'one original grant mounts one compact card with a collapsed timeline');
  check(host.textContent?.includes('授邑1次')&&host.textContent.includes('伯爵')&&!host.textContent.includes('本次并非')&&!host.textContent.includes('不改变城'),'promotion preserves one card, its original baronage and no repetitive audit prose');
  const expand=()=>{const b=host.querySelector<HTMLButtonElement>('[data-appanage-grant] button[aria-expanded="false"]');if(b)flushSync(()=>b.click());};
  const link=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-city-appanages] button')).find(b=>b.textContent===p.personalName)!;flushSync(()=>link.click());await tick();check(store.getState().root.selectedFactionName===home.name&&host.querySelector(`[data-military-person="${id}"] button[aria-expanded="true"]`),'real city-to-person navigation expands the exact military archive');
  const back=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===city.name)!;check(back,'person’s actual food estate has the existing city link');flushSync(()=>back.click());await tick();check(store.getState().root.selectedCityId===city.id&&!!host.querySelector('[role="tab"]'),'person-to-city navigation returns to the same real city');
  openTab();
  clock(229);city.capture(enemy,229);update(229);refresh(229);expand();check(host.textContent?.includes('当前无有效食邑')&&host.textContent.includes('失地'),'real city loss is visible without withdrawing the real title');
  clock(230);city.revoltTo(home,230);update(230);refresh(230);check(host.textContent?.includes('当前有有效食邑')&&host.textContent.includes('恢复'),'actual return restores the original city food estate');
  clock(231);body.destroyUser(false,{cause:'BATTLE_DEATH',month:231,damageSource:'HOSTILE_HOME_OCCUPATION'});update(231);refresh(231);const facts=cityAppanageHistory(city.id,Military.getPeople(),History.getRecordedEvents(),231);check(facts.grants===1&&facts.entries.at(-1)?.rank==='HOU'&&facts.entries.at(-1)?.record.kind==='ENDED','real death ends the estate with the then-current marquis rank, never a second grant');exportWorldSave(core);
  clock(232);city.devastation=100;check(city.destroyPermanently(232),'real eligible city destruction creates the existing archived city');update(232);refresh(232);expand();check(host.textContent?.includes('城市档案：')&&host.textContent.includes('授邑1次')&&host.textContent.includes('侯爵'),'destroyed-city archive retains original food grants, end facts and historical ranks');exportWorldSave(core);
  const other=core.allCities.find((c:any)=>c.id!==city.id)!;flushSync(()=>store.dispatch(setSelectedCityId(other.id)));check(host.querySelector('[role="tabpanel"][aria-label="概况"]')&&!host.querySelector('[data-appanage-grant]'),'changing city clears the prior tab, expanded timeline and selected person');
  // Explicit two-relation historical case, rendered by the same production cards and window.
  const fixture=daliangAppanageFixture(),facts=cityAppanageHistory(fixture.cityId,fixture.people,fixture.events,fixture.month);
  flushSync(()=>root.render(<Provider store={store}><div data-archive-scroll style={{width:330,height:700,overflowY:'auto'}}><AppanageCards cityId={fixture.cityId} month={fixture.month} facts={facts}/></div></Provider>));
  check(host.querySelectorAll('[data-appanage-grant]').length===2&&!host.querySelector('[data-appanage-event]'),'Daliang’s six actual lifecycle records render exactly two grant cards');
  check(host.textContent?.includes('35年1月—43年1月')&&host.textContent.includes('128年1月—139年11月'),'both original grant and actual death-end dates are visible');
  const ying=host.querySelector('[data-appanage-grant="ying-grant"]')!;flushSync(()=>ying.querySelector<HTMLButtonElement>('[aria-expanded]')!.click());check(ying.querySelectorAll('[data-appanage-event]').length===4&&ying.textContent?.includes('138年1月 · 失地')&&ying.textContent.includes('138年12月 · 恢复'),'expanded relation retains the true loss, recovery and end timeline without duplicate cards');
  check(host.scrollWidth<=host.clientWidth,'compact appanage cards fit a 350px host without horizontal overflow');
 }finally{flushSync(()=>root.unmount());host.remove();hydrateWorldSave(core,structuredClone(initial));}
}
