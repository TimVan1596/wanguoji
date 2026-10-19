import type {MilitaryFormation,MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
export interface MilitaryPersonSelection {
  scope:string;anchor?:MilitaryPerson;focusedId?:string;expandedIds:string[];manualExpandedIds:string[];
}
const equal=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);
/** All verified current commanders are open; historical rows remain independent of map focus. */
export function reconcileMilitaryPersonSelection(state:MilitaryPersonSelection|undefined,scope:string,people:MilitaryPerson[],formations:MilitaryFormation[],liveIds:Set<string>):MilitaryPersonSelection{
  const active=people.filter(p=>p.factionId===scope&&p.status==="ACTIVE"&&liveIds.has(p.personId)&&formations.some(f=>f.status==="ACTIVE"&&f.commanderPersonId===p.personId&&f.factionId===scope)).map(p=>p.personId);
  if(!state||state.scope!==scope||(state.anchor&&!people.includes(state.anchor))||(!state.anchor&&people.length))
    return {scope,anchor:people[0],focusedId:active[0],expandedIds:active,manualExpandedIds:[]};
  const manualExpandedIds=state.manualExpandedIds.filter(id=>people.some(p=>p.personId===id)&&!active.includes(id));
  const expandedIds=[...active,...manualExpandedIds],focusedId=active.includes(state.focusedId??"")?state.focusedId:active[0];
  return focusedId===state.focusedId&&equal(expandedIds,state.expandedIds)&&equal(manualExpandedIds,state.manualExpandedIds)?state:{...state,expandedIds,manualExpandedIds,focusedId};
}
export function toggleMilitaryPerson(state:MilitaryPersonSelection,id:string,active=false):MilitaryPersonSelection{
  if(active)return {...state,focusedId:id};
  const manualExpandedIds=state.manualExpandedIds.includes(id)?state.manualExpandedIds.filter(x=>x!==id):[...state.manualExpandedIds,id];
  return {...state,manualExpandedIds,expandedIds:state.expandedIds.includes(id)?state.expandedIds.filter(x=>x!==id):[...state.expandedIds,id]};
}
