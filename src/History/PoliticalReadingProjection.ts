import type {WorldEvent} from './WorldHistory';
const month=(e:WorldEvent)=>e.monthIndex??e.year;
const faction=(e:WorldEvent)=>e.targetFactionId??e.actorFactionId;
const foundingTypes=new Set(['empire-split','rebel-faction-founded','frontier-faction-founded']);
/** Frozen first-founder identity, not merely an accession in the same month. */
export function isFirstFoundingAccession(f:WorldEvent,a:WorldEvent){
 const m=f.metadata,n=a.metadata;
 return foundingTypes.has(f.type)&&m?.foundingIdentityStage==='PROVISIONAL'&&typeof m.leaderPersonId==='string'&&typeof m.foundingRulerId==='string'&&a.type==='ruler-acceded'&&a.rulerId===m.foundingRulerId&&a.actorFactionId===f.actorFactionId&&month(a)===month(f)&&n?.accessionIdentityStage==='PROVISIONAL'&&n.nextRulerId===m.foundingRulerId&&n.residentPersonId===m.leaderPersonId&&n.foundingCityId===m.leaderSourceCityId&&!n.previousRulerId&&(!n.provisionalSeatCityId||n.provisionalSeatCityId===m.leaderSourceCityId);
}
/** A final-city dissolution and its world-observer confirmation share a terminal fact.
 * An exile, restoration or a different explicit transaction is never such a confirmation. */
export function isFinalEndPair(d:WorldEvent,e:WorldEvent,events:readonly WorldEvent[]){
 if(d.type!=='faction-dissolved'||e.type!=='faction-extinct'||faction(d)!==faction(e)||month(d)!==month(e))return false;
 if(d.historyGroupId&&e.historyGroupId)return d.historyGroupId===e.historyGroupId;
 const di=events.indexOf(d),ei=events.indexOf(e),canonicalOrder=d.id.startsWith(`dissolved-${month(d)}-${faction(d)}-`)&&e.id.startsWith(`extinct-${month(e)}-${faction(e)}-`)&&Number(d.id.split('-').at(-1))<Number(e.id.split('-').at(-1));
 return di>=0&&(ei>di||canonicalOrder)&&d.metadata?.isFinalCityCapture===1&&typeof d.metadata.cityId==='string'&&!e.historyGroupId&&!e.metadata&&events.filter(x=>x.type==='faction-dissolved'&&faction(x)===faction(d)&&month(x)===month(d)).length===1&&!events.some(x=>month(x)===month(d)&&['faction-exiled','faction-restored','dynasty-restored'].includes(x.type)&&(x.actorFactionId===faction(d)||x.targetFactionId===faction(d)));
}
/** UI-only companion projection. All original IDs remain in the source references. */
export function mergePoliticalReading(events:readonly WorldEvent[]){
 const hidden=new Set<string>(),replacements=new Map<string,WorldEvent>(),foundings:WorldEvent[]=[],dissolutions:WorldEvent[]=[],buckets=new Map<string,WorldEvent[]>();
 for(const e of events){
  if(foundingTypes.has(e.type))foundings.push(e);if(e.type==='faction-dissolved')dissolutions.push(e);
  for(const id of new Set([e.actorFactionId,e.targetFactionId]))if(id){const key=JSON.stringify([id,month(e)]),rows=buckets.get(key)??[];rows.push(e);buckets.set(key,rows);}
 }
 const bucket=(id:string|undefined,at:number)=>buckets.get(JSON.stringify([id,at]))??[];
 for(const f of foundings){
  const matches=bucket(f.actorFactionId,month(f)).filter(a=>isFirstFoundingAccession(f,a));if(matches.length!==1)continue;
  const a=matches[0];hidden.add(a.id);replacements.set(f.id,{...f,metadata:{...f.metadata,politicalReadingKind:'FOUNDING',sourceEventIds:[f.id,a.id].join(',')}});
 }
 for(const d of dissolutions){
  const local=bucket(faction(d),month(d)),matches=local.filter(e=>isFinalEndPair(d,e,local));if(matches.length!==1)continue;
  const e=matches[0];hidden.add(e.id);replacements.set(d.id,{...d,metadata:{...d.metadata,politicalReadingKind:'FINAL_END',sourceEventIds:[d.id,e.id].join(',')}});
 }
 const result:WorldEvent[]=[];for(const e of events)if(!hidden.has(e.id))result.push(replacements.get(e.id)??e);return result;
}
