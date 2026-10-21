import {useEffect,useMemo,useRef,useState} from "react";
import {Box,Button,Dialog,DialogTitle,DialogContent,Typography,TextField} from "@mui/material";
import type {Dynasty} from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import History from "../../../History/WorldHistory";
import {buildRoyalArchiveGenealogy,royalMilitaryArchive,royalMilitaryOfficeLabel} from "../../../Politics/RoyalArchiveIdentity";
import {deriveGenealogyNodePresentations} from "./GenealogyNodePresentation";
import {GenealogyPersonCard} from "./GenealogyPersonCard";
import {indexGenealogy,genealogyWindow} from "./genealogyWindow";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";
import {clampGenealogyScale,getGenealogyFitScale} from "./genealogyViewport";
import PersonLifeDates from "./PersonLifeDates";
import {formatRulerLifeAge} from "./RoyalPresentation";
import type {RootState} from "../../../store";
import type {GenealogyViewerCloseSource} from "./GenealogyViewerDiagnostics";
import {formatWorldDate} from "../../../Simulation/WorldTime";

export default function GenealogyBrowser({open,onClose,dynasty,team,worldMonth,targetId}:{open:boolean;onClose:(source:GenealogyViewerCloseSource,reason?:string)=>void;dynasty?:Dynasty;team:RootState["root"]["teams"][number];worldMonth:number;targetId?:string}){
 const nav=usePersonArchiveNavigation(),[focus,setFocus]=useState(""),[query,setQuery]=useState(""),[expanded,setExpanded]=useState(new Set<string>()),[selected,setSelected]=useState<string>(),[scale,setScale]=useState(1);
 const [browse,setBrowse]=useState(false),[searchOffset,setSearchOffset]=useState(0);
 const viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null);
 const events=open?History.getEvents():[],people=open?Military.getPeople():[];
 const stamp=open?JSON.stringify([dynasty,History.getRevision(),people]):"";
 const data=useMemo(()=>{
  if(!open||!dynasty)return undefined;
  const index=indexGenealogy(buildRoyalArchiveGenealogy(dynasty,people,events));
  return {index,military:royalMilitaryArchive(dynasty,people,events),presentations:deriveGenealogyNodePresentations(dynasty,team,events,worldMonth)};
 },[open,stamp,worldMonth,team.name]);
 const locate=(id:string)=>{if(!data?.index.has(id))return;setFocus(id);setSelected(id);setExpanded(new Set([id]));};
 useEffect(()=>{if(open&&data)locate(targetId??dynasty?.currentRulerId??data.index.keys().next().value??"");},[open,targetId,team.name]);
 useEffect(()=>{if(open)canvas.current?.querySelector<HTMLElement>('[data-genealogy-focused="true"]')?.scrollIntoView({block:"center",inline:"nearest"});},[open,focus]);
 const rows=data?genealogyWindow(data.index,focus,expanded):[];
 const allMatches=data&&(query||browse)?[...data.index.values()].filter(n=>`${n.ruler.houseName}${n.ruler.givenName} ${n.ruler.id}`.includes(query)):[];
 const matches=allMatches.slice(searchOffset,searchOffset+30);
 const person=selected?data?.index.get(selected)?.ruler:undefined,service=person?data?.military.get(person.id):undefined;
 return <Dialog open={open} onClose={(_,reason)=>onClose(reason==="escapeKeyDown"?"ESCAPE":"BACKDROP",reason)} fullWidth maxWidth="xl" PaperProps={{sx:{width:"90vw",height:"84vh",maxWidth:1500,display:"flex",flexDirection:"column"}}}>
  <DialogTitle><Typography variant="h6">完整宗谱</Typography><Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}>
   <Button onClick={()=>setScale(s=>clampGenealogyScale(s-.1))}>－</Button><Button onClick={()=>setScale(1)}>{Math.round(scale*100)}%</Button><Button onClick={()=>setScale(s=>clampGenealogyScale(s+.1))}>＋</Button>
   <Button onClick={()=>setScale(getGenealogyFitScale(canvas.current?.scrollWidth??0,canvas.current?.scrollHeight??0,viewport.current?.clientWidth??0,viewport.current?.clientHeight??0))}>适应窗口</Button>
   <Button onClick={()=>dynasty?.currentRulerId&&locate(dynasty.currentRulerId)}>定位当今君主</Button><Button onClick={()=>setExpanded(new Set())}>收起分支</Button><Button onClick={()=>onClose("EXPLICIT")}>关闭</Button>
  </Box><TextField size="small" label="检索全部人物（姓名或永久ID）" value={query} onChange={e=>{setQuery(e.target.value);setSearchOffset(0);}}/>
  <Button onClick={()=>{setBrowse(b=>!b);setSearchOffset(0);}}>浏览全部人物</Button>
  {searchOffset>0&&<Button onClick={()=>setSearchOffset(n=>Math.max(0,n-30))}>先前匹配人物</Button>}
  {searchOffset+30<allMatches.length&&<Button onClick={()=>setSearchOffset(n=>n+30)}>后续匹配人物（共{allMatches.length}人）</Button>}
  {matches.map(n=><Button key={n.ruler.id} onClick={()=>{locate(n.ruler.id);setQuery("");setBrowse(false);setSearchOffset(0);}}>{n.ruler.houseName.replace(/氏$/,"")+n.ruler.givenName} · {n.ruler.id}</Button>)}
  <Typography fontSize="0.75rem">完整收录{data?.index.size??0}人，当前分支显示{rows.length}人。检索覆盖全部历史人物；点击“查看此支”浏览其他支系。</Typography>
  </DialogTitle>
  <DialogContent ref={viewport} sx={{overflow:"auto",minHeight:0}}>
   {person&&<Box data-genealogy-person={person.id} sx={{position:"sticky",top:0,zIndex:2,background:"var(--gg-panel)",mb:1,p:1,border:"1px solid var(--gg-border)"}}><Typography fontWeight="bold">王室身份：{person.houseName.replace(/氏$/,"")+person.givenName}</Typography><Typography fontSize="0.75rem">永久ID：{person.id}</Typography><Typography fontSize="0.75rem">{person.parentId&&data?.index.get(person.parentId)?"父系："+data.index.get(person.parentId)!.ruler.houseName.replace(/氏$/,"")+data.index.get(person.parentId)!.ruler.givenName:person.parentId?"父系档案断链":"父系未载"}</Typography>{service&&<Typography fontSize="0.75rem">{royalMilitaryOfficeLabel(service,worldMonth)}</Typography>}<PersonLifeDates bornMonth={person.bornYear} deathMonth={person.deathMonth}/><Typography>{formatRulerLifeAge(person,worldMonth,false,team.status!=="EXTINCT")}</Typography>
    {person.accessionYear!==undefined&&<Typography>政治任期：{formatWorldDate(person.accessionYear)}—{person.endYear===undefined?"今":formatWorldDate(person.endYear)}</Typography>}
    {service?.appointments.map(a=><Typography key={a.commandId}>军职任期：{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?"今":formatWorldDate(a.endMonth)}</Typography>)}
    {person.reignOrdinal!==undefined&&<Button onClick={()=>{onClose("EXPLICIT");nav.open({kind:"RULER",factionId:dynasty!.factionId,id:person.id});}}>查看王室本纪</Button>}
    {service&&<Button onClick={()=>{onClose("EXPLICIT");nav.open({kind:"MILITARY",factionId:dynasty!.factionId,id:service.personId});}}>查看军旅档案</Button>}
   </Box>}
   <Box ref={canvas} role="tree" sx={{transform:`scale(${scale})`,transformOrigin:"top left",width:Math.min(1000,1000/scale)}}>
    {rows.map(({node,depth,ancestor})=>{const r=node.ruler,p=data?.military.get(r.id),parent=r.parentId&&data?.index.get(r.parentId);return <Box role="treeitem" key={r.id} data-ruler-id={r.id} data-genealogy-focused={r.id===focus?"true":undefined} sx={{ml:Math.min(depth,6)*2,my:.7,pl:1,borderLeft:parent?"1px solid var(--gg-border)":undefined}}>
     <button type="button" style={{border:0,padding:0,background:"none",textAlign:"left",cursor:"pointer"}} onClick={()=>setSelected(r.id)} aria-label={`查看${r.houseName.replace(/氏$/,"")+r.givenName}王室身份`}><GenealogyPersonCard ruler={r} displayName={r.houseName.replace(/氏$/,"")+r.givenName} presentation={data?.presentations.get(r.id)} worldMonth={worldMonth} managedLife={team.status!=="EXTINCT"}/></button>
     {p&&<Typography fontSize="0.75rem">{royalMilitaryOfficeLabel(p,worldMonth)} · {p.status==="DEAD"?"已故":p.status==="ACTIVE"?"现役":"已离任"}</Typography>}
     <Typography fontSize="0.72rem">{parent?`父系：${parent.ruler.houseName.replace(/氏$/,"")+parent.ruler.givenName}`:r.parentId?"父系档案断链":"父系未载"}</Typography>
     <Button size="small" onClick={()=>locate(r.id)}>查看此支</Button>
     {!ancestor&&node.children.length>0&&<Button size="small" aria-expanded={expanded.has(r.id)} onClick={()=>setExpanded(s=>{const next=new Set(s);next.has(r.id)?next.delete(r.id):next.add(r.id);return next;})}>{expanded.has(r.id)?"收起":"展开子支"}（{node.children.length}）</Button>}
     {p&&<Button size="small" onClick={()=>{onClose("EXPLICIT");nav.open({kind:"MILITARY",factionId:dynasty!.factionId,id:p.personId});}}>查看军旅档案</Button>}
    </Box>;})}
   </Box>

  </DialogContent>
 </Dialog>;
}
