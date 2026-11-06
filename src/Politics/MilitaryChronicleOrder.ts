import type {MilitaryChronicleEntry} from './MilitaryChronicle';
import type {WorldEvent} from '../History/WorldHistory';
/** Reading only. Promotion evidence keeps its existing authoritative selection rules.
 * Missing sources retain input order; IDs are identities, never same-month clocks. */
export function militaryChronicleReadingOrder(entries:readonly MilitaryChronicleEntry[],events:readonly WorldEvent[]){
 const positions=new Map(events.map((e,i)=>[e.id,i]));
 return entries.map((entry,i)=>({entry,i,order:positions.get(entry.eventId)})).sort((a,b)=>a.entry.worldMonth-b.entry.worldMonth||(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||a.i-b.i).map(r=>r.entry);
}
