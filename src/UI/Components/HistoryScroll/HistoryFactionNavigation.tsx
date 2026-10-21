import {createContext,useCallback,useContext,useState,type ReactNode,type MouseEvent} from "react";
import {Menu,MenuItem} from "@mui/material";
import {useDispatch} from "react-redux";
import {setSelectedFactionName,setFactionDetailTab,setRightPanelTab} from "../../../store/rootSlice";

const MenuContext=createContext<((anchor:HTMLElement,id:string)=>void)|undefined>(undefined);
export const MentionContext=createContext<{ids:Map<string,string>;protectedNames:string[]}>({ids:new Map(),protectedNames:[]});
/** One menu per list. Opening it leaves the memoized list and its event projections untouched. */
export function HistoryFactionNavigation({factions,children}:{factions:ReadonlyMap<string,unknown>;children:ReactNode}){
 const dispatch=useDispatch(),[target,setTarget]=useState<{anchor:HTMLElement;id:string}>();
 const open=useCallback((anchor:HTMLElement,id:string)=>{if(factions.has(id))setTarget({anchor,id});},[factions]);
 const select=(tab:"overview"|"house"|"military")=>{if(target&&factions.has(target.id)){dispatch(setSelectedFactionName(target.id));dispatch(setFactionDetailTab(tab));dispatch(setRightPanelTab("faction"));}setTarget(undefined);};
 return <MenuContext.Provider value={open}>{children}<Menu anchorEl={target?.anchor} open={!!target} onClose={()=>setTarget(undefined)} onClick={e=>e.stopPropagation()}>
  <MenuItem onClick={()=>select("overview")}>势力概览</MenuItem><MenuItem onClick={()=>select("house")}>王室</MenuItem><MenuItem onClick={()=>select("military")}>军政人物</MenuItem>
 </Menu></MenuContext.Provider>;
}
export function FactionMention({name,id,color}:{name:string;id?:string;color:string}){
 const open=useContext(MenuContext);
 if(!id||!open)return <span style={{color,fontWeight:"bold"}}>{name}</span>;
 const click=(event:MouseEvent<HTMLButtonElement>)=>{event.stopPropagation();open(event.currentTarget,id);};
 return <button type="button" aria-label={`查看${name}势力档案`} aria-haspopup="menu" onClick={click} onKeyDown={e=>e.stopPropagation()} style={{color,fontWeight:"bold",font:"inherit",border:0,padding:0,background:"none",cursor:"pointer",textDecoration:"underline",textUnderlineOffset:"2px"}}>{name}</button>;
}
