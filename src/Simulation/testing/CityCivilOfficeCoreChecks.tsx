import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setPersonArchiveRequest,setSelectedCityId,setTeams,setWorldYear} from '../../store/rootSlice';
import Civil from '../../Politics/CivilAdministration';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import {isLocalCivilOffice} from '../../Politics/CivilOffice';
import CityDetails from '../../UI/Components/CityDetails';
import ArchivedCities from '../ArchivedCities';
import CityCivilOffices from '../../UI/Components/CityDetails/CityCivilOffices';
import {resolvePersonArchiveTarget} from '../../UI/Components/FactionDetails/PersonArchiveTarget';
import type Core from '../../Game/Core';

export function checkCityCivilOffices(core:Core,check:(ok:unknown,label:string)=>void){
 const terms=Civil.getTerms().filter(t=>t.cityId&&isLocalCivilOffice(t.office));
 const ids=[...new Set(terms.map(t=>t.cityId!))];
 const cityId=ids.sort((a,b)=>terms.filter(t=>t.cityId===b).length-terms.filter(t=>t.cityId===a).length)[0];
 const all=terms.filter(t=>t.cityId===cityId),month=core.simulator!.year,host=document.createElement('div');
 host.setAttribute('data-archive-scroll','');host.style.cssText='height:500px;overflow:auto';
 document.body.append(host);
 const root=createRoot(host),render=(id:string)=>flushSync(()=>root.render(<Provider store={store}><CityCivilOffices key={id} cityId={id} month={month}/></Provider>));
 const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(label));
 try{
  render('no-formal-office');
  check(host.textContent?.includes('尚无正式地方官任命记录'),'empty city gives a truthful empty state');
  const openedAt=performance.now();
  render(cityId);
  const collapsedMs=performance.now()-openedAt;
  check(all.length&&host.textContent?.includes(`${all.length}任 · ${new Set(all.map(t=>t.personId)).size}人`),'actual city archive distinguishes assignments from people');
  check(!host.querySelector('article'),'closed city archive does not mount any appointment cards');
  const expandedAt=performance.now();
  flushSync(()=>button('历任地方官')!.click());
  const expandedMs=performance.now()-expandedAt;
  const cards=Array.from(host.querySelectorAll<HTMLElement>('[data-civil-assignment]'));
  check(cards.length>0&&cards.length<=24,'actual city archive window bounds the historical cards');
  const card=cards[0],term=all.find(t=>t.assignmentId===card.dataset.civilAssignment)!;
  check(card.textContent?.includes(term.countryName)&&card.textContent.includes(term.rulerTitle),'original appointment country and ruler appear on the card');
  flushSync(()=>card.querySelectorAll('button')[1].click());
  check(card.textContent?.includes(term.personalName)&&card.textContent.includes('任期史事'),'true assignment source expands in place');
  flushSync(()=>card.querySelector('button')!.click());
  const request=store.getState().root.personArchiveRequest;
  check(request&&(request.kind==='RULER'||request.id===term.personId)&&resolvePersonArchiveTarget(request,core.teams,Dynasty.getAll(),Military.getPeople(),Military.getFamilies()),'city official link resolves to a real person archive');
  // Exercise windowing with repeated presentation fixtures without mutating Core.
  const getByCity=Civil.getByCity;
  try{
   Civil.getByCity=(id)=>id==='long-list'?Array.from({length:1100},(_,i)=>({...term,cityId:id,assignmentId:`presentation-${i}` })):getByCity.call(Civil,id);
   render('long-list');
   flushSync(()=>button('历任地方官')!.click());
   check(host.querySelectorAll('[data-civil-assignment]').length<=24&&host.textContent?.includes('1100任 · 1人'),'large projected archive mounts a bounded number of cards');
  }finally{Civil.getByCity=getByCity;}
  const activeCityId=core.teams.flatMap(t=>t.cities).find(c=>ids.includes(c.id))?.id;
  const showCity=(id:string)=>flushSync(()=>{
   store.dispatch(setTeams([...core.teams]));
   store.dispatch(setWorldYear(month));
   store.dispatch(setSelectedCityId(id));
   root.render(<Provider store={store}><CityDetails/></Provider>);
  });
  let cityProfileMs:number|undefined;
  if(activeCityId){
   const profileAt=performance.now();
   showCity(activeCityId);
   cityProfileMs=performance.now()-profileAt;
   check(host.querySelector('[data-city-profile]')&&button('历任地方官'),'actual city overview embeds the official archive');
  }
  const archived=ids.find(id=>ArchivedCities.get(id));
  if(archived){
   showCity(archived);
   check(host.textContent?.includes('已毁灭')&&button('历任地方官'),'destroyed city address opens its actual historical local offices');
   flushSync(()=>button('历任地方官')!.click());
   check(host.querySelector('[data-civil-assignment]'),'destroyed city keeps real past appointments');
  }
  return {cityId,collapsedMs,expandedMs,cityProfileMs,assignments:all.length,mounted:cards.length,formerCountries:new Set(all.map(t=>t.factionId)).size,people:new Set(all.map(t=>t.personId)).size,archived:archived??null};
 }finally{flushSync(()=>root.unmount());host.remove();store.dispatch(setPersonArchiveRequest(undefined));store.dispatch(setSelectedCityId(undefined));}
}
