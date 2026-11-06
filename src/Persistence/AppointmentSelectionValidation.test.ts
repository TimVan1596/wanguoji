import {expect,it} from 'vitest';
import {personAbilities} from '../Politics/PersonAbilities';
import {appointmentAbilityWeight} from '../Politics/AppointmentSelection';
import {validateAppointmentSelections} from './AppointmentSelectionValidation';

function fixture(officeIssuer:string|undefined='king'){
 const abilities=personAbilities({kind:'RESIDENT',sourceUserId:7,bornMonth:-300});
 const selection={version:1,policy:'MEDIUM',month:24,factionId:'qin',rulerId:'king',opportunityRoll:.01,selectionRoll:0,ordinaryChance:.05,titleChance:0,priority:false,selectedIndex:0,rows:[{firstAppointment:true,sourceUserId:7,bornMonth:-300,baseWeight:1,abilities,weight:appointmentAbilityWeight(1,abilities,'MEDIUM')}]};
 const appointment={commandId:'military-command-1',startMonth:24,factionId:'qin',selection};
 return {dynasties:[{factionId:'qin',rulers:[{rulerId:'king',accessionMonth:0,bornMonth:-600}]}],registries:{militaryCommandRegistry:{appointmentAbilityPolicy:'MEDIUM',people:[{personId:'military-person-1',sourceUserId:7,bornMonth:-300,appointments:[appointment]}],families:[]}},worldHistory:{events:[{id:'military-appointment-military-command-1',monthIndex:24,type:'military-appointment',metadata:{appointmentSelection:JSON.stringify(selection)}},{id:'military-office-military-command-1-XIAOWEI',monthIndex:24,type:'military-office-granted',...(officeIssuer?{rulerId:officeIssuer}:{})}]}} as any;
}
it('binds the actual formal initial office issuer to the frozen shared selection',()=>{
 expect(validateAppointmentSelections(fixture())).toEqual([]);
 expect(validateAppointmentSelections(fixture('another-king'))).not.toEqual([]);
});
it('preserves a temporary military office without inventing a formal royal signature',()=>{
 const save=fixture('');
 expect(validateAppointmentSelections(save)).toEqual([]);
 save.dynasties[0].rulers=[];
 expect(validateAppointmentSelections(save)).not.toEqual([]);
});
