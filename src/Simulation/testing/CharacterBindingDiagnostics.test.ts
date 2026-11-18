import {expect,it} from 'vitest';
import {createEmptyWorldSaveV22} from '../../Persistence/WorldSaveSchema';
import {residentIdentityConflicts} from './CharacterBindingDiagnostics';
function usurper(){const save=createEmptyWorldSaveV22();save.dynasties=[{factionId:'state',rulers:[{rulerId:'ruler',bornMonth:12,militaryUsurperIdentity:{personId:'person'}}]}];save.users=[{userId:7,bornMonth:12,historicalPersonId:'person'}] as any;save.registries.militaryCommandRegistry.people=[{personId:'person',sourceUserId:7,bornMonth:12,politicalRulerId:'ruler'}] as any;return save;}
it('recognizes the actual usurper population instead of miscounting it as an unbound resident',()=>{const save=usurper(),before=JSON.stringify(save);expect(residentIdentityConflicts(save)).toBe(0);expect(JSON.stringify(save)).toBe(before);});
it('still detects a wrong birth or a different political owner',()=>{const save=usurper();save.users[0].bornMonth=13;expect(residentIdentityConflicts(save)).toBe(1);save.users[0].bornMonth=12;save.registries.militaryCommandRegistry.people[0].politicalRulerId='another';expect(residentIdentityConflicts(save)).toBe(1);});
