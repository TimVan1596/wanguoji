import {Provider} from 'react-redux';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import Factions from '../FactionRegistry';
import {assessMilitarySecession} from '../MilitarySecession';
import {royalExternalKin} from '../../Politics/RoyalExternalKin';
import {rulerFamilyOrigin} from '../../Politics/RulerFamilyOrigin';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import GenealogyBrowser from '../../UI/Components/FactionDetails/GenealogyBrowser';
import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import {PersonArchiveNavigation} from '../../UI/Components/FactionDetails/PersonArchiveNavigation';
import {store} from '../../store';
/** Shen Xiao is a user report without a supplied save. This is a separate controlled real production case. */
export async function checkCrossRoyalKin(core:any,input:ReturnType<typeof exportWorldSave>,familyId:string,childId:number,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.Body.reset(x,y);};
 try{
  hydrateWorldSave(core,structuredClone(input));clock(240);const f=Military.getFamilies().find(f=>f.familyId===familyId)!,old=core.teams.find((t:any)=>t.name===f.factionId),person=Military.getPerson(f.founderPersonId)!,father=old.getUserById(person.sourceUserId),child=old.getUserById(childId),member=f.members.find(m=>m.sourceUserId===childId)!;
  check(child&&member.parentMemberId===f.members[0].memberId&&!child.militaryPersonId,'controlled cross-polity case begins with one actual adult civilian and verified father');
  const city=old.cities.find((c:any)=>!c.isCapital&&!c.isInCaptureGrace(252)),other=old.cities.find((c:any)=>c!==city)!;check(city,'real old-country district exists outside capture grace');
  for(const u of old.users)if(u.role==='NORMAL'&&!u.militaryPersonId&&u!==child)place(u,city.block.x+4,city.block.y+4);
  place(father,city.block.x+4,city.block.y+4);place(child,other.block.x+4,other.block.y+4);child.loyalty=99;
  (Military as any).advanceOffices(240,core.teams);clock(252);(Military as any).advanceOffices(252,core.teams);
  const command=Military.getFormations().find(c=>c.status==='ACTIVE'&&c.commanderPersonId===person.personId)!;check(command.memberUnitIds.length>=2&&!command.memberUnitIds.includes(child.player.logicalUnitId),'real earned promotion recruits actual nearby followers while the distant child stays outside the party');
  for(const c of old.cities)c.loyalty=20;city.loyalty=0;city.devastation=100;
  for(const u of old.users)u.loyalty=99;
  for(const u of old.users)if(command.memberUnitIds.includes(u.player.logicalUnitId)){u.loyalty=20;place(u,city.block.x+4,city.block.y+4);}
  const supporter=[...old.users].find((u:any)=>u!==child&&u.role==='NORMAL'&&!u.militaryPersonId&&!u.historicalPersonId&&!Military.isAssigned(u.player.logicalUnitId)) as any;check(supporter,'actual independent local civilian can support the original split window');supporter.loyalty=0;place(supporter,city.block.x+4,city.block.y+4);
  const party=assessMilitarySecession(city,252);check(party?.evidence.personId===person.personId&&!party.users.includes(child),'actual local military secession evidence excludes the child remaining in another district');
  const count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),founded=Factions.createSplitFaction(old,[city],252,100);check(founded,'original real military split transaction establishes the new polity');if(!founded)throw Error('Cross kin founding failed');
  const dy=Dynasty.get(founded.team.name)!,ruler=Dynasty.getCurrentRuler(founded.team.name)!;
  check(ruler.residentIdentity?.sourceUserId===father.id&&ruler.bornYear===father.bornMonth&&father.team===founded.team&&child.team===old,'father has one continuous identity in the new polity while the actual child stays in the old country');
  check(core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===count&&!dy.rulers.some(r=>r.residentIdentity?.sourceUserId===child.id),'blood relationship creates neither population nor an automatic new royal identity');
  Military.updateHonors(252,core.teams,Dynasty.getAll());Military.updateFamilyTitles(252,core.teams,Dynasty.getAll());
  check(!Military.getPeople().some(p=>p.sourceUserId===child.id&&p.politicalHistory?.some(a=>a.kind==='COURT_BAN')),'father secession is not automatically a personal child ban');
  clock(264);check((Military as any).isEligible(child,264)&&(Military as any).appoint(child,old.name,264,[child.player.logicalUnitId]),'the real adult child passes the existing old-country qualification and enters through the original colonel appointment');
  const childPerson=Military.getPerson(child.militaryPersonId)!;check(childPerson.appointments[0].officeHistory?.[0].office==='XIAOWEI'&&childPerson.sourceUserId===child.id&&childPerson.bornMonth===member.bornMonth,'old-country child gets its own actual colonel career, no copied father rank, captures or army');
  check(!childPerson.nobilityHistory&&!childPerson.politicalHistory?.some(a=>a.kind==='COURT_BAN'),'old-country child neither inherits the forfeited title nor the father’s crime');
  const kin=royalExternalKin(dy,Military.getFamilies(),Military.getPeople(),History.getRecordedEvents(),264),entry=kin.find(k=>k.member.memberId===member.memberId);
  check(entry?.parentId===ruler.id&&entry.person?.personId===childPerson.personId&&entry.factionId===old.name,'cross-view side branch uses the same real father and the actual old-country military child');
  check(rulerFamilyOrigin(ruler,Military.getFamilies(),Military.getPeople(),264)?.member.sourceUserId===father.id,'new royal founder reverses to the same old family member, never by surname');
  const before=exportWorldSave(core),host=document.createElement('div'),root=createRoot(host);document.body.append(host);let destination:any,closed=0;
  const wrap=(node:any)=><Provider store={store}><PersonArchiveNavigation.Provider value={{open:t=>{destination=t;},consume:()=>{},consumeGenealogy:()=>{}}}>{node}</PersonArchiveNavigation.Provider></Provider>;
  try{
   flushSync(()=>root.render(wrap(<GenealogyBrowser open dynasty={dy} team={founded.team} worldMonth={264} targetId={ruler.id} onClose={()=>closed++}/>)));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   let card=document.querySelector<HTMLButtonElement>(`[data-external-family-member="${member.memberId}"] [data-genealogy-card]`);if(!card){flushSync(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='适应窗口')!.click());await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));card=document.querySelector(`[data-external-family-member="${member.memberId}"] [data-genealogy-card]`);}
   check(card&&card.textContent?.includes(child.name)&&card.textContent?.includes('校尉'),'actual shared royal tree renders the verified old-country child with its real military office');flushSync(()=>card!.click());
   check(document.querySelector(`[data-external-person="${member.memberId}"]`)?.textContent?.includes(person.personalName),'side-branch selection shows the actual original father');
   flushSync(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='查看原功臣宗谱并定位')!.click());
   check(closed===1&&destination?.kind==='FAMILY'&&destination.id===f.familyId&&destination.memberId===member.memberId&&destination.factionId===old.name,'cross-tree navigation closes the old modal and targets the exact original family member');
   flushSync(()=>root.render(wrap(<MilitaryFamilyBrowser families={Military.getFamilies()} worldMonth={264} initialFamilyId={f.familyId} initialMemberId={f.members[0].memberId} onClose={()=>closed++}/>)));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const sourceCard=document.querySelector<HTMLButtonElement>(`[data-family-member="${f.members[0].memberId}"] [data-genealogy-card]`)!;check(sourceCard,'original family retains the real founder card after secession');flushSync(()=>sourceCard.click());
   const royalButton=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.includes('王室档案'))!;check(royalButton,'original family card retains the true royal archive navigation');flushSync(()=>royalButton.click());
   check(destination?.kind==='RULER'&&destination.id===ruler.id&&destination.factionId===dy.factionId,'reverse navigation reaches the same new sovereign, not another same-name person');
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'both real React trees and navigation preserve all canonical population, kin, royalty, commands and RNG');
  }finally{flushSync(()=>root.unmount());host.remove();}
  hydrateWorldSave(core,structuredClone(before));check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'cross-polity parent and child survive strict save/read without duplicate royal identity');
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
