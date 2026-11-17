import type {CivilGovernorTerm} from '../../Politics/CivilAdministrationSchema';
import type {MilitaryPerson} from '../../Politics/MilitaryCommandRegistry';
import {isPopulationIdentityLabel} from '../../Politics/MilitaryPersonIdentity';
/** Read-only diagnostic projection from actual canonical careers. */
export function civilCareerAudit(terms:readonly CivilGovernorTerm[],people:readonly MilitaryPerson[],teams:readonly {name:string;sovereigntyRank:string;identityStage:string;cities:readonly unknown[]}[],month:number){
 const identities=[...new Map(terms.map(t=>[`${t.sourceUserId}/${t.bornMonth}`,t])).values()];
 const unnamed=identities.filter(t=>isPopulationIdentityLabel(t.personalName)).length;
 return {people:identities.length,unnamed,nameCoverage:identities.length?(identities.length-unnamed)/identities.length:1,
 civilToMilitary:people.flatMap(p=>p.appointments.filter(a=>terms.some(t=>t.personId===p.personId&&t.endMonth!==undefined&&t.endMonth<=a.startMonth))).length,
 militaryToCivil:terms.filter(t=>people.some(p=>p.personId===t.personId&&p.appointments.some(a=>a.endMonth!==undefined&&a.endMonth<=t.startMonth))).length,
 overlap:terms.filter(t=>people.some(p=>p.personId===t.personId&&p.appointments.some(a=>a.startMonth<(t.endMonth??Infinity)&&(a.endMonth??Infinity)>t.startMonth))).length,
 countries:teams.map(t=>({factionId:t.name,rank:t.sovereigntyRank,identityStage:t.identityStage,cities:t.cities.length,civil:terms.filter(a=>a.factionId===t.name&&a.startMonth<=month&&a.endMonth===undefined).length,military:people.filter(p=>p.factionId===t.name&&p.status==='ACTIVE').length})),
 endReasons:Object.fromEntries([...new Set(terms.filter(t=>t.endReason).map(t=>t.endReason!))].map(reason=>[reason,terms.filter(t=>t.endReason===reason).length])),
 endedBeforeMinimumMilitaryRetirement:terms.filter(t=>t.endMonth!==undefined&&t.endReason!=='DEATH'&&t.endMonth-t.bornMonth<65*12).length,
 ordinaryAppointments:terms.filter(t=>t.identitySource==='ORDINARY_RESIDENT').length};
}
