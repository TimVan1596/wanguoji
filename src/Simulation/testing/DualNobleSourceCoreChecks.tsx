import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {PersonArchiveNavigation,type PersonArchiveTarget} from '../../UI/Components/FactionDetails/PersonArchiveNavigation';
import MilitaryFamilyPanel from '../../UI/Components/FactionDetails/MilitaryFamilyPanel';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** A real inherited BO then earns its own distinct military BO. Neither source is deleted or duplicated. */
export function checkDualNobleSources(core:any,heirId:number,factionId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  const team=core.teams.find((t:any)=>t.name===factionId),heir=team.getUserById(heirId),p=Military.getPerson(heir.militaryPersonId)!,command=p.appointments.at(-1)!.commandId,base=p.appointments.at(-1)!.startMonth;
  const enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE'),towns=team.cities.filter((c:any)=>c!==team.capitalCity&&!c.destroyed).slice(0,2);check(towns.length===2,'independent child military results use two other real cities');
  for(const [i,c]of towns.entries()){const month=base+12*(i+1);clock(month);c.capture(enemy,month);heir.player.setPosition(c.block.x,c.block.y);heir.player.body.reset(heir.player.x,heir.player.y);const unit=core.logicalUnitRegistry.getEntry(heir.player.logicalUnitId)!.state;unit.logicalX=c.block.x;unit.logicalY=c.block.y;c.capture(team,month,undefined,command,p.personId);}
  clock(base+60);Military.updateNobility(base+60,core.teams,Dynasty.getAll());Military.updateFamilies(base+60,core.teams,Dynasty.getAll());
  const own=p.nobilityHistory?.find(g=>g.rank==='BO'),link=Military.getFamilyMember(heir.id,heir.bornMonth)!,inherit=link.family.nobleSuccession?.find(a=>a.holderMemberId===link.member.memberId);
  check(own&&inherit?.rank==='BO'&&own.eventId!==inherit.eventId&&own.captureEventIds.every(id=>History.getRecordedEvents().some(e=>e.id===id&&e.metadata?.commanderPersonId===p.personId)),'inherited BO and personal military BO have different original sources and only the son\'s own actual battle receipts');
  const before=exportWorldSave(core),host=document.createElement('div'),root=createRoot(host);document.body.append(host);let destination:PersonArchiveTarget|undefined;
  try{flushSync(()=>root.render(<Provider store={store}><PersonArchiveNavigation.Provider value={{open:t=>{destination=t;},consume:()=>{},consumeGenealogy:()=>{}}}><MilitaryFamilyPanel personId={p.personId}/></PersonArchiveNavigation.Provider></Provider>));
   check(!host.querySelector('[data-family-person-sources]')&&!host.querySelector('details'),'personal biography does not embed the entire family source archive');
   flushSync(()=>root.render(<Provider store={store}><PersonArchiveNavigation.Provider value={{open:t=>{destination=t;},consume:()=>{},consumeGenealogy:()=>{}}}><MilitaryFamilyBrowser families={[link.family]} worldMonth={base+60} initialFamilyId={link.family.familyId} initialMemberId={link.member.memberId} onClose={()=>{}}/></PersonArchiveNavigation.Provider></Provider>));
   const block=document.querySelector('[data-family-person-sources]')!,parent=link.family.members.find(m=>m.memberId===link.member.parentMemberId)!;
   check(block?.textContent?.includes(parent.name)&&block.textContent.includes('家族承袭')&&block.textContent.includes('本人军功授爵')&&block.textContent.includes('伯爵'),'real military detail shows the recorded father, inheritance date and independently earned same-rank peerage together');
   const parentLink=Array.from(block.querySelectorAll('button')).find(b=>b.textContent===parent.name)!;flushSync(()=>parentLink.click());check(destination?.kind==='FAMILY'&&destination.id===link.family.familyId&&destination.memberId===parent.memberId,'father navigation locates the saved parent member ID in the same family, without name matching');
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'personal genealogy source rendering and parent navigation mutate no title, population, army or RNG');
  }finally{flushSync(()=>root.unmount());host.remove();}
  check(validateWorldSave(exportWorldSave(core)).valid&&Military.getFamilies().filter(f=>f.members.some(m=>m.militaryPersonId===p.personId)).length===1,'one inherited child earning personal BO retains exactly one real parent graph and one hereditary chain');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
