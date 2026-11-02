import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
import {layoutGenealogyNodes,GENEALOGY_WINDOW_LIMIT} from './genealogyLayout';
export {GENEALOGY_WINDOW_LIMIT,GENEALOGY_CARD_WIDTH,GENEALOGY_SIBLING_GAP,GENEALOGY_GENERATION_GAP} from './genealogyLayout';
export function genealogyCardHeight(age:boolean,labels:boolean,military:boolean){return 14+20+16+(age?16:0)+(labels?16:0)+(military?16:0);}
export function indexGenealogy(roots:readonly PoliticalGenealogyNode[]){
 const result=new Map<string,PoliticalGenealogyNode>(),stack=[...roots];
 while(stack.length){const n=stack.pop()!;if(result.has(n.ruler.id))continue;result.set(n.ruler.id,n);for(const c of n.children)stack.push(c);}
 return result;
}
export interface GenealogyRow {node:PoliticalGenealogyNode;depth:number;ancestor:boolean;hiddenChildren:number;}
/** All monarchs and their recorded ancestors stay in the layout. Only wide parallel
 * branches are grouped; targeting one opens its original path, without recentering the tree. */
export function genealogyWindow(index:ReadonlyMap<string,PoliticalGenealogyNode>,focusId:string,expanded:ReadonlySet<string>,branchOffsets:ReadonlyMap<string,number>=new Map(),militaryIds:ReadonlySet<string>=new Set()){
 const parents=new Map<string,string>(),roots:PoliticalGenealogyNode[]=[],visited=new Set<string>();
 const childIds=new Set([...index.values()].flatMap(n=>n.children.filter(c=>c.ruler.parentId===n.ruler.id).map(c=>c.ruler.id)));
 const attach=(root:PoliticalGenealogyNode)=>{if(visited.has(root.ruler.id))return;roots.push(root);visited.add(root.ruler.id);const stack=[root];while(stack.length){const n=stack.pop()!;for(const c of n.children){if(c.ruler.parentId!==n.ruler.id||visited.has(c.ruler.id))continue;parents.set(c.ruler.id,n.ruler.id);visited.add(c.ruler.id);stack.push(c);}}};
 for(const n of index.values())if(!childIds.has(n.ruler.id))attach(n);
 for(const n of index.values())attach(n); // retain malformed disconnected components, without inventing edges
 const required=new Set<string>(),focusPath=new Set<string>();
 const include=(id:string,set:Set<string>)=>{while(index.has(id)&&!set.has(id)){set.add(id);const p=parents.get(id);if(!p)break;id=p;}};
 for(const n of index.values())if(n.ruler.reignOrdinal!==undefined||n.ruler.status==='heir')include(n.ruler.id,required);
 include(focusId,required);include(focusId,focusPath);
 const royalRequired=new Set(required),distance=new Map<string,number>();
 // Cache ancestor distances: many military relatives may share a very deep branch.
 for(const start of militaryIds){let id=start;const path:string[]=[];
  while(index.has(id)&&!royalRequired.has(id)&&!distance.has(id)){path.push(id);const p=parents.get(id);if(!p){id='';break;}id=p;}
  let depth=distance.get(id)??0;for(let i=path.length-1;i>=0;i--)distance.set(path[i],++depth);
 }
 let budget=64;
 for(const start of [...militaryIds].sort((a,b)=>(distance.get(a)??0)-(distance.get(b)??0)||a.localeCompare(b))){
  if(!budget)break;let id=start;const path:string[]=[];
  while(index.has(id)&&!required.has(id)&&path.length<=budget){path.push(id);const p=parents.get(id);if(!p)break;id=p;}
  if(path.length>budget)continue;for(const p of path)required.add(p);budget-=path.length;
 }

 const rows:GenealogyRow[]=[],stack=roots.slice().reverse().map(node=>({node,depth:0}));
 while(stack.length){const {node,depth}=stack.pop()!;
  const children=node.children.filter(c=>parents.get(c.ruler.id)===node.ruler.id);
  const opened=expanded.has(node.ruler.id)||(!node.ruler.militaryIdentity&&children.length===1);
  const requested=children.filter(c=>required.has(c.ruler.id)||opened);
  // Real worlds rarely reach this breadth. Keep the continuous royal path and a compact sibling group.
  const offset=branchOffsets.get(node.ruler.id)??0,ordered=offset?[...requested.slice(offset),...requested.slice(0,offset)]:requested;
  const selected=requested.length>10?ordered.slice().sort((a,b)=>Number(focusPath.has(b.ruler.id))-Number(focusPath.has(a.ruler.id))||Number(royalRequired.has(b.ruler.id))-Number(royalRequired.has(a.ruler.id))).slice(0,10):requested;
  rows.push({node,depth,ancestor:focusPath.has(node.ruler.id)&&node.ruler.id!==focusId,hiddenChildren:children.length-selected.length});
  for(let i=selected.length-1;i>=0;i--)stack.push({node:selected[i],depth:depth+1});
 }
 return rows;
}
/** Coordinates use the same explicit line boxes as the cards; connectors touch
 * their actual borders. No fixed y+180 offsets, recursive DOM, or truncated generations. */
export function layoutGenealogy(rows:GenealogyRow[],heights:ReadonlyMap<string,number>=new Map()){
 return layoutGenealogyNodes(rows.map(r=>({id:r.node.ruler.id,parentId:r.node.ruler.parentId,depth:r.depth})),heights);
}
export function visibleGenealogyRows(rows:GenealogyRow[],layout:ReturnType<typeof layoutGenealogy>,view:{left:number;top:number;width:number;height:number},focusId?:string){
 const margin=100;
 const visible=rows.filter(r=>{const p=layout.positions.get(r.node.ruler.id)!;return p.y+p.height>=view.top-margin&&p.y<=view.top+view.height+margin&&p.x+80>=view.left-margin&&p.x-80<=view.left+view.width+margin;});
 if(visible.length<=GENEALOGY_WINDOW_LIMIT)return visible;
 const distance=(r:GenealogyRow)=>{const p=layout.positions.get(r.node.ruler.id)!;return Math.abs(p.y+p.height/2-view.top-view.height/2);};
 return visible.sort((a,b)=>Number(b.node.ruler.id===focusId)-Number(a.node.ruler.id===focusId)||distance(a)-distance(b)).slice(0,GENEALOGY_WINDOW_LIMIT);
}
