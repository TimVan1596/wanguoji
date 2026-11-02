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
 const stamp=open?JSON.stringify([dynasty,History.getRevision(),people]):'';
 const data=useMemo(()=>{
  if(!open||!dynasty)return undefined;
  const index=indexGenealogy(buildRoyalArchiveGenealogy(dynasty,people,events));
  return {index,military:royalMilitaryArchive(dynasty,people,events),presentations:deriveGenealogyNodePresentations(dynasty,team,events,worldMonth)};
 },[open,stamp,worldMonth,team.name]);
 const rows=useMemo(()=>data?genealogyWindow(data.index,focus,expanded,branchOffsets,new Set(data.military.keys())):[],[data,focus,expanded,branchOffsets]);
 const heights=useMemo(()=>new Map(rows.map(({node})=>[node.ruler.id,genealogyCardHeight(true,!!data?.presentations.get(node.ruler.id)?.labels.length,!!data?.military.get(node.ruler.id))])),[rows,data]);
 const layout=useMemo(()=>layoutGenealogy(rows,heights),[rows,heights]);
 const name=(r:{houseName:string;givenName:string})=>r.houseName.replace(/氏$/,'')+r.givenName;
 useEffect(()=>{if(!open)return;setFocus(targetId??dynasty?.currentRulerId??'');setExpanded(new Set());setSelected(undefined);setBranchOffsets(new Map());},[open,targetId,team.name]);
 const person=selected?data?.index.get(selected)?.ruler:undefined,service=person?data?.military.get(person.id):undefined;
 return <Dialog open={open} onClose={(_,reason)=>onClose(reason==='escapeKeyDown'?'ESCAPE':'BACKDROP',reason)} fullWidth maxWidth="xl" PaperProps={{sx:{width:'90vw',height:'84vh',maxWidth:1500,display:'flex',flexDirection:'column'}}}>
 <GenealogyTreeView title="完整宗谱" identity={team.name} layout={layout} focusId={focus} targetId={targetId} onLocate={setFocus} onClose={()=>onClose('EXPLICIT')} locations={dynasty?.currentRulerId?[{id:dynasty.currentRulerId,label:'定位当今君主'}]:[]} details={
  person&&<Box data-genealogy-person={person.id} sx={{mx:2,mb:1,p:1,border:'1px solid var(--gg-border)',flexShrink:0,}}>
   <Box sx={{display:'flex',justifyContent:'space-between'}}><Typography fontWeight="bold">王室身份：{data?.presentations.get(person.id)?.heading??name(person)}</Typography><Button size="small" onClick={()=>setSelected(undefined)}>收起资料</Button></Box>
   <Typography fontSize=".75rem">{person.parentId&&data?.index.get(person.parentId)?'父系：'+name(data.index.get(person.parentId)!.ruler):person.parentId?'父系档案未载':'父系未载'} · {formatRulerLifeAge(person,worldMonth,false,team.status!=='EXTINCT')}</Typography>
   <Typography fontSize=".78rem">{data?.presentations.get(person.id)?.honor?.secondary}</Typography>{data?.presentations.get(person.id)?.posthumousLabels?.map(label=><Typography key={label} fontSize=".78rem">{label}</Typography>)}<PersonLifeDates bornMonth={person.bornYear} deathMonth={person.deathMonth}/><RoyalHonorPanel ruler={person} month={worldMonth}/>
   {person.accessionYear!==undefined&&<Typography fontSize=".75rem">政治任期：{formatWorldDate(person.accessionYear)}—{person.endYear===undefined?'今':formatWorldDate(person.endYear)}</Typography>}
   {service&&<Typography fontSize=".75rem">{royalMilitaryOfficeLabel(service,worldMonth)}</Typography>}
   {service?.appointments.slice(-1).map(a=><Typography fontSize=".75rem" key={a.commandId}>军职任期：{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?'今':formatWorldDate(a.endMonth)}</Typography>)}
   {person.reignOrdinal!==undefined&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'RULER',factionId:dynasty!.factionId,id:person.id});}}>查看王室本纪</Button>}
   {service&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'MILITARY',factionId:dynasty!.factionId,id:service.personId});}}>查看军旅档案</Button>}
  </Box>
 } nodes={rows.map(({node,depth,hiddenChildren})=>{const r=node.ruler,p=data?.military.get(r.id),position=layout.positions.get(r.id)!;return {id:r.id,depth,data:{'data-ruler-id':r.id},card:<button type="button" data-genealogy-card style={{border:0,padding:0,background:'none',cursor:'pointer',display:'block'}} onClick={()=>setSelected(r.id)} aria-label={`查看${name(r)}王室身份`}><GenealogyPersonCard compact ruler={r} displayName={name(r)} presentation={data?.presentations.get(r.id)} worldMonth={worldMonth} managedLife={team.status!=='EXTINCT'} militaryLabel={p?'宗室将领 · '+royalMilitaryOfficeLabel(p,worldMonth):undefined}/></button>,controls:<>
 {node.children.length>1&&(hiddenChildren>0||expanded.has(r.id))&&<Button size="small" sx={{position:'absolute',right:0,top:position.height,minWidth:0,fontSize:10,py:0}} aria-expanded={expanded.has(r.id)} onClick={()=>setExpanded(s=>{const next=new Set(s);next.has(r.id)?next.delete(r.id):next.add(r.id);return next;})}>{expanded.has(r.id)?'收起旁系':`旁系 +${hiddenChildren}`}</Button>}
 {expanded.has(r.id)&&node.children.length>10&&<Button size="small" sx={{position:'absolute',left:0,top:position.height,fontSize:10,py:0}} onClick={()=>setBranchOffsets(s=>{const next=new Map(s);next.set(r.id,((s.get(r.id)??0)+10)%node.children.length);return next;})}>其他旁系</Button>}</>};})}/></Dialog>;
}
