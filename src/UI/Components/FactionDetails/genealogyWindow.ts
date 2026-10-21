import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
export const GENEALOGY_WINDOW_LIMIT=150;
export function indexGenealogy(roots:readonly PoliticalGenealogyNode[]){
 const result=new Map<string,PoliticalGenealogyNode>(),stack=[...roots];
 while(stack.length){const n=stack.pop()!;if(result.has(n.ruler.id))continue;result.set(n.ruler.id,n);for(const c of n.children)stack.push(c);}
 return result;
}
/** Both React depth and node count are bounded, independently of historical graph depth. */
export function genealogyWindow(index:ReadonlyMap<string,PoliticalGenealogyNode>,focusId:string,expanded:ReadonlySet<string>){
 const focus=index.get(focusId);if(!focus)return [];
 const ancestors:PoliticalGenealogyNode[]=[],seen=new Set([focusId]);let parent=focus.ruler.parentId;
 while(parent&&ancestors.length<8&&!seen.has(parent)){const n=index.get(parent);if(!n)break;seen.add(parent);ancestors.push(n);parent=n.ruler.parentId;}
 const rows=ancestors.reverse().map((node,depth)=>({node,depth,ancestor:true}));
 const stack=[{node:focus,depth:rows.length,ancestor:false}];
 while(stack.length&&rows.length<GENEALOGY_WINDOW_LIMIT){const row=stack.pop()!;if(!row.ancestor&&rows.some(r=>r.node.ruler.id===row.node.ruler.id))continue;rows.push(row);
  if(expanded.has(row.node.ruler.id))for(let i=row.node.children.length-1;i>=0;i--)stack.push({node:row.node.children[i],depth:row.depth+1,ancestor:false});
 }
 return rows;
}
