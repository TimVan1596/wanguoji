import PersonAbilityPanel from './PersonAbilityPanel';
import {militaryAbilities} from '../../../Politics/PersonAbilities';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {Typography} from '@mui/material';
import {militaryAmbition,militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,bornMonth,loyalty,unitCount,prestige,person}:{person?:MilitaryPerson;personId:string;bornMonth:number;loyalty?:number;unitCount:number;prestige?:number}) {
  return <div data-military-disposition={personId}>
    <Typography fontSize=".82rem">人物能力与政治取向：{militaryDispositionLabel(militaryAmbition(personId,bornMonth),loyalty)}</Typography>
    {person&&<PersonAbilityPanel abilities={militaryAbilities(person)}/>}
    <Typography fontSize=".76rem">稳定野心 {militaryAmbition(personId,bornMonth)} · 当前忠诚 {loyalty===undefined?'无在世绑定，历史值见事件':loyalty}</Typography>
    {unitCount>0&&<Typography fontSize=".76rem">统兵{unitCount}人</Typography>}
    <details><summary>政治取向依据</summary><Typography fontSize=".74rem">性格与君臣关系影响真实危机中的选择；实际政治行动另据事件记录。{prestige===undefined?'':`军权威望 ${prestige.toFixed(2)}；`}威望依据真实任职、战绩、军职及爵位，来源见军功与任职。</Typography></details>
  </div>;
}
