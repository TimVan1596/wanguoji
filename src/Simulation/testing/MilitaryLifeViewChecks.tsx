import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import History from '../../History/WorldHistory';
import {groupHistoryNarratives} from '../../History/HistoryNarrativeGrouper';
import Military,{type MilitaryPerson} from '../../Politics/MilitaryCommandRegistry';
import {militaryLifePairs} from '../../Politics/MilitaryLifePresentation';
import {militaryMilestones} from '../../Politics/MilitaryChroniclePresentation';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {EventDetails} from '../../UI/Components/HistoryScroll/HistoryEventDetails';
/** Uses actual already committed award/death transactions; never creates a historical fact. */
export function checkMilitaryLifeView(core:any,person:MilitaryPerson,month:number,kind:'GRANT_APPANAGE'|'DEATH_POSTHUMOUS',check:(v:unknown,s:string)=>void){
 const before=exportWorldSave(core),events=History.getRecordedEvents(),pair=militaryLifePairs(events).find(p=>p.kind===kind&&p.anchor.metadata?.personId===person.personId)!;
 check(pair,`${kind}: actual production transactions have matching permanent identity and source references`);
 const grouped=groupHistoryNarratives(events),display=grouped.find(e=>e.metadata?.sourceEventIds===[pair.anchor.id,pair.other.id].join(','))!;
 check(display?.title===pair.text&&!grouped.some(e=>e.id===pair.anchor.id||e.id===pair.other.id),`${kind}: history scroll has one readable narrative and both source IDs`);
 const chronicle=militaryMilestones(person,Military.getChronicle(person,month),events);
 check(chronicle.some(e=>e.eventId===pair.anchor.id&&e.text===pair.text)&&!chronicle.some(e=>e.eventId===pair.other.id),`${kind}: military archive uses exactly the same merged wording`);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{flushSync(()=>root.render(<Provider store={store}><EventDetails event={display} teamByName={new Map(core.teams.map((t:any)=>[t.name,t]))} factionNames={[]} cityNames={[]}/></Provider>));
  check(host.textContent?.includes(pair.anchor.id)&&host.textContent.includes(pair.other.id)&&host.querySelector('details')?.open===false,`${kind}: real React evidence keeps both independent source records under a closed detail control`);
 }finally{flushSync(()=>root.unmount());host.remove();}
 check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${kind}: both readers preserve canonical facts and RNG`);
}
