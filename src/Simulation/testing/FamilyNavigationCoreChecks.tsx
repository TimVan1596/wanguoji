import {resolvePersonArchiveTarget} from '../../UI/Components/FactionDetails/PersonArchiveTarget';
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
 const month=core.simulator.year,before=exportWorldSave(core),host=document.createElement('div');document.body.append(host);const root=createRoot(host),categories=new Set<string>();let tested=0;
 try{for(const f of Military.getFamilies())for(const m of f.members){
  const official=m.militaryPersonId?Military.getPerson(m.militaryPersonId):undefined,royalPerson=Dynasty.getAll().flatMap(d=>d.rulers).some(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId||official&&r.id===official.politicalRulerId));
  const role=royalPerson?'ROYAL':before.registries.civilAdministration.terms.some(t=>t.personId===official?.personId)?'CIVIL':official?.appointments.length?'MILITARY':f.nobleSuccession?.some(a=>a.holderMemberId===m.memberId&&a.kind==='SUCCEEDED')?'TITLED_NO_OFFICE':'FAMILY_ONLY';
  const category=[role,(m.deathMonth??official?.deathMonth??Infinity)<=month?'DEAD':'LIVING',m.factionHistory?.some(h=>h.factionId!==f.factionId)?'CROSS_COUNTRY':'ORIGINAL'].join('/');
  if(categories.has(category))continue;
  let request:PersonArchiveTarget|undefined,closed=false;
  flushSync(()=>root.render(<Provider store={store}><PersonArchiveNavigation.Provider value={{open:t=>{request=t;},consume:()=>{},consumeGenealogy:()=>{}}}><FamilyTree key={`${f.familyId}/${m.memberId}`} family={f} month={month} initialMemberId={m.memberId} onClose={()=>{closed=true;}} onBack={()=>{}}/></PersonArchiveNavigation.Provider></Provider>));
  const card=host.querySelector(`[data-family-member="${m.memberId}"]`),button=card&&Array.from(card.querySelectorAll('button')).find(b=>b.textContent==='人物档案');if(!button)continue;
  const action=button.getBoundingClientRect(),frame=button.parentElement!.getBoundingClientRect();check(action.height>0&&action.bottom<=frame.bottom+1,'actual archive action stays within its card for officials and family-only members');
  flushSync(()=>button.click());
  const p=m.militaryPersonId&&Military.getPerson(m.militaryPersonId),civil=p?before.registries.civilAdministration.terms.filter(t=>t.personId===p.personId).at(-1):undefined,royal=Dynasty.getAll().flatMap(d=>d.rulers.map(r=>({r,factionId:d.factionId}))).find(({r})=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId||p&&r.id===p.politicalRulerId));
  if(royal)check(closed&&request?.kind==='RULER'&&request.id===royal.r.id,'actual genealogy click opens the same royal person, including a former officer');
  else if(civil&&(!p||!p.appointments.length||civil.startMonth>=(p.appointments.at(-1)?.startMonth??Infinity)))check(closed&&request?.kind==='CIVIL'&&request.id===civil.personId,'actual genealogy click opens the true civil archive without a fictional military appointment');
  else if(p&&p.appointments.length)check(closed&&request?.kind==='MILITARY'&&request.id===p.personId,'actual genealogy click preserves the real military identity and historical country');
  else check(!closed&&!request&&host.querySelector(`[data-family-member-detail="${m.memberId}"]`),'family-only genealogy click stays in the real family details instead of an empty people tab');
  if(request)check(!!resolvePersonArchiveTarget(request,core.teams,Dynasty.getAll(),Military.getPeople(),Military.getFamilies()),'actual archive request resolves to an existing identity in the destination country');
  categories.add(category);check(true,`real React archive click: ${category}`);tested++;
 }}finally{flushSync(()=>root.unmount());host.remove();}
 check(tested>0&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'real React genealogy navigation leaves population, identities, raw history and RNG unchanged');return [...categories];
}

/** Natural stored people are used without forging a career for UI coverage. */
export async function runFamilyNavigation(seed:string,snapshot:import('../../Persistence/WorldSaveSchema').WorldSaveV1){
 const {createNaturalCore}=await import('./NaturalCoreHarness'),{hydrateWorldSave}=await import('../../Persistence/WorldSaveHydrator'),{core,game}=await createNaturalCore(seed),checks:string[]=[];
 try{core.setWorldRunning(false);game.loop.stop();hydrateWorldSave(core,structuredClone(snapshot));const categories=await checkFamilyNavigation(core,(v,label)=>{if(!v)throw Error(label);checks.push(label);});return {seed,categories,checks};}finally{game.destroy(true);}
}
