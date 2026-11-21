import {expect,it} from 'vitest';
import {civilNobleMerit} from './CivilNobility';
import {personAbilities} from './PersonAbilities';
const id=Array.from({length:100},(_,i)=>i+1).find(id=>personAbilities({kind:'RESIDENT',sourceUserId:id,bornMonth:-240}).strategy>=65)!;
const p:any={personId:'p',sourceUserId:id,bornMonth:-240,appointments:[]};
const t:any={personId:'p',assignmentId:'t',office:'JUNSHOU',startMonth:0,receipts:Array.from({length:8},(_,i)=>({eventId:`r${i}`,month:12*(i+1),loyalty:1,devastation:1}))};
it('requires actual unconsumed governance and never upgrades a higher legitimate peerage',()=>{expect(civilNobleMerit(p,[t],120,70)?.rank).toBe('NAN');expect(civilNobleMerit(p,[{...t,receipts:[]}],120,100)).toBeUndefined();expect(civilNobleMerit(p,[t],120,64)).toBeUndefined();expect(civilNobleMerit(p,[t],120,100,'BO')).toBeUndefined();expect(civilNobleMerit({...p,nobilityHistory:[{basis:'CIVIL',civilMeritEventIds:t.receipts.map((r:any)=>r.eventId)}]},[t],240,100,'NAN')).toBeUndefined();});
it('does not ennoble the dead, a monarch, a county novice or a former official without an active political office',()=>{for(const person of [{...p,deathMonth:100},{...p,politicalRulerId:'king'}])expect(civilNobleMerit(person,[t],120,100)).toBeUndefined();expect(civilNobleMerit(p,[{...t,office:'XIANLING'}],120,100)).toBeUndefined();expect(civilNobleMerit(p,[{...t,endMonth:100}],120,100)).toBeUndefined();});
