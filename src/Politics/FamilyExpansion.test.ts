import {expect,it} from 'vitest';
import {familyExpansionOpen,planFamilyPopulationEntry,familyAppointmentWeight} from './MilitaryFamily';
import {familyBirthSource,familyChildForPopulationEntry} from './FamilyChildBirth';
const f:any={familyId:'f',surname:'傅',founderPersonId:'p',factionId:'qin',epochFounderId:'e',foundedMonth:0,members:[{memberId:'father',sourceUserId:1,name:'傅一',bornMonth:0,enteredMonth:0,generation:0,militaryPersonId:'p',source:'FOUNDER'}],nobleSuccession:[{kind:'ENDED',month:300,eventId:'end'}]};
it.each(['RANK_EXHAUSTED','REVOKED','FORFEITED','NO_HEIR','REGIME_ENDED'])('a %s period blocks new special children, kin enrollment and inherited advantages without deleting anyone',reason=>{
 const family=structuredClone(f);family.nobleSuccession[0].reason=reason;const before=JSON.stringify(family),p:any={factionId:'qin',status:'ACTIVE',appointments:[{factionId:'qin',startMonth:200,commandId:'old-office'}]};
 expect(familyBirthSource(family,family.members[0],300,p)).toBeUndefined();for(let id=2;id<150;id++)expect(planFamilyPopulationEntry([family],'qin','e',id,240,600,'closed')).toBeUndefined();expect(familyAppointmentWeight(family,{...family.members[0],generation:1,militaryPersonId:undefined},'qin','e',600,'MEDIUM')).toBe(1);expect(JSON.stringify(family)).toBe(before);
});
it('honors actual same-month source order and only a genuine new period reopens future expansion',()=>{
 expect(familyExpansionOpen(f,299)).toBe(true);expect(familyExpansionOpen(f,300)).toBe(false);const renewed={...f,nobleSuccession:[...f.nobleSuccession,{kind:'STARTED',reason:'NEW_MERIT',month:300,eventId:'new-source',period:2}]};expect(familyExpansionOpen(renewed,300)).toBe(true);expect(familyExpansionOpen({...renewed,nobleSuccession:[...renewed.nobleSuccession,{kind:'ENDED',month:300}]},300)).toBe(false);
});
it('an already born child survives closure and remains eligible for its one real population slot',()=>{
 const child:any={memberId:'child',bornMonth:200,enteredMonth:200,generation:1,source:'HOUSEHOLD_BIRTH',birth:{naturalDeathMonth:1200}};const family={...f,members:[...f.members,child]};let selected=false;for(let id=1;id<100;id++){const plan=familyChildForPopulationEntry([family],'qin','e',id,500,'existing-child');if(plan){expect(plan.member).toBe(child);selected=true;}}expect(selected).toBe(true);expect(child.deathMonth).toBeUndefined();expect(child.sourceUserId).toBeUndefined();
});
