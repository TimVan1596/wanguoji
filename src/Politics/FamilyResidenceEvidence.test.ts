import {expect,it} from 'vitest';
import {familyResidenceEvidence} from './FamilyResidenceEvidence';
it('preserves original birth and admission and never invents a transfer cause from a nearby battle',()=>{
 const f:any={factionId:'qi'},m:any={memberId:'son',sourceUserId:7,bornMonth:100,enteredMonth:100,populationEnteredMonth:300,birth:{factionId:'qi'},factionHistory:[{month:400,factionId:'zhao',eventIndex:2}]};
 const events:any[]=[{id:'irrelevant',year:400,type:'city-captured',title:'战事'}];const r=familyResidenceEvidence(f,m,450,events);expect(r).toMatchObject({originalFactionId:'qi',entryFactionId:'qi',settlementFactionId:'zhao'});expect(r.transfers[0].reason).toContain('未核验');expect(r.transfers[0].eventId).toBeUndefined();
 expect(familyResidenceEvidence(f,m,400,events,1).settlementFactionId).toBe('qi');expect(familyResidenceEvidence(f,m,400,events,2).settlementFactionId).toBe('zhao');
});
