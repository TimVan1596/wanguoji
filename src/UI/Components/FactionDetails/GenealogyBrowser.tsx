import {royalExternalKin} from '../../../Politics/RoyalExternalKin';
import {rulerFamilyOrigin} from '../../../Politics/RulerFamilyOrigin';
import {layoutGenealogyNodes} from './genealogyLayout';
import GenealogyCardFrame from './GenealogyCardFrame';
import RoyalNoblePanel from './RoyalNoblePanel';
import GenealogyTreeView from './GenealogyTreeView';
import RoyalHonorPanel from './RoyalHonorPanel';
import {useEffect,useMemo,useState} from "react";
import {Box,Button,Dialog,Typography} from "@mui/material";
import type {Dynasty} from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import History from "../../../History/WorldHistory";
import {buildRoyalArchiveGenealogy,royalMilitaryArchive,royalMilitaryOfficeLabel} from "../../../Politics/RoyalArchiveIdentity";
import {deriveGenealogyNodePresentations} from "./GenealogyNodePresentation";
import {GenealogyPersonCard} from "./GenealogyPersonCard";
import {indexGenealogy,genealogyWindow,layoutGenealogy,genealogyCardHeight} from "./genealogyWindow";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";
import PersonLifeDates from "./PersonLifeDates";
import {formatRulerLifeAge} from "./RoyalPresentation";
import type {RootState} from "../../../store";
import type {GenealogyViewerCloseSource} from "./GenealogyViewerDiagnostics";
import {formatWorldDate} from "../../../Simulation/WorldTime";

export default function GenealogyBrowser({open,onClose,dynasty,team,worldMonth,targetId}:{open:boolean;onClose:(source:GenealogyViewerCloseSource,reason?:string)=>void;dynasty?:Dynasty;team:RootState["root"]["teams"][number];worldMonth:number;targetId?:string}){
 const nav=usePersonArchiveNavigation();
 const [focus,setFocus]=useState(''),[expanded,setExpanded]=useState(new Set<string>()),[selected,setSelected]=useState<string>();
 const [branchOffsets,setBranchOffsets]=useState(new Map<string,number>());
 const events=open?History.getEvents():[],people=open?Military.getPeople():[];
 const stamp=open?JSON.stringify([dynasty,History.getRevision(),Military.getFamilyReadingRevision(),people]):'';
 const data=useMemo(()=>{
  if(!open||!dynasty)return undefined;
  const index=indexGenealogy(buildRoyalArchiveGenealogy(dynasty,people,events));
  return {external:royalExternalKin(dynasty,Military.getFamilies(),people,History.getRecordedEvents(),worldMonth),index,military:royalMilitaryArchive(dynasty,people,events),presentations:deriveGenealogyNodePresentations(dynasty,team,events,worldMonth)};
 },[open,stamp,worldMonth,team.name,dynasty]);
 const rows=useMemo(()=>data?genealogyWindow(data.index,data.external.find(x=>x.id===focus)?.parentId??focus,expanded,branchOffsets,new Set([...data.military.keys(),...(dynasty?.royalNobility??[]).flatMap(a=>[a.previousRulerId,...a.holderRulerId?[a.holderRulerId]:[]])])):[],[data,focus,expanded,branchOffsets]);
 const heights=useMemo(()=>new Map(rows.map(({node})=>[node.ruler.id,genealogyCardHeight(true,!!data?.presentations.get(node.ruler.id)?.labels.length,!!data?.military.get(node.ruler.id))])),[rows,data]);
 const extra=useMemo(()=>data?.external.filter(x=>rows.some(r=>r.node.ruler.id===x.parentId))??[],[data,rows]);
 const layout=useMemo(()=>extra.length?layoutGenealogyNodes([...rows.map(r=>({id:r.node.ruler.id,parentId:r.node.ruler.parentId,depth:r.depth})),...extra.map(x=>({id:x.id,parentId:x.parentId,depth:rows.find(r=>r.node.ruler.id===x.parentId)!.depth+1}))],new Map([...heights,...extra.map(x=>[x.id,100] as const)])):layoutGenealogy(rows,heights),[rows,heights,extra]);
 const name=(r:{houseName:string;givenName:string})=>r.houseName.replace(/氏$/,'')+r.givenName;
 useEffect(()=>{if(!open)return;setFocus(targetId??dynasty?.currentRulerId??'');setExpanded(new Set());setSelected(undefined);setBranchOffsets(new Map());},[open,targetId,team.name]);
 const external=data?.external.find(x=>x.id===selected),origin=selected&&dynasty?.rulers.find(r=>r.id===selected)?rulerFamilyOrigin(dynasty.rulers.find(r=>r.id===selected)!,Military.getFamilies(),people,worldMonth):undefined;
 const person=selected?data?.index.get(selected)?.ruler:undefined,service=person?data?.military.get(person.id):undefined;
 return <Dialog open={open} onClose={(_,reason)=>onClose(reason==='escapeKeyDown'?'ESCAPE':'BACKDROP',reason)} fullWidth maxWidth="xl" PaperProps={{sx:{width:'90vw',height:'84vh',maxWidth:1500,display:'flex',flexDirection:'column'}}}>
 <GenealogyTreeView title="完整宗谱" identity={team.name} layout={layout} focusId={focus} targetId={targetId} onLocate={setFocus} onClose={()=>onClose('EXPLICIT')} locations={dynasty?.currentRulerId?[{id:dynasty.currentRulerId,label:'定位当今君主'}]:[]} details={
  <>{external&&<Box data-external-person={external.member.memberId} sx={{mx:2,p:1}}><Typography fontSize=".8rem">原族旁支：{external.member.name} · 父亲{external.origin.name} · {external.factionId}登记成员</Typography><PersonLifeDates bornMonth={external.member.bornMonth} deathMonth={external.member.deathMonth}/><Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'FAMILY',factionId:external.family.factionId,id:external.family.familyId,memberId:external.member.memberId});}}>查看原功臣宗谱并定位</Button>{external.person&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'MILITARY',factionId:external.person!.appointments.at(-1)!.factionId,id:external.person!.personId});}}>真实军旅档案</Button>}</Box>}{person&&<Box data-genealogy-person={person.id} sx={{mx:2,mb:1,p:1,border:'1px solid var(--gg-border)',flexShrink:0,}}>
   <Box sx={{display:'flex',justifyContent:'space-between'}}><Typography fontWeight="bold">王室身份：{data?.presentations.get(person.id)?.heading??name(person)}</Typography><Button size="small" onClick={()=>setSelected(undefined)}>收起资料</Button></Box>
   <Typography fontSize=".75rem">{person.parentId&&data?.index.get(person.parentId)?'父系：'+name(data.index.get(person.parentId)!.ruler):person.parentId?'父系档案未载':origin?.member.parentMemberId?'原族父亲：'+(origin.family.members.find(m=>m.memberId===origin.member.parentMemberId)?.name??'原族档案未载'):'父系未载'} · {formatRulerLifeAge(person,worldMonth,false,team.status!=='EXTINCT')}</Typography>
   <Typography fontSize=".78rem">{data?.presentations.get(person.id)?.honor?.secondary}</Typography>{data?.presentations.get(person.id)?.posthumousLabels?.map(label=><Typography key={label} fontSize=".78rem">{label}</Typography>)}<PersonLifeDates bornMonth={person.bornYear} deathMonth={person.deathMonth}/><RoyalHonorPanel ruler={person} month={worldMonth}/>
   <RoyalNoblePanel ruler={person} dynasty={dynasty!} month={worldMonth} beforeNavigate={()=>onClose('EXPLICIT')}/>{origin&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'FAMILY',factionId:origin.family.factionId,id:origin.family.familyId,memberId:origin.member.memberId});}}>原出身于{origin.family.surname}氏 · 查看原宗谱</Button>}
   {person.accessionYear!==undefined&&<Typography fontSize=".75rem">政治任期：{formatWorldDate(person.accessionYear)}—{person.endYear===undefined?'今':formatWorldDate(person.endYear)}</Typography>}
   {service&&<Typography fontSize=".75rem">{royalMilitaryOfficeLabel(service,worldMonth)}</Typography>}
   {service?.appointments.slice(-1).map(a=><Typography fontSize=".75rem" key={a.commandId}>军职任期：{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?'今':formatWorldDate(a.endMonth)}</Typography>)}
   {person.reignOrdinal!==undefined&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'RULER',factionId:dynasty!.factionId,id:person.id});}}>查看王室本纪</Button>}
   {service&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'MILITARY',factionId:dynasty!.factionId,id:service.personId});}}>查看军旅档案</Button>}
  </Box>}</>
 } nodes={[...rows.map(({node,depth,hiddenChildren})=>{const r=node.ruler,p=data?.military.get(r.id),position=layout.positions.get(r.id)!;return {id:r.id,depth,data:{'data-ruler-id':r.id},card:<button type="button" data-genealogy-card style={{border:0,padding:0,background:'none',cursor:'pointer',display:'block'}} onClick={()=>setSelected(r.id)} aria-label={`查看${name(r)}王室身份`}><GenealogyPersonCard compact ruler={r} displayName={name(r)} presentation={data?.presentations.get(r.id)} worldMonth={worldMonth} managedLife={team.status!=='EXTINCT'} militaryLabel={p?'宗室将领 · '+royalMilitaryOfficeLabel(p,worldMonth):undefined}/></button>,controls:<>
 {node.children.length>1&&(hiddenChildren>0||expanded.has(r.id))&&<Button size="small" sx={{position:'absolute',right:0,top:position.height,minWidth:0,fontSize:10,py:0}} aria-expanded={expanded.has(r.id)} onClick={()=>setExpanded(s=>{const next=new Set(s);next.has(r.id)?next.delete(r.id):next.add(r.id);return next;})}>{expanded.has(r.id)?'收起旁系':`旁系 +${hiddenChildren}`}</Button>}
 {expanded.has(r.id)&&node.children.length>10&&<Button size="small" sx={{position:'absolute',left:0,top:position.height,fontSize:10,py:0}} onClick={()=>setBranchOffsets(s=>{const next=new Map(s);next.set(r.id,((s.get(r.id)??0)+10)%node.children.length);return next;})}>其他旁系</Button>}</>};}),...extra.map(x=>({id:x.id,depth:rows.find(r=>r.node.ruler.id===x.parentId)!.depth+1,data:{'data-external-family-member':x.member.memberId},card:<button type="button" data-genealogy-card style={{border:0,padding:0,background:'none',cursor:'pointer'}} onClick={()=>setSelected(x.id)}><GenealogyCardFrame height={100}><Typography fontSize={13}>{x.member.name}</Typography><Typography fontSize={11}>原族旁支 · {x.factionId}</Typography><Typography fontSize={11}>{x.person?royalMilitaryOfficeLabel(x.person,worldMonth,x.factionId)??'未任军职':'未任军职'}</Typography><Typography fontSize={11}>{(x.member.deathMonth??Infinity)<=worldMonth?'已故':'登记成员'}</Typography></GenealogyCardFrame></button>}))]}/></Dialog>;
}
