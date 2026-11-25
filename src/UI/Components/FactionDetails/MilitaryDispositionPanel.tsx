import PersonAbilityPanel,{type LoyaltyObservation} from './PersonAbilityPanel';
import {militaryAbilities,personAmbition} from '../../../Politics/PersonAbilities';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {Typography} from '@mui/material';
import {militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,loyalty,person,loyaltyContext,month,deathMonth,lifeUnverified,unitCount=0}:{person?:MilitaryPerson;month?:number;deathMonth?:number;lifeUnverified?:boolean;personId:string;bornMonth:number;loyalty?:number;unitCount?:number;prestige?:number;loyaltyContext?:Omit<LoyaltyObservation,'value'>}) {
 const ambition=person?personAmbition(militaryAbilities(person).source):undefined;
 return <div data-military-disposition={personId}>
  <PersonAbilityPanel month={month} deathMonth={deathMonth??person?.deathMonth} lifeUnverified={lifeUnverified||person?.status==='DEAD'&&person.deathMonth===undefined&&deathMonth===undefined} abilities={person?militaryAbilities(person):undefined} ambition={ambition} politicalSummary={ambition===undefined?undefined:militaryDispositionLabel(ambition)} loyalty={loyalty!==undefined&&loyaltyContext?{...loyaltyContext,value:loyalty}:undefined}/>
  {unitCount>0&&<Typography fontSize=".76rem">统兵{unitCount}人</Typography>}

 </div>;
}
