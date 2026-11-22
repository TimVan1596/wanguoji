import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import {FamilyTree} from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import {PersonArchiveNavigation,type PersonArchiveTarget} from '../../UI/Components/FactionDetails/PersonArchiveNavigation';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Real DOM interaction over existing production identities. Never creates an official for a family-only member. */
export async function checkFamilyNavigation(core:any,check:(v:unknown,label:string)=>void){
 const month=core.simulator.year,before=exportWorldSave(core),host=document.createElement('div');document.body.append(host);const root=createRoot(host);let tested=0;
 try{for(const f of Military.getFamilies())for(const m of f.members){
  if(tested>=12)break;
  let request:PersonArchiveTarget|undefined,closed=false;
  flushSync(()=>root.render(<Provider store={store}><PersonArchiveNavigation.Provider value={{open:t=>{request=t;},consume:()=>{},consumeGenealogy:()=>{}}}><FamilyTree key={`${f.familyId}/${m.memberId}`} family={f} month={month} initialMemberId={m.memberId} onClose={()=>{closed=true;}} onBack={()=>{}}/></PersonArchiveNavigation.Provider></Provider>));
  const card=host.querySelector(`[data-family-member="${m.memberId}"]`),button=card&&Array.from(card.querySelectorAll('button')).find(b=>b.textContent==='人物档案');if(!button)continue;
  flushSync(()=>button.click());
  const p=m.militaryPersonId&&Military.getPerson(m.militaryPersonId),civil=p?before.registries.civilAdministration.terms.filter(t=>t.personId===p.personId).at(-1):undefined,royal=Dynasty.getAll().flatMap(d=>d.rulers.map(r=>({r,factionId:d.factionId}))).find(({r})=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(r.residentIdentity?.sourceUserId===m.sourceUserId||p&&r.id===p.politicalRulerId));
  if(royal)check(closed&&request?.kind==='RULER'&&request.id===royal.r.id,'actual genealogy click opens the same royal person, including a former officer');
  else if(civil&&(!p||civil.startMonth>=(p.appointments.at(-1)?.startMonth??Infinity)))check(closed&&request?.kind==='CIVIL'&&request.id===civil.personId,'actual genealogy click opens the true civil archive without a fictional military appointment');
  else if(p&&p.appointments.length)check(closed&&request?.kind==='MILITARY'&&request.id===p.personId,'actual genealogy click preserves the real military identity and historical country');
  else check(!closed&&!request&&host.querySelector(`[data-family-member-detail="${m.memberId}"]`),'family-only genealogy click stays in the real family details instead of an empty people tab');
  tested++;
 }}finally{flushSync(()=>root.unmount());host.remove();}
 check(tested>0&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'real React genealogy navigation leaves population, identities, raw history and RNG unchanged');
}
