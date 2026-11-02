import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import WorldHistory from '../../../History/WorldHistory';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {projectFamilyArchive,type FamilyArchiveProjection,type FamilyArchiveSource} from '../../../Politics/FamilyArchiveProjection';
let cached:{revision:number;month:number;families:readonly MilitaryFamily[];source:FamilyArchiveSource;projections:Map<MilitaryFamily,FamilyArchiveProjection>}|undefined;
/** Lazy, bounded reading cache. Recorded append order preserves same-month transaction evidence. */
export function familyArchiveSource(month:number){
 const revision=WorldHistory.getRevision(),families=Military.getFamilies();
 if(!cached||cached.revision!==revision||cached.month!==month||cached.families!==families)cached={revision,month,families,source:{month,people:Military.getPeople(),events:WorldHistory.getRecordedEvents(),dynasties:Dynasty.getAll()},projections:new Map()};
 return cached;
}
export function familyArchive(f:MilitaryFamily,month:number){const cache=familyArchiveSource(month);let p=cache.projections.get(f);if(!p){p=projectFamilyArchive(f,cache.source);if(cache.projections.size>=64)cache.projections.clear();cache.projections.set(f,p);}return p;}
