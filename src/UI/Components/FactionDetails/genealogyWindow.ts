import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
// This is a DOM budget, never a limit on the recorded royal trunk.
export const GENEALOGY_WINDOW_LIMIT=150;
export const GENEALOGY_CARD_WIDTH=160;
export const GENEALOGY_SIBLING_GAP=20;
export const GENEALOGY_GENERATION_GAP=40;
export function genealogyCardHeight(age:boolean,labels:boolean,military:boolean){return 14+20+16+(age?16:0)+(labels?16:0)+(military?16:0);}
export function indexGenealogy(roots:readonly PoliticalGenealogyNode[]){
 const result=new Map<string,PoliticalGenealogyNode>(),stack=[...roots];
 while(stack.length){const n=stack.pop()!;if(result.has(n.ruler.id))continue;result.set(n.ruler.id,n);for(const c of n.children)stack.push(c);}
 return result;
}
export interface GenealogyRow {node:PoliticalGenealogyNode;depth:number;ancestor:boolean;hiddenChildren:number;}
/** All monarchs and their recorded ancestors stay in the layout. Only wide parallel
 * branches are grouped; targeting one opens its original path, without recentering the tree. */
export function genealogyWindow(index:ReadonlyMap<string,PoliticalGenealogyNode>,focusId:string,expanded:ReadonlySet<string>){
 const parents=new Map<string,string>(),roots:PoliticalGenealogyNode[]=[],visited=new Set<string>();
 const childIds=new Set([...index.values()].flatMap(n=>n.children.filter(c=>c.ruler.parentId===n.ruler.id).map(c=>c.ruler.id)));
 const attach=(root:PoliticalGenealogyNode)=>{if(visited.has(root.ruler.id))return;roots.push(root);visited.add(root.ruler.id);const stack=[root];while(stack.length){const n=stack.pop()!;for(const c of n.children){if(c.ruler.parentId!==n.ruler.id||visited.has(c.ruler.id))continue;parents.set(c.ruler.id,n.ruler.id);visited.add(c.ruler.id);stack.push(c);}}};
 for(const n of index.values())if(!childIds.has(n.ruler.id))attach(n);
 for(const n of index.values())attach(n); // retain malformed disconnected components, without inventing edges
 const required=new Set<string>(),focusPath=new Set<string>();
 const include=(id:string,set:Set<string>)=>{while(index.has(id)&&!set.has(id)){set.add(id);const p=parents.get(id);if(!p)break;id=p;}};
 for(const n of index.values())if(n.ruler.reignOrdinal!==undefined||n.ruler.status==='heir')include(n.ruler.id,required);
 include(focusId,required);include(focusId,focusPath);
 const rows:GenealogyRow[]=[],stack=roots.slice().reverse().map(node=>({node,depth:0}));
 while(stack.length){const {node,depth}=stack.pop()!;
  const children=node.children.filter(c=>parents.get(c.ruler.id)===node.ruler.id);
  const opened=expanded.has(node.ruler.id)||(!node.ruler.militaryIdentity&&children.length===1);
  const requested=children.filter(c=>required.has(c.ruler.id)||opened);
  // Real worlds rarely reach this breadth. Keep the continuous royal path and a compact sibling group.
  const selected=requested.length>10?requested.slice().sort((a,b)=>Number(focusPath.has(b.ruler.id))-Number(focusPath.has(a.ruler.id))).slice(0,10):requested;
  rows.push({node,depth,ancestor:focusPath.has(node.ruler.id)&&node.ruler.id!==focusId,hiddenChildren:children.length-selected.length});
  for(let i=selected.length-1;i>=0;i--)stack.push({node:selected[i],depth:depth+1});
 }
 return rows;
}
/** Coordinates use the same explicit line boxes as the cards; connectors touch
 * their actual borders. No fixed y+180 offsets, recursive DOM, or truncated generations. */
export function layoutGenealogy(rows:GenealogyRow[],heights:ReadonlyMap<string,number>=new Map()){
 const byId=new Map(rows.map(r=>[r.node.ruler.id,r])),children=new Map<string,string[]>(),parents=new Map<string,string>();
 const levels=new Map<number,number>();
 for(const row of rows){const id=row.node.ruler.id,h=heights.get(id)??genealogyCardHeight(true,false,false);levels.set(row.depth,Math.max(levels.get(row.depth)??0,h));const p=row.node.ruler.parentId;if(p&&byId.has(p)&&byId.get(p)!.depth<row.depth){parents.set(id,p);const ids=children.get(p)??[];ids.push(id);children.set(p,ids);}}
 interface Contour {left:number;right:number;shift:number;next?:Contour;}
 const shift=(c:Contour,n:number):Contour=>n?{...c,shift:c.shift+n}:c;
 const separation=(a:Contour,b:Contour)=>{let x:Contour|undefined=a,y:Contour|undefined=b,dx=0,dy=0,gap=0;while(x&&y){dx+=x.shift;dy+=y.shift;gap=Math.max(gap,x.right+dx+GENEALOGY_SIBLING_GAP-y.left-dy);x=x.next;y=y.next;}return gap;};
 const merge=(a:Contour,b:Contour,offset:number)=>{let x:Contour|undefined=a,y:Contour|undefined=b,dx=0,dy=offset;const levels:Array<{left:number;right:number}>=[];while(x&&y){dx+=x.shift;dy+=y.shift;levels.push({left:Math.min(x.left+dx,y.left+dy),right:Math.max(x.right+dx,y.right+dy)});x=x.next;y=y.next;}let tail=x?shift(x,dx):y?shift(y,dy):undefined;for(let i=levels.length-1;i>=0;i--)tail={...levels[i],shift:0,next:tail};return tail!;};
 const contours=new Map<string,Contour>(),branchDepth=new Map<string,number>(),offsets=new Map<string,Array<{id:string;x:number}>>();
 const positions=new Map<string,{x:number;y:number;height:number}>(),ys=new Map<number,number>();let bottom=0;
 for(const depth of [...levels.keys()].sort((a,b)=>a-b)){ys.set(depth,bottom);bottom+=levels.get(depth)!+GENEALOGY_GENERATION_GAP;}
 for(const row of rows.slice().sort((a,b)=>b.depth-a.depth)){
  const id=row.node.ruler.id,ids=children.get(id)??[];let combined:Contour|undefined;const placement:Array<{id:string;x:number}>=[];
  for(const child of ids){const c=contours.get(child)!;const x=combined?separation(combined,c):0;placement.push({id:child,x});combined=combined?merge(combined,c,x):c;}
  const deepest=Math.max(0,...ids.map(id=>branchDepth.get(id)!)),dominant=ids.filter(id=>branchDepth.get(id)===deepest);
  // A continuing trunk stays vertical; short collateral leaves can reuse space in later generations.
  const center=deepest>1&&dominant.length===1?placement.find(p=>p.id===dominant[0])!.x:placement.length?(placement[0].x+placement.at(-1)!.x)/2:0;
  offsets.set(id,placement.map(p=>({...p,x:p.x-center})));branchDepth.set(id,deepest+1);
  contours.set(id,{left:-GENEALOGY_CARD_WIDTH/2,right:GENEALOGY_CARD_WIDTH/2,shift:0,next:combined?shift(combined,-center):undefined});
 }
 const roots=rows.filter(r=>!parents.has(r.node.ruler.id));let forest:Contour|undefined;
 const stack:Array<{id:string;x:number}>=[];
 for(const r of roots){const c=contours.get(r.node.ruler.id)!,x=forest?separation(forest,c):0;stack.push({id:r.node.ruler.id,x});forest=forest?merge(forest,c,x):c;}
 let min=0,max=GENEALOGY_CARD_WIDTH,c=forest,dx=0;while(c){dx+=c.shift;min=Math.min(min,c.left+dx);max=Math.max(max,c.right+dx);c=c.next;}
 while(stack.length){const {id,x}=stack.pop()!,r=byId.get(id)!;positions.set(id,{x:x-min+10,y:ys.get(r.depth)!,height:heights.get(id)??genealogyCardHeight(true,false,false)});for(const child of offsets.get(id)??[])stack.push({id:child.id,x:x+child.x});}
 const edges=rows.flatMap(row=>{const id=row.node.ruler.id,parentId=parents.get(id);if(!parentId)return [];const a=positions.get(parentId)!,b=positions.get(id)!,joint=b.y-GENEALOGY_GENERATION_GAP/2;return [{parentId,childId:id,x1:a.x,y1:a.y+a.height,x2:b.x,y2:b.y,joint,path:`M ${a.x} ${a.y+a.height} V ${joint} H ${b.x} V ${b.y}`}];});
 return {positions,parents,edges,width:max-min+20,height:Math.max(1,bottom-GENEALOGY_GENERATION_GAP)};
}
export function visibleGenealogyRows(rows:GenealogyRow[],layout:ReturnType<typeof layoutGenealogy>,view:{left:number;top:number;width:number;height:number}){
 const margin=100;
 return rows.filter(r=>{const p=layout.positions.get(r.node.ruler.id)!;return p.y+p.height>=view.top-margin&&p.y<=view.top+view.height+margin&&p.x+80>=view.left-margin&&p.x-80<=view.left+view.width+margin;}).slice(0,GENEALOGY_WINDOW_LIMIT);
}
