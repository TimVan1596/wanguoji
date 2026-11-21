import {expect,it} from 'vitest';
import {validateMilitaryCourt} from './MilitaryCourtValidation';
/** Isolates reward eligibility; full family charter/succession validation remains separate. */
function fixture(rank='BO',end?:'BEFORE'|'AFTER'){
 const act:any={eventId:'inherited',month:24,kind:'SUCCEEDED',holderMemberId:'child',rank},closed:any={eventId:'closed',month:48,kind:'ENDED'},service:any={id:'service',year:48,type:'court-service-granted',actorFactionId:'qin',rulerId:'king',metadata:{personId:'person'}};
 const events:any[]=[{id:'f-founded',year:0,type:'military-family-founded'},{id:'child-entered',year:12,type:'military-family-member-entered'},{id:'inherited',year:24,type:'family-title-succeeded'},...(end==='BEFORE'?[{id:'closed',year:48,type:'family-title-ended'}]:[]),service,...(end==='AFTER'?[{id:'closed',year:48,type:'family-title-ended'}]:[])];
 const save:any={registries:{militaryCommandRegistry:{hereditaryRecruitment:'MEDIUM',people:[{personId:'person',sourceUserId:7,bornMonth:-300,appointments:[]}],families:[{familyId:'f',factionId:'qin',epochFounderId:'king',members:[{memberId:'child',sourceUserId:7,bornMonth:-300,enteredMonth:12,source:'NATURAL_GROWTH',militaryPersonId:'person'}],nobleSuccession:[act,...(end?[closed]:[])]}]}},dynasties:[{factionId:'qin',houseEpochs:[{foundingRulerId:'king',startMonth:0}],rulers:[{rulerId:'king',bornMonth:-500,accessionMonth:0,reignOrdinal:1}]}],worldHistory:{events}};
 return save;
}
it('does not require a redundant or lower political BO from an actual inherited BO/HOU/GONG',()=>{for(const rank of ['BO','HOU','GONG'])expect(validateMilitaryCourt(fixture(rank))).toEqual([]);});
it('still requires a proven political reward for a genuinely lower inherited NAN/ZI',()=>{for(const rank of ['NAN','ZI'])expect(validateMilitaryCourt(fixture(rank)).join(';')).toContain('lacks mandatory sourced peerage');});
it('reads the actual same-month title boundary without using a later closure retrospectively',()=>{expect(validateMilitaryCourt(fixture('BO','AFTER'))).toEqual([]);expect(validateMilitaryCourt(fixture('BO','BEFORE')).join(';')).toContain('lacks mandatory sourced peerage');});
it('cannot use a foreign or different-epoch inherited title to bypass the real reward',()=>{for(const key of ['factionId','epochFounderId']){const s=fixture();s.registries.militaryCommandRegistry.families[0][key]='foreign';expect(validateMilitaryCourt(s).join(';')).toContain('lacks mandatory sourced peerage');}});
