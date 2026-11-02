import {layoutGenealogyNodes,GENEALOGY_CARD_WIDTH} from './genealogyLayout';
import type {MilitaryFamily,MilitaryFamilyMember} from '../../../Politics/MilitaryFamily';
export const FAMILY_CARD_WIDTH=GENEALOGY_CARD_WIDTH,FAMILY_CARD_HEIGHT=130;
export function associatedMilitaryFamilies(families:readonly MilitaryFamily[],factionId:string,people:readonly {personId:string;appointments:readonly {factionId:string}[]}[]){
 const served=new Set(people.filter(p=>p.appointments.some(a=>a.factionId===factionId)).map(p=>p.personId));
 return families.filter(f=>f.factionId===factionId||f.members.some(m=>m.militaryPersonId&&served.has(m.militaryPersonId)));
}
/** Read-only non-royal genealogy. Stable IDs, never names, define edges. */
function layoutFamilyNodes<T extends {memberId:string;parentMemberId?:string;bornMonth:number}>(members:readonly T[],collapsed:ReadonlySet<string>=new Set(),heights?:ReadonlyMap<string,number>){
 const byId=new Map(members.map(m=>[m.memberId,m])),children=new Map<string,T[]>();
 for(const m of members)if(m.parentMemberId&&byId.has(m.parentMemberId)){const list=children.get(m.parentMemberId)??[];list.push(m);children.set(m.parentMemberId,list);}
 for(const list of children.values())list.sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId));
 const roots=members.filter(m=>!m.parentMemberId||!byId.has(m.parentMemberId)),rows:Array<{id:string;parentId?:string;depth:number}>=[],visited=new Set<string>(),stack=roots.map(m=>({m,depth:0})).reverse();
 while(stack.length){const {m,depth}=stack.pop()!;if(visited.has(m.memberId))continue;visited.add(m.memberId);rows.push({id:m.memberId,parentId:m.parentMemberId,depth});if(!collapsed.has(m.memberId))for(const c of [...children.get(m.memberId)??[]].reverse())stack.push({m:c,depth:depth+1});}
 const layout=layoutGenealogyNodes(rows,new Map(rows.map(r=>[r.id,heights?.get(r.id)??FAMILY_CARD_HEIGHT])));
 return {...layout,nodes:rows.map(r=>({member:byId.get(r.id)!,...layout.positions.get(r.id)!,children:children.get(r.id)?.length??0})),edges:layout.edges};
}
export function layoutMilitaryFamily(members:readonly MilitaryFamilyMember[],collapsed:ReadonlySet<string>=new Set(),heights?:ReadonlyMap<string,number>){return layoutFamilyNodes(members,collapsed,heights);}
export function visibleFamilyNodes<T extends {x:number;y:number}>(nodes:readonly T[],view:{left:number;top:number;width:number;height:number},scale:number){
 return nodes.filter(n=>n.x+FAMILY_CARD_WIDTH/2>=view.left/scale-212&&n.x-FAMILY_CARD_WIDTH/2<=(view.left+view.width)/scale+212&&n.y+FAMILY_CARD_HEIGHT>=view.top/scale-160&&n.y<=(view.top+view.height)/scale+160);
}

/** Main view retains only historical people and their true parent bridges; no placeholder nodes. */
export function projectFamilyTrunk(members:readonly MilitaryFamilyMember[],important:ReadonlySet<string>,full=false){
 const byId=new Map(members.map(m=>[m.memberId,m])),keep=new Set<string>();
 for(const m of members)if(full||important.has(m.memberId)||m.source==='FOUNDER'){
  let current:MilitaryFamilyMember|undefined=m;const seen=new Set<string>();
  while(current&&!seen.has(current.memberId)){seen.add(current.memberId);keep.add(current.memberId);current=current.parentMemberId?byId.get(current.parentMemberId):undefined;}
 }
 return {members:members.filter(m=>keep.has(m.memberId))};
}
export function layoutFamilyArchive(projection:ReturnType<typeof projectFamilyTrunk>,collapsed:ReadonlySet<string>,heights?:ReadonlyMap<string,number>){return layoutMilitaryFamily(projection.members,collapsed,heights);}
