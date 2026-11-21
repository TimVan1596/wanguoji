import {familyDisplayEligible} from '../../../Politics/FamilyDisplayEligibility';
import {familyArchiveSource} from './FamilyArchiveSource';
import {Button,Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import {FAMILY_NOBLE_NAMES} from '../../../Politics/FamilyNobleSuccession';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
/** The personal biography owns one compact family reference, never an embedded genealogy. */
export default function MilitaryFamilyPanel({personId,month}:{personId:string;month:number}){
 const nav=usePersonArchiveNavigation(),family=Military.getFamilies().find(f=>f.members.some(m=>m.militaryPersonId===personId));
 if(!family)return null;
 const source=familyArchiveSource(month).source,display=familyDisplayEligible(family,month,source.people,source.dynasties);
 const member=family.members.find(m=>m.militaryPersonId===personId)!,parent=family.members.find(m=>m.memberId===member.parentMemberId),inherited=family.nobleSuccession?.filter(a=>a.kind==='SUCCEEDED'&&a.holderMemberId===member.memberId).at(-1);
 return <div data-military-family={family.familyId}><Typography fontSize=".8rem">{family.surname}氏 · 第{member.generation+1}代{inherited?.rank?` · 曾袭${FAMILY_NOBLE_NAMES[inherited.rank]}`:''} · 父亲{parent?.name??'未载'}</Typography>{display&&<Button size="small" onClick={()=>nav.open({kind:'FAMILY',factionId:family.factionId,id:family.familyId,memberId:member.memberId})}>查看{family.surname}氏宗谱</Button>}</div>;
}
