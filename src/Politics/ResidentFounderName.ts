import {splitEstablishedPersonalName} from './NameCulture';
import {isPopulationIdentityLabel} from './MilitaryPersonIdentity';
export type ResidentNameSource='MILITARY'|'FAMILY_ENTRY'|'RESIDENT_NAME'|'CIVIL'|'POLITICAL_ENTRY';
/** Population labels are account/provenance labels, not an established historical name.
 * A family name was fixed at first real population entry, never assigned to an existing adult. */
export function establishedResidentFounderName(userLabel:string,militaryName?:string,familyName?:string,civilName?:string){
 const name=militaryName??familyName??civilName??(!isPopulationIdentityLabel(userLabel)?userLabel:undefined),parts=name&&splitEstablishedPersonalName(name);
 return name&&parts?{...parts,personalName:name,nameSource:(militaryName?'MILITARY':familyName?'FAMILY_ENTRY':civilName?'CIVIL':'RESIDENT_NAME') as ResidentNameSource}:undefined;
}
