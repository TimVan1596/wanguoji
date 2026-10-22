import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
export const GENEALOGY_WINDOW_LIMIT=150;
export function indexGenealogy(roots:readonly PoliticalGenealogyNode[]){
 const result=new Map<string,PoliticalGenealogyNode>(),stack=[...roots];
 while(stack.length){const n=stack.pop()!;if(result.has(n.ruler.id))continue;result.set(n.ruler.id,n);for(const c of n.children)stack.push(c);}
 return result;
}
/** A bounded real family branch: ancestors, nearby siblings, and explicitly opened descendants. */
export function genealogyWindow(index:ReadonlyMap<string,PoliticalGenealogyNode>,focusId:string,expanded:ReadonlySet<string>){
 const focus=index.get(focusId);if(!focus)return [];
 const ancestors:PoliticalGenealogyNode[]=[],seen=new Set([focusId]);let parent=focus.ruler.parentId;
 while(parent&&ancestors.length<8&&!seen.has(parent)){const n=index.get(parent);if(!n)break;seen.add(parent);ancestors.push(n);parent=n.ruler.parentId;}
 const rows=ancestors.reverse().map((node,depth)=>({node,depth,ancestor:true}));
 const rank=(n:PoliticalGenealogyNode)=>n.ruler.reignOrdinal===undefined?1:0;
 const siblings=focus.ruler.parentId?index.get(focus.ruler.parentId)?.children??[]:[];
 const nearby=siblings.filter(n=>n!==focus).sort((a,b)=>rank(a)-rank(b)).slice(0,2);
 const stack=[...nearby,{...focus}].reverse().map(node=>({node,depth:ancestors.length,ancestor:false}));
 let leaves=nearby.length+1;
 while(stack.length&&rows.length<GENEALOGY_WINDOW_LIMIT){const row=stack.pop()!;if(rows.some(r=>r.node.ruler.id===row.node.ruler.id))continue;rows.push(row);
  if(expanded.has(row.node.ruler.id)&&row.depth<12){
   const children=row.node.children.slice().sort((a,b)=>rank(a)-rank(b)).slice(0,Math.min(5,9-leaves));
   leaves+=Math.max(0,children.length-1);
   for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],depth:row.depth+1,ancestor:false});
  }
 }
 return rows;
}

/** Flat DOM with top-down coordinates and parent links; no recursive React hierarchy. */
export function layoutGenealogy(rows:ReturnType<typeof genealogyWindow>){
 const byId=new Map(rows.map(r=>[r.node.ruler.id,r]));
 const children=new Map<string,string[]>(),parents=new Map<string,string>();
 for(const row of rows){const p=row.node.ruler.parentId;if(p&&byId.has(p)&&byId.get(p)!.depth<row.depth){parents.set(row.node.ruler.id,p);const ids=children.get(p)??[];ids.push(row.node.ruler.id);children.set(p,ids);}}
 const widths=new Map<string,number>(),positions=new Map<string,{x:number;y:number}>();
 const ordered=rows.slice().sort((a,b)=>b.depth-a.depth);
 for(const r of ordered)widths.set(r.node.ruler.id,Math.max(1,(children.get(r.node.ruler.id)??[]).reduce((n,id)=>n+widths.get(id)!,0)));
 const roots=rows.filter(r=>!parents.has(r.node.ruler.id));
 let offset=0;const stack=roots.map(r=>{const item={id:r.node.ruler.id,left:offset};offset+=widths.get(item.id)!;return item;});
 while(stack.length){const {id,left}=stack.pop()!,r=byId.get(id)!;positions.set(id,{x:(left+widths.get(id)!/2)*210,y:r.depth*230});let childLeft=left;for(const child of children.get(id)??[]){stack.push({id:child,left:childLeft});childLeft+=widths.get(child)!;}}
 return {positions,parents,width:Math.max(210,offset*210),height:(Math.max(0,...rows.map(r=>r.depth))+1)*230};
}
