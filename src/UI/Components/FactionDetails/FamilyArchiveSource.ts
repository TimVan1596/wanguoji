import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import WorldHistory from '../../../History/WorldHistory';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {projectFamilyArchive,summarizeFamilyArchive,createFamilyArchiveIndex,type FamilyArchiveProjection,type FamilyArchiveIndex,type FamilyArchiveSource} from '../../../Politics/FamilyArchiveProjection';
let cached:{revision:number;residentRevision:number;month:number;families:readonly MilitaryFamily[];source:FamilyArchiveSource;index?:FamilyArchiveIndex;projections:Map<MilitaryFamily,FamilyArchiveProjection>;summaries:Map<MilitaryFamily,ReturnType<typeof summarizeFamilyArchive>>}|undefined;
const stats={indexBuilds:0,summaryBuilds:0,projectionBuilds:0,hits:0,invalidations:0};
/** Read-only, session-owned cache. Actual transfers without a history append also invalidate it. */
export function familyArchiveSource(month:number){
 const revision=WorldHistory.getRevision(),residentRevision=Military.getFamilyReadingRevision(),families=Military.getFamilies();
 if(!cached||cached.revision!==revision||cached.residentRevision!==residentRevision||cached.month!==month||cached.families!==families){stats.invalidations++;cached={revision,residentRevision,month,families,source:{month,people:Military.getPeople(),events:WorldHistory.getRecordedEvents(),dynasties:Dynasty.getAll()},projections:new Map(),summaries:new Map()};}
 return cached;
}
function prepared(month:number){const frame=familyArchiveSource(month);if(!frame.index){frame.index=createFamilyArchiveIndex(frame.source);stats.indexBuilds++;}return {...frame,index:frame.index};}
function retain<K,V>(map:Map<K,V>,key:K,value:V,limit:number){if(map.size>=limit&&!map.has(key))map.delete(map.keys().next().value!);map.set(key,value);}
export function familySummary(f:MilitaryFamily,month:number){const c=prepared(month),old=c.summaries.get(f);if(old){stats.hits++;return old;}const p=summarizeFamilyArchive(f,c.source,c.index);stats.summaryBuilds++;retain(c.summaries,f,p,256);return p;}
export function familyArchive(f:MilitaryFamily,month:number){const c=prepared(month),old=c.projections.get(f);if(old){stats.hits++;return old;}const p=projectFamilyArchive(f,c.source,c.index);stats.projectionBuilds++;retain(c.projections,f,p,16);return p;}
export function familyArchiveReadingDiagnostics(){return {...stats,summaryCache:cached?.summaries.size??0,archiveCache:cached?.projections.size??0,events:cached?.source.events.length??0};}
export function resetFamilyArchiveReading(){cached=undefined;for(const k of Object.keys(stats) as Array<keyof typeof stats>)stats[k]=0;}
