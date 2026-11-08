import {Box,Button,Typography} from '@mui/material';
import {useState} from 'react';
import type {GenealogyNodePresentation} from './GenealogyNodePresentation';
import type {Dynasty,Ruler} from '../../../Politics/Dynasty';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../../../History/WorldHistory';
import {royalNobleReading,createRoyalNobleReadingIndex} from '../../../Politics/RoyalNobleReading';
import {royalMilitaryOfficeLabel} from '../../../Politics/RoyalArchiveIdentity';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export default function RoyalRegisteredChildren({children,dynasty,month,people,events,presentations,nobleIndex,onLocate}:{children:readonly Ruler[];dynasty:Dynasty;month:number;people:ReadonlyMap<string,MilitaryPerson>;events:readonly WorldEvent[];presentations?:ReadonlyMap<string,GenealogyNodePresentation>;nobleIndex?:ReturnType<typeof createRoyalNobleReadingIndex>;onLocate:(id:string)=>void}){
 const [more,setMore]=useState(false),index=nobleIndex??createRoyalNobleReadingIndex(events,month);
 return <Box data-royal-children><Typography fontSize=".8rem">已登记子嗣（{children.length}）</Typography>{!children.length&&<Typography fontSize=".75rem">未见当时已登记子嗣，不据此判定绝嗣。</Typography>}{children.slice(0,more?children.length:6).map(r=>{const noble=royalNobleReading(r,dynasty,events,month,index),person=people.get(r.id),presentation=presentations?.get(r.id),identity=presentation?.politicalLabel??(presentation?.roles.length?presentation.roles.join(' · '):dynasty.heirIds.includes(r.id)?'已列继统候选':'普通宗室 · 未列继统候选');return <Box key={r.id}><Button size="small" onClick={()=>onLocate(r.id)}>{r.houseName.replace(/氏$/,'')}{r.givenName}</Button><Typography component="span" fontSize=".74rem">{formatWorldDate(r.bornYear)}生 · {(r.deathMonth??Infinity)<=month?`${formatWorldDate(r.deathMonth!)}卒`:'在世'} · {identity} · {noble?.label??'未见正式爵位'} · {person?royalMilitaryOfficeLabel(person,month):'未任军职'}</Typography></Box>;})}{children.length>6&&<Button size="small" onClick={()=>setMore(!more)}>{more?'收起':'查看更多'}</Button>}</Box>;
}
