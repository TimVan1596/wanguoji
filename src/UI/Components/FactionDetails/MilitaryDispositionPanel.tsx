import PersonAbilityPanel,{type LoyaltyObservation} from './PersonAbilityPanel';
import {militaryAbilities} from '../../../Politics/PersonAbilities';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {Typography} from '@mui/material';
import {militaryAmbition,militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,bornMonth,loyalty,unitCount,person,loyaltyContext}:{person?:MilitaryPerson;personId:string;bornMonth:number;loyalty?:number;unitCount:number;prestige?:number;loyaltyContext?:Omit<LoyaltyObservation,'value'>}) {
 return <div data-military-disposition={personId}>
  <PersonAbilityPanel abilities={person?militaryAbilities(person):undefined} ambition={militaryAmbition(personId,bornMonth)} loyalty={loyalty!==undefined&&loyaltyContext?{...loyaltyContext,value:loyalty}:undefined}/>
  <Typography fontSize=".8rem">政治取向：{militaryDispositionLabel(militaryAmbition(personId,bornMonth))}</Typography>
  {unitCount>0&&<Typography fontSize=".76rem">统兵{unitCount}人</Typography>}

 </div>;
}
