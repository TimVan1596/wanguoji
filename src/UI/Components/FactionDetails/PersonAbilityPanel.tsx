import {Typography} from '@mui/material';
import type {PersonAbilities} from '../../../Politics/PersonAbilities';
export default function PersonAbilityPanel({abilities}:{abilities:PersonAbilities;royal?:boolean}){return <div data-person-abilities={JSON.stringify(abilities)}><Typography fontSize=".8rem">统御：{abilities.command} · 谋略：{abilities.strategy}</Typography></div>;}
/** Mounted only inside the existing, closed-by-default biography technical evidence. */
export function PersonAbilityEvidence({abilities}:{abilities:PersonAbilities}){return <Typography fontSize=".74rem">能力版本 {abilities.version}；来源 {JSON.stringify(abilities.source)}。只在合法宫廷军权参与中有限影响候选、发起与条件成败；读取不另抽世界随机数。</Typography>;}
