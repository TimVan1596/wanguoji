import {expect,it} from 'vitest';
import {militarySecessionEvidenceHistory} from './MilitarySecessionValidation';
import {deriveMilitaryCareer} from '../Politics/MilitaryCareerEvidence';
it('does not backfill a later same-month siege result into a frozen military political decision',()=>{
 const person:any={personId:'p',bornMonth:0,appointments:[{factionId:'home',commandId:'command',startMonth:100}],capturedEventIds:[],status:'RETIRED'};
 const formations:any=[{commandId:'command',commanderPersonId:'p',factionId:'home',status:'DISBANDED',memberUnitIds:['unit'],captures:[]}];
 const events:any=[{id:'siege',year:140,type:'siege-started',actorFactionId:'home',targetFactionId:'enemy',cityId:'city',metadata:{battleId:'battle',commandId:'command',personId:'p',attackers:1}},{id:'checkpoint',year:151,type:'siege-started',metadata:{battleId:'another-battle'}},{id:'founding',year:152,type:'empire-split'},{id:'late',year:152,type:'siege-ended',actorFactionId:'home',targetFactionId:'enemy',cityId:'city',metadata:{battleId:'battle',commandId:'command',personId:'p',attackers:1,reason:'WITHDRAWN'}}];
 const before=JSON.stringify(events),history=militarySecessionEvidenceHistory(events,{entryKind:'LOCAL_CRISIS',localCrisis:{historyBoundaryEventId:'checkpoint'}});
 expect(deriveMilitaryCareer(person,formations,events,152).activities.map(a=>a.eventId)).toEqual(['late']);
 expect(deriveMilitaryCareer(person,formations,history,152).activities).toEqual([]);
 expect(history.map(e=>e.id)).toEqual(['siege','checkpoint']);expect(JSON.stringify(events)).toBe(before);
});
it('does not fall back to future history when a required checkpoint is missing',()=>{expect(militarySecessionEvidenceHistory([{id:'later'} as any],{entryKind:'LOCAL_CRISIS',localCrisis:{historyBoundaryEventId:'missing'}})).toEqual([]);});
it('leaves the separately evidenced non-local entry path unchanged',()=>{const events:any=[{id:'a'}];expect(militarySecessionEvidenceHistory(events,{entryKind:'EMPIRE_SPLIT'})).toBe(events);});
