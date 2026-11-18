import type {WorldSaveV1} from '../../Persistence/WorldSaveSchema';
type SavedRuler={rulerId:string;bornMonth:number;deathMonth?:number;residentIdentity?:{personId:string;sourceUserId:number};militaryIdentity?:{personId:string};militaryUsurperIdentity?:{personId:string}};
/** Historical population bindings include the same military person after a real usurpation. */
export function residentIdentityConflicts(save:WorldSaveV1){
 const rulers=save.dynasties.flatMap(d=>d.rulers as unknown as SavedRuler[]),residents=rulers.filter(r=>r.residentIdentity),ids=residents.map(r=>r.residentIdentity!.personId),people=new Map(save.registries.militaryCommandRegistry.people.map(p=>[p.personId,p]));
 return ids.length-new Set(ids).size+save.users.filter(u=>u.historicalPersonId&&!rulers.some(r=>{
  if(r.deathMonth!==undefined||r.bornMonth!==u.bornMonth)return false;
  const resident=r.residentIdentity;
  if(resident&&resident.personId===u.historicalPersonId&&resident.sourceUserId===u.userId)return true;
  const identity=r.militaryUsurperIdentity??r.militaryIdentity;
  if(!identity||identity.personId!==u.historicalPersonId)return false;
  const person=people.get(identity.personId);
  return person?.sourceUserId===u.userId&&person.bornMonth===u.bornMonth&&(r.militaryUsurperIdentity?person.politicalRulerId===r.rulerId:person.royalIdentity?.rulerId===r.rulerId);
 })).length;
}
