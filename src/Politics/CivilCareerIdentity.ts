import {CIVIL_GOVERNANCE_POLICY,type CivilAdministrationState} from './CivilAdministrationSchema';
/** Single canonical registry storage, shared without importing Phaser/runtime services. */
export const emptyCivilState=():CivilAdministrationState=>({careerPolicy:'LOW',version:1,sequence:0,lastEvaluationMonth:-1,policy:CIVIL_GOVERNANCE_POLICY,terms:[]});
let state=emptyCivilState();
export const civilState=()=>state;
export function replaceCivilState(next:CivilAdministrationState){state=next;}
export const civilPopulationIdentity=(id:number,bornMonth:number)=>state.terms.find(t=>t.sourceUserId===id&&t.bornMonth===bornMonth);
