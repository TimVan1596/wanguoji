import PersonAbilityPanel from './PersonAbilityPanel';
import {militaryAbilities} from '../../../Politics/PersonAbilities';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {Typography} from '@mui/material';
import {militaryAmbition,militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,bornMonth,loyalty,unitCount,person}:{person?:MilitaryPerson;personId:string;bornMonth:number;loyalty?:number;unitCount:number;prestige?:number}) {
 return <div data-military-disposition={personId}>
  {person&&<PersonAbilityPanel abilities={militaryAbilities(person)}/>}
  <Typography fontSize=".8rem">野心：{militaryAmbition(personId,bornMonth)}{loyalty===undefined?'':` · 忠诚：${loyalty}`}</Typography>
  <Typography fontSize=".8rem">政治取向：{militaryDispositionLabel(militaryAmbition(personId,bornMonth))}</Typography>
  {unitCount>0&&<Typography fontSize=".76rem">统兵{unitCount}人</Typography>}

 </div>;
}
