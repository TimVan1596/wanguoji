import {Typography} from '@mui/material';
import type {Dynasty,Ruler} from '../../../Politics/Dynasty';
import {ROYAL_HONOR_NAMES,royalHonorText,effectiveRoyalHonor} from '../../../Politics/RoyalHonors';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export function royalHonorLabel(r:Ruler,d:Pick<Dynasty,'houseEpochs'>,month:number,status='ACTIVE',rank?:string){
 const g=r.royalHonors?.filter(g=>g.month<=month).at(-1);if(!g)return '';
 const effective=status==='ACTIVE'&&effectiveRoyalHonor(r,d,month,rank);
 return `${ROYAL_HONOR_NAMES[g.rank]}${r.accessionYear!==undefined&&r.accessionYear<=month?'（登位前）':effective?'':'（历史荣衔）'}`;
}
export default function RoyalHonorPanel({ruler,month}:{ruler:Ruler;month:number}){
 const grants=ruler.royalHonors?.filter(g=>g.month<=month)??[];if(!grants.length)return null;
 return <section data-royal-honors={ruler.id}><Typography fontSize='.82rem' fontWeight='bold'>宗室荣衔{ruler.accessionYear!==undefined&&ruler.accessionYear<=month?' · 登位前身份':''}</Typography>{grants.map(g=><Typography key={g.eventId} fontSize='.8rem'>{formatWorldDate(g.month)}，{royalHonorText(g)}</Typography>)}<details><summary>授封依据</summary>{grants.map(g=><Typography key={g.eventId} fontSize='.73rem'>授封君主 {g.issuerName} · 受封者 {g.recipientName} · 亲缘 {({DIRECT_CHILD:'子',GRANDCHILD:'孙',SIBLING:'兄弟',NEPHEW:'侄',UNCLE:'叔伯',COUSIN:'堂亲',COLLATERAL_KIN:'旁系'} as const)[g.relation]} · 王统 {g.epochFounderId} · 事件 {g.eventId} · {g.meritEventIds.length?`军功来源 ${g.meritEventIds.join('、')}`:'缺少军功依据，请检查史料'}</Typography>)}</details></section>;
}
