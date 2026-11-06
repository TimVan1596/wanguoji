import {expect,it} from 'vitest';
import {familyMemberServiceStatus} from './FamilyMemberServiceStatus';
const row:any={appointments:[],inheritedHistory:[],personalHistory:[],life:'ALIVE'};
it('never demotes a real past civilian heir to a generic parent bridge',()=>{
 expect(familyMemberServiceStatus({...row,inheritedHistory:[{rank:'BO',month:1560}],life:'DEAD'},1800)).toBe('曾经袭爵 · 未任军职');
 expect(familyMemberServiceStatus({...row,inheritedHistory:[{rank:'ZI'}],inherited:{rank:'ZI'}},2400)).toBe('合法袭爵 · 未任军职');
 expect(familyMemberServiceStatus(row,2400)).toBe('普通居民 · 父系桥梁');
});
it('keeps actual office history separate from both kinds of title',()=>{expect(familyMemberServiceStatus({...row,appointments:[{officeHistory:[{office:'SHANGJIANGJUN',month:12}]}],inheritedHistory:[{}]},24)).toBe('原任上将军');expect(familyMemberServiceStatus({...row,personalHistory:[{}]},24)).toBe('本人受爵 · 未任军职');});
