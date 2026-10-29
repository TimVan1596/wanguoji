import type {WorldEvent} from '../History/WorldHistory';
/** Only the sequence suffix written by WorldHistory's known writers proves intra-month order.
 * Arbitrary IDs, array sorting, and a later military identity never prove a reign boundary. */
function sequence(e:WorldEvent){
 if(!['city-captured','city-recovered','capital-fallen','ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','ruler-died','ruler-captured'].includes(e.type)||!e.id.startsWith(e.type+'-'))return;
 const n=e.id.match(/-(\d+)$/)?.[1];return n===undefined?undefined:Number(n);
}
export function militaryReignRelation(e:WorldEvent,r:{id?:string;accessionYear:number;endYear?:number},factionId:string,events:readonly WorldEvent[]=[]):'BEFORE'|'DURING'|'AFTER'|'UNCERTAIN'{
 const m=e.monthIndex??e.year;if(m<r.accessionYear)return 'BEFORE';if(r.endYear!==undefined&&m>r.endYear)return 'AFTER';
 if(e.rulerId&&e.actorFactionId===factionId&&r.id)return e.rulerId===r.id?'DURING':m===r.accessionYear?'BEFORE':'AFTER';
 const atStart=m===r.accessionYear,atEnd=m===r.endYear;if(!atStart&&!atEnd)return 'DURING';
 const n=sequence(e);if(n===undefined||!r.id)return 'UNCERTAIN';
 const boundaries=events.filter(x=>(x.monthIndex??x.year)===m&&x.actorFactionId===factionId);
 const starts=boundaries.filter(x=>x.type==='ruler-acceded'&&x.rulerId===r.id||['ruler-succession','ruler-deposed'].includes(x.type)&&x.metadata?.nextRulerId===r.id||x.type==='dynasty-usurped'&&x.rulerId===r.id);
 const ends=boundaries.filter(x=>['ruler-died','ruler-captured'].includes(x.type)&&x.rulerId===r.id||['ruler-succession','ruler-deposed'].includes(x.type)&&x.metadata?.previousRulerId===r.id||x.type==='dynasty-usurped'&&x.metadata?.predecessorRulerId===r.id);
 const ordered=(xs:WorldEvent[])=>xs.map(sequence).filter((x):x is number=>x!==undefined);
 const a=ordered(starts),b=ordered(ends);
 if(atStart&&a.length&&n<Math.min(...a))return 'BEFORE';
 if(atEnd&&b.length&&n>Math.max(...b))return 'AFTER';
 return (!atStart||a.length)&&(!atEnd||b.length)?'DURING':'UNCERTAIN';
}
