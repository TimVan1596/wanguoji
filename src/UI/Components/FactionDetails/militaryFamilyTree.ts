import type {MilitaryFamily,MilitaryFamilyMember} from '../../../Politics/MilitaryFamily';
export const FAMILY_CARD_WIDTH=188,FAMILY_CARD_HEIGHT=116;
export function associatedMilitaryFamilies(families:readonly MilitaryFamily[],factionId:string,people:readonly {personId:string;appointments:readonly {factionId:string}[]}[]){
 const served=new Set(people.filter(p=>p.appointments.some(a=>a.factionId===factionId)).map(p=>p.personId));
 return families.filter(f=>f.factionId===factionId||f.members.some(m=>m.militaryPersonId&&served.has(m.militaryPersonId)));
}
/** Read-only non-royal genealogy. Stable IDs, never names, define edges. */
export function layoutMilitaryFamily(members:readonly MilitaryFamilyMember[],collapsed:ReadonlySet<string>=new Set()){
 const byId=new Map(members.map(m=>[m.memberId,m])),children=new Map<string,MilitaryFamilyMember[]>();
 for(const m of members)if(m.parentMemberId&&byId.has(m.parentMemberId)){const list=children.get(m.parentMemberId)??[];list.push(m);children.set(m.parentMemberId,list);}
 for(const list of children.values())list.sort((a,b)=>a.bornMonth-b.bornMonth||a.memberId.localeCompare(b.memberId));
 const nodes:Array<{member:MilitaryFamilyMember;x:number;y:number;children:number}>=[],edges:Array<{parentId:string;childId:string;x1:number;y1:number;x2:number;y2:number}>=[],visited=new Set<string>();let leaf=0,maxDepth=0;
 function visit(m:MilitaryFamilyMember,depth:number):number{
  if(visited.has(m.memberId))return leaf*212+112;visited.add(m.memberId);maxDepth=Math.max(maxDepth,depth);
  const kids=collapsed.has(m.memberId)?[]:(children.get(m.memberId)??[]).filter(c=>!visited.has(c.memberId));
  const positions=kids.map(c=>({c,x:visit(c,depth+1)})),x=positions.length?(positions[0].x+positions.at(-1)!.x)/2:leaf++*212+112,y=24+depth*160;
  nodes.push({member:m,x,y,children:children.get(m.memberId)?.length??0});
  for(const p of positions)edges.push({parentId:m.memberId,childId:p.c.memberId,x1:x,y1:y+FAMILY_CARD_HEIGHT,x2:p.x,y2:y+160});return x;
 }
 for(const root of members.filter(m=>!m.parentMemberId||!byId.has(m.parentMemberId)))visit(root,0);
 return {nodes,edges,width:Math.max(420,leaf*212+32),height:(maxDepth+1)*160+40};
}
export function visibleFamilyNodes(nodes:ReturnType<typeof layoutMilitaryFamily>['nodes'],view:{left:number;top:number;width:number;height:number},scale:number){
 return nodes.filter(n=>n.x+FAMILY_CARD_WIDTH/2>=view.left/scale-212&&n.x-FAMILY_CARD_WIDTH/2<=(view.left+view.width)/scale+212&&n.y+FAMILY_CARD_HEIGHT>=view.top/scale-160&&n.y<=(view.top+view.height)/scale+160);
}
