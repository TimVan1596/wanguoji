import {expect,it} from 'vitest';
import {familyResidenceEvidence} from './FamilyResidenceEvidence';
it('preserves original birth and admission and never invents a transfer cause from a nearby battle',()=>{
 const f:any={factionId:'qi'},m:any={memberId:'son',sourceUserId:7,bornMonth:100,enteredMonth:100,populationEnteredMonth:300,birth:{factionId:'qi'},factionHistory:[{month:400,factionId:'zhao',eventIndex:2}]};
 const events:any[]=[{id:'irrelevant',year:400,type:'city-captured',title:'战事'}];const r=familyResidenceEvidence(f,m,450,events);expect(r).toMatchObject({originalFactionId:'qi',entryFactionId:'qi',settlementFactionId:'zhao'});expect(r.transfers[0].reason).toContain('未核验');expect(r.transfers[0].eventId).toBeUndefined();
 expect(familyResidenceEvidence(f,m,400,events,1).settlementFactionId).toBe('qi');expect(familyResidenceEvidence(f,m,400,events,2).settlementFactionId).toBe('zhao');
});

it('uses only the exact permanent resident evidence before the settlement event boundary',()=>{
 const f:any={factionId:'qi'},m:any={memberId:'son',sourceUserId:7,bornMonth:100,enteredMonth:100,factionHistory:[{month:400,factionId:'zhao',eventIndex:1}]};
 const e:any={id:'transfer',year:400,type:'royal-person-transferred',title:'真实转属事务',metadata:{sourceUserId:7,bornMonth:100,fromFactionId:'qi',toFactionId:'zhao'}};
 const events:any[]=[{id:'earlier'},e,{id:'settlement'}];
 expect(familyResidenceEvidence(f,m,400,events,1).transfers[0].eventId).toBeUndefined();expect(familyResidenceEvidence(f,m,400,events,2).transfers[0].eventId).toBe('transfer');
 expect(familyResidenceEvidence(f,{...m,sourceUserId:8},400,events).transfers[0].eventId).toBeUndefined();expect(familyResidenceEvidence(f,{...m,bornMonth:99},400,events).transfers[0].eventId).toBeUndefined();
 expect(familyResidenceEvidence(f,m,399,events).settlementFactionId).toBe('qi');
});
