import PersonAbilityPanel,{type LoyaltyObservation} from './PersonAbilityPanel';
import {militaryAbilities,personAmbition} from '../../../Politics/PersonAbilities';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {Typography} from '@mui/material';
import {militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,loyalty,person,loyaltyContext,month,deathMonth,unitCount=0}:{person?:MilitaryPerson;month?:number;deathMonth?:number;personId:string;bornMonth:number;loyalty?:number;unitCount?:number;prestige?:number;loyaltyContext?:Omit<LoyaltyObservation,'value'>}) {
 const ambition=person?personAmbition(militaryAbilities(person).source):undefined;
 return <div data-military-disposition={personId}>
  <PersonAbilityPanel month={month} deathMonth={deathMonth??person?.deathMonth} lifeUnverified={person?.status==='DEAD'&&person.deathMonth===undefined&&deathMonth===undefined} abilities={person?militaryAbilities(person):undefined} ambition={ambition} loyalty={loyalty!==undefined&&loyaltyContext?{...loyaltyContext,value:loyalty}:undefined}/>
  <Typography fontSize=".8rem">政治取向：{ambition===undefined?'未载':militaryDispositionLabel(ambition)}</Typography>
  {unitCount>0&&<Typography fontSize=".76rem">统兵{unitCount}人</Typography>}

 </div>;
}
