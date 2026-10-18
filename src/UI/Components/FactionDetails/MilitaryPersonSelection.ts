import type {MilitaryFormation,MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
export interface MilitaryPersonSelection {scope:string;anchor?:MilitaryPerson;selectedId?:string;manual:boolean;}
export function reconcileMilitaryPersonSelection(state:MilitaryPersonSelection|undefined,scope:string,people:MilitaryPerson[],formations:MilitaryFormation[],liveIds:Set<string>){
  const defaultPerson=()=>people.find(p=>p.factionId===scope&&p.status==="ACTIVE"&&liveIds.has(p.personId)&&formations.some(f=>f.status==="ACTIVE"&&f.commanderPersonId===p.personId&&f.factionId===scope))
    ??people.find(p=>p.status==="RETIRED"&&liveIds.has(p.personId));
  if(!state||state.scope!==scope||(state.anchor&&!people.includes(state.anchor))||(!state.anchor&&people.length))
    return {scope,anchor:people[0],selectedId:defaultPerson()?.personId,manual:false};
  if(state.manual&&(!state.selectedId||people.some(p=>p.personId===state.selectedId)))return state;
  const selected=people.find(p=>p.personId===state.selectedId);
  if(selected&&selected.status!=="DEAD"&&liveIds.has(selected.personId)&&(selected.status!=="ACTIVE"||formations.some(f=>f.status==="ACTIVE"&&f.commanderPersonId===selected.personId)))return state;
  const selectedId=defaultPerson()?.personId;
  return state.selectedId===selectedId&&!state.manual?state:{...state,manual:false,selectedId};
}
export function toggleMilitaryPerson(state:MilitaryPersonSelection,id:string):MilitaryPersonSelection{
  return {...state,manual:true,selectedId:state.selectedId===id?undefined:id};
}
