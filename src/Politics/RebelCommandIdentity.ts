import type {Ruler} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
/** Political command is not a formal military office or a duplicate combat body. */
export function rebelFounderCommand(r:Ruler,f:{name:string;origin?:{foundingRulerId?:string;type:string};stateFoundedMonth?:number},events:readonly WorldEvent[],month:number){
 if(f.origin?.foundingRulerId!==r.id||!['REBEL','FRONTIER','SPLIT'].includes(f.origin.type)||r.accessionYear===undefined||r.accessionYear>month)return;
 const proof=events.find(e=>['rebel-faction-founded','frontier-faction-founded','empire-split'].includes(e.type)&&e.actorFactionId===f.name&&(e.monthIndex??e.year)===r.accessionYear&&(e.rulerId===r.id||e.metadata?.foundingRulerId===r.id));
 return proof?{label:f.stateFoundedMonth!==undefined&&f.stateFoundedMonth<=month?'建势时为起义首领／义军统帅':'起义首领／义军统帅',eventId:proof.id}:undefined;
}
