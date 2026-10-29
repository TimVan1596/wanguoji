import type {WorldEvent} from '../History/WorldHistory';
const TYPES=new Set(['military-ennobled','military-appanage','military-title-revoked','military-posthumous']);
export const isRulerHonorEvent=(e:WorldEvent)=>TYPES.has(e.type);
/** Issuer evidence is written by the original transaction. A recipient's accession cannot transfer authorship. */
export function rulerHonorEvidence(e:WorldEvent,rulerId:string,factionId:string){
 if(!isRulerHonorEvent(e)||e.actorFactionId!==factionId||e.rulerId!==rulerId)return;
 try{
  const raw=e.type==='military-ennobled'?e.metadata?.nobility:e.type==='military-appanage'?e.metadata?.appanage:e.metadata?.honor;
  const p=typeof raw==='string'?JSON.parse(raw):undefined;
  if(!p||p.eventId!==e.id||p.rulerId!==rulerId||p.factionId!==factionId||p.month!==(e.monthIndex??e.year)||!p.rulerTitle||!p.personalName||p.personId!==e.metadata?.personId)return;
  if(e.type==='military-appanage'&&p.kind!=='GRANTED')return;
  if(!['BO','HOU','GONG'].includes(p.rank))return;
  return p as {rank:'BO'|'HOU'|'GONG';rulerId:string;personalName:string};
 }catch{return;}
}
