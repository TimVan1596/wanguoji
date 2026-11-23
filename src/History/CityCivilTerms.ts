import type {CivilGovernorTerm} from '../Politics/CivilAdministrationSchema';
import {isLocalCivilOffice} from '../Politics/CivilOffice';

export function cityCivilTerms(terms:readonly CivilGovernorTerm[],cityId:string,month:number){
 const rows=new Map<string,CivilGovernorTerm>();
 for(const term of terms)if(term.cityId===cityId&&isLocalCivilOffice(term.office)&&term.startMonth<=month)rows.set(term.assignmentId,term);
 return [...rows.values()].sort((a,b)=>b.startMonth-a.startMonth);
}
