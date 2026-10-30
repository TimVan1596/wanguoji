import {Typography} from '@mui/material';
import {militaryAmbition,militaryDispositionLabel} from '../../../Politics/MilitaryPoliticalDisposition';
export default function MilitaryDispositionPanel({personId,bornMonth,loyalty,unitCount,prestige}:{personId:string;bornMonth:number;loyalty?:number;unitCount:number;prestige?:number}) {
  return <div data-military-disposition={personId}>
    <Typography fontSize=".82rem">政治取向：{militaryDispositionLabel(militaryAmbition(personId,bornMonth),loyalty)}</Typography>
    <Typography fontSize=".76rem">{unitCount>0?`当前有效编组${unitCount}人${prestige===undefined?'':` · 军权威望${prestige.toFixed(2)}`}`:'当前无已核验军权'}；威望依据真实任职、战绩、军职及爵位，来源见军功与任职。</Typography>
    <Typography fontSize=".74rem" color="var(--gg-text-muted)">性格与君臣关系影响真实危机中的选择；实际政治行动另据事件记录。</Typography>
  </div>;
}
