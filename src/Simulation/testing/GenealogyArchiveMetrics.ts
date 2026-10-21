import Dynasty from "../../Politics/Dynasty";
import Military from "../../Politics/MilitaryCommandRegistry";
import History from "../../History/WorldHistory";
import {buildRoyalArchiveGenealogy,royalMilitaryArchive} from "../../Politics/RoyalArchiveIdentity";
import {indexGenealogy} from "../../UI/Components/FactionDetails/genealogyWindow";
/** Read-only observers of the real production registries. */
export function genealogyArchiveMetrics(){
 const people=Military.getPeople(),events=History.getEvents();let expected=0,included=0,birthConflicts=0,duplicates=0,nodes=0;
 for(const d of Dynasty.getAll()){
  const royals=royalMilitaryArchive(d,people,events),tree=buildRoyalArchiveGenealogy(d,people,events),index=indexGenealogy(tree);nodes+=index.size;expected+=royals.size;
  const seen=new Set<string>(),stack=[...tree];while(stack.length){const n=stack.pop()!;if(seen.has(n.ruler.id)){duplicates++;continue;}seen.add(n.ruler.id);stack.push(...n.children);}
  for(const [id,p]of royals){if(index.has(id))included++;if(index.get(id)?.ruler.bornYear!==p.bornMonth)birthConflicts++;}
 }
 const shortAppointments=people.flatMap(p=>p.appointments.filter(a=>a.endMonth===a.startMonth).map(a=>{
  const ends=events.filter(e=>e.type==="military-command-ended"&&e.metadata?.commandId===a.commandId);
  const ruler=Dynasty.getAll().flatMap(d=>d.rulers).find(r=>r.id===p.politicalRulerId);
  return {personId:p.personId,commandId:a.commandId,month:a.startMonth,reason:a.endReason,deathCause:p.deathMonth===a.endMonth?p.deathCause:undefined,accession:ruler?.accessionYear===a.endMonth,endEvents:ends.length};
 }));
 if(expected!==included||birthConflicts||duplicates)throw Error("Royal genealogy identity or inclusion mismatch");
 return {nodes,royalMilitaryExpected:expected,royalMilitaryIncluded:included,birthConflicts,duplicateNodes:duplicates,shortAppointments};
}
