import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {Box,Button,Dialog,DialogTitle,DialogContent,Typography} from "@mui/material";
import type {Dynasty} from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import History from "../../../History/WorldHistory";
import {buildRoyalArchiveGenealogy,royalMilitaryArchive,royalMilitaryOfficeLabel} from "../../../Politics/RoyalArchiveIdentity";
import {deriveGenealogyNodePresentations} from "./GenealogyNodePresentation";
import {GenealogyPersonCard} from "./GenealogyPersonCard";
import {indexGenealogy,genealogyWindow,layoutGenealogy,visibleGenealogyRows,genealogyCardHeight,GENEALOGY_CARD_WIDTH} from "./genealogyWindow";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";
import {clampGenealogyScale,getGenealogyFitScale} from "./genealogyViewport";
import PersonLifeDates from "./PersonLifeDates";
import {formatRulerLifeAge} from "./RoyalPresentation";
import type {RootState} from "../../../store";
import type {GenealogyViewerCloseSource} from "./GenealogyViewerDiagnostics";
import {formatWorldDate} from "../../../Simulation/WorldTime";

export default function GenealogyBrowser({open,onClose,dynasty,team,worldMonth,targetId}:{open:boolean;onClose:(source:GenealogyViewerCloseSource,reason?:string)=>void;dynasty?:Dynasty;team:RootState["root"]["teams"][number];worldMonth:number;targetId?:string}){
 const nav=usePersonArchiveNavigation();
 const [focus,setFocus]=useState(''),[expanded,setExpanded]=useState(new Set<string>()),[selected,setSelected]=useState<string>(),[scale,setScale]=useState(1);
 const [branchOffsets,setBranchOffsets]=useState(new Map<string,number>());
 const [locateRequest,setLocateRequest]=useState(0),[view,setView]=useState({left:0,top:0,width:1200,height:600});
 const viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null);
 const locatedRequest=useRef(0);
 const zoomAnchor=useRef<{left:number;top:number}>();
 const events=open?History.getEvents():[],people=open?Military.getPeople():[];
 const stamp=open?JSON.stringify([dynasty,History.getRevision(),people]):'';
 const data=useMemo(()=>{
  if(!open||!dynasty)return undefined;
  const index=indexGenealogy(buildRoyalArchiveGenealogy(dynasty,people,events));
  return {index,military:royalMilitaryArchive(dynasty,people,events),presentations:deriveGenealogyNodePresentations(dynasty,team,events,worldMonth)};
 },[open,stamp,worldMonth,team.name]);
 const rows=useMemo(()=>data?genealogyWindow(data.index,focus,expanded,branchOffsets):[],[data,focus,expanded,branchOffsets]);
 const heights=useMemo(()=>new Map(rows.map(({node})=>[node.ruler.id,genealogyCardHeight(true,!!data?.presentations.get(node.ruler.id)?.labels.length,!!data?.military.get(node.ruler.id))])),[rows,data]);
 const layout=useMemo(()=>layoutGenealogy(rows,heights),[rows,heights]);
 const visible=visibleGenealogyRows(rows,layout,view,focus),name=(r:{houseName:string;givenName:string})=>r.houseName.replace(/氏$/,'')+r.givenName;
 const readViewport=()=>{const v=viewport.current;if(v)setView({left:v.scrollLeft/scale,top:v.scrollTop/scale,width:v.clientWidth/scale,height:v.clientHeight/scale});};
 const locate=(id:string)=>{if(!data?.index.has(id))return;setFocus(id);setLocateRequest(n=>n+1);};
 useEffect(()=>{if(!open||!data)return;setFocus(targetId??dynasty?.currentRulerId??'');setExpanded(new Set());setSelected(undefined);setBranchOffsets(new Map());if(targetId)setLocateRequest(n=>n+1);},[open,targetId,team.name]);
 useLayoutEffect(()=>{if(!open)return;const v=viewport.current;if(!v)return;const observer=new ResizeObserver(readViewport);observer.observe(v);readViewport();return ()=>observer.disconnect();},[open,scale]);
 useLayoutEffect(()=>{if(!open||!locateRequest||locatedRequest.current===locateRequest)return;const p=layout.positions.get(focus),v=viewport.current;if(!p||!v)return;locatedRequest.current=locateRequest;v.scrollTo({left:Math.max(0,p.x*scale-v.clientWidth/2),top:Math.max(0,(p.y+p.height/2)*scale-v.clientHeight/2)});readViewport();},[open,locateRequest,layout]);
 useLayoutEffect(()=>{const v=viewport.current,a=zoomAnchor.current;if(v&&a){v.scrollTo(a);zoomAnchor.current=undefined;}readViewport();},[scale]);
 const zoom=(next:number,x?:number,y?:number)=>{const v=viewport.current;if(!v)return;next=clampGenealogyScale(next);const cx=x??v.clientWidth/2,cy=y??v.clientHeight/2;zoomAnchor.current={left:(v.scrollLeft+cx)/scale*next-cx,top:(v.scrollTop+cy)/scale*next-cy};setScale(next);};
 useEffect(()=>{const v=viewport.current;if(!open||!v)return;const wheel=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=v.getBoundingClientRect();zoom(scale+(e.deltaY>0?-.1:.1),e.clientX-r.left,e.clientY-r.top);};v.addEventListener('wheel',wheel,{passive:false});return ()=>v.removeEventListener('wheel',wheel);},[open,scale]);
 const person=selected?data?.index.get(selected)?.ruler:undefined,service=person?data?.military.get(person.id):undefined;
 const edges=layout.edges.filter(e=>Math.max(e.y1,e.y2)>=view.top-100&&Math.min(e.y1,e.y2)<=view.top+view.height+100&&Math.max(e.x1,e.x2)>=view.left-100&&Math.min(e.x1,e.x2)<=view.left+view.width+100);
 return <Dialog open={open} onClose={(_,reason)=>onClose(reason==='escapeKeyDown'?'ESCAPE':'BACKDROP',reason)} fullWidth maxWidth="xl" PaperProps={{sx:{width:'90vw',height:'84vh',maxWidth:1500,display:'flex',flexDirection:'column'}}}>
  <DialogTitle sx={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:1,py:1}}>
   <Typography variant="h6">完整宗谱</Typography><Box sx={{display:'flex',gap:.5,flexWrap:'wrap'}}>
    <Button size="small" onClick={()=>zoom(scale-.1)}>－</Button><Button size="small" onClick={()=>zoom(1)}>{Math.round(scale*100)}%</Button><Button size="small" onClick={()=>zoom(scale+.1)}>＋</Button>
    <Button size="small" onClick={()=>{zoom(getGenealogyFitScale(layout.width,layout.height,viewport.current?.clientWidth??0,viewport.current?.clientHeight??0));zoomAnchor.current={left:0,top:0};viewport.current?.scrollTo({left:0,top:0});readViewport();}}>适应窗口</Button>
    <Button size="small" onClick={()=>dynasty?.currentRulerId&&locate(dynasty.currentRulerId)}>定位当今君主</Button>
<Button size="small" onClick={()=>onClose('EXPLICIT')}>关闭</Button>
   </Box>
  </DialogTitle>
  {person&&<Box data-genealogy-person={person.id} sx={{mx:2,mb:1,p:1,border:'1px solid var(--gg-border)',flexShrink:0,}}>
   <Box sx={{display:'flex',justifyContent:'space-between'}}><Typography fontWeight="bold">王室身份：{name(person)}</Typography><Button size="small" onClick={()=>setSelected(undefined)}>收起资料</Button></Box>
   <Typography fontSize=".75rem">{person.parentId&&data?.index.get(person.parentId)?'父系：'+name(data.index.get(person.parentId)!.ruler):person.parentId?'父系档案未载':'父系未载'} · {formatRulerLifeAge(person,worldMonth,false,team.status!=='EXTINCT')}</Typography>
   <PersonLifeDates bornMonth={person.bornYear} deathMonth={person.deathMonth}/>
   {person.accessionYear!==undefined&&<Typography fontSize=".75rem">政治任期：{formatWorldDate(person.accessionYear)}—{person.endYear===undefined?'今':formatWorldDate(person.endYear)}</Typography>}
   {service&&<Typography fontSize=".75rem">{royalMilitaryOfficeLabel(service,worldMonth)}</Typography>}
   {service?.appointments.slice(-1).map(a=><Typography fontSize=".75rem" key={a.commandId}>军职任期：{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?'今':formatWorldDate(a.endMonth)}</Typography>)}
   {person.reignOrdinal!==undefined&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'RULER',factionId:dynasty!.factionId,id:person.id});}}>查看王室本纪</Button>}
   {service&&<Button size="small" onClick={()=>{onClose('EXPLICIT');nav.open({kind:'MILITARY',factionId:dynasty!.factionId,id:service.personId});}}>查看军旅档案</Button>}
  </Box>}
  <DialogContent ref={viewport} onScroll={readViewport} sx={{p:0,overflow:'auto',minHeight:0}}>
   <Box sx={{position:'relative',width:layout.width*scale,height:layout.height*scale,minWidth:'100%',minHeight:'100%'}}>
    <Box ref={canvas} role="tree" sx={{position:'absolute',left:0,top:0,width:layout.width,height:layout.height,transform:`scale(${scale})`,transformOrigin:'top left'}}>
     <svg aria-hidden="true" width={layout.width} height={layout.height} style={{position:'absolute',inset:0,pointerEvents:'none'}}>{edges.map(e=><path key={e.childId} data-parent-id={e.parentId} data-child-id={e.childId} data-x1={e.x1} data-y1={e.y1} data-x2={e.x2} data-y2={e.y2} d={e.path} fill="none" stroke="var(--gg-text-muted)"/>)}</svg>
     {visible.map(({node,depth,hiddenChildren})=>{const r=node.ruler,p=data?.military.get(r.id),position=layout.positions.get(r.id)!;return <Box key={r.id} role="treeitem" aria-level={depth+1} data-ruler-id={r.id} data-genealogy-focused={r.id===focus?'true':undefined} sx={{position:'absolute',left:position.x-GENEALOGY_CARD_WIDTH/2,top:position.y,width:GENEALOGY_CARD_WIDTH,outline:r.id===focus?'2px solid var(--gg-accent)':undefined,borderRadius:1}}>
      <button type="button" data-genealogy-card style={{border:0,padding:0,background:'none',cursor:'pointer',display:'block'}} onClick={()=>setSelected(r.id)} aria-label={`查看${name(r)}王室身份`}><GenealogyPersonCard compact ruler={r} displayName={name(r)} presentation={data?.presentations.get(r.id)} worldMonth={worldMonth} managedLife={team.status!=='EXTINCT'} militaryLabel={p?royalMilitaryOfficeLabel(p,worldMonth):undefined}/></button>
      {node.children.length>1&&(hiddenChildren>0||expanded.has(r.id))&&<Button size="small" sx={{position:'absolute',right:0,top:position.height,minWidth:0,fontSize:10,py:0}} aria-expanded={expanded.has(r.id)} onClick={()=>setExpanded(s=>{const next=new Set(s);next.has(r.id)?next.delete(r.id):next.add(r.id);return next;})}>{expanded.has(r.id)?'收起旁系':`旁系 +${hiddenChildren}`}</Button>}
      {expanded.has(r.id)&&node.children.length>10&&<Button size="small" sx={{position:'absolute',left:0,top:position.height,fontSize:10,py:0}} onClick={()=>setBranchOffsets(s=>{const next=new Map(s);next.set(r.id,((s.get(r.id)??0)+10)%node.children.length);return next;})}>其他旁系</Button>}
     </Box>;})}
    </Box>
   </Box>
  </DialogContent>
 </Dialog>;
}
