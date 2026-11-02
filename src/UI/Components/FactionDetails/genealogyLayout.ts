/** Shared view-only geometry. Neither royal nor family identities are converted. */
export const GENEALOGY_WINDOW_LIMIT=150;
export const GENEALOGY_CARD_WIDTH=160;
export const GENEALOGY_SIBLING_GAP=20;
export const GENEALOGY_GENERATION_GAP=40;
export interface GenealogyLayoutRow {id:string;parentId?:string;depth:number;}
export function layoutGenealogyNodes(rows:readonly GenealogyLayoutRow[],heights:ReadonlyMap<string,number>=new Map()){
 const byId=new Map(rows.map(r=>[r.id,r])),children=new Map<string,string[]>(),parents=new Map<string,string>();
 const levels=new Map<number,number>();
 for(const row of rows){const id=row.id,h=heights.get(id)??66;levels.set(row.depth,Math.max(levels.get(row.depth)??0,h));const p=row.parentId;if(p&&byId.has(p)&&byId.get(p)!.depth<row.depth){parents.set(id,p);const ids=children.get(p)??[];ids.push(id);children.set(p,ids);}}
 interface Contour {left:number;right:number;shift:number;next?:Contour;}
 const shift=(c:Contour,n:number):Contour=>n?{...c,shift:c.shift+n}:c;
 const separation=(a:Contour,b:Contour)=>{let x:Contour|undefined=a,y:Contour|undefined=b,dx=0,dy=0,gap=0;while(x&&y){dx+=x.shift;dy+=y.shift;gap=Math.max(gap,x.right+dx+GENEALOGY_SIBLING_GAP-y.left-dy);x=x.next;y=y.next;}return gap;};
 const merge=(a:Contour,b:Contour,offset:number)=>{let x:Contour|undefined=a,y:Contour|undefined=b,dx=0,dy=offset;const levels:Array<{left:number;right:number}>=[];while(x&&y){dx+=x.shift;dy+=y.shift;levels.push({left:Math.min(x.left+dx,y.left+dy),right:Math.max(x.right+dx,y.right+dy)});x=x.next;y=y.next;}let tail=x?shift(x,dx):y?shift(y,dy):undefined;for(let i=levels.length-1;i>=0;i--)tail={...levels[i],shift:0,next:tail};return tail!;};
 const contours=new Map<string,Contour>(),branchDepth=new Map<string,number>(),offsets=new Map<string,Array<{id:string;x:number}>>();
 const positions=new Map<string,{x:number;y:number;height:number}>(),ys=new Map<number,number>();let bottom=0;
 for(const depth of [...levels.keys()].sort((a,b)=>a-b)){ys.set(depth,bottom);bottom+=levels.get(depth)!+GENEALOGY_GENERATION_GAP;}
 for(const row of rows.slice().sort((a,b)=>b.depth-a.depth)){
  const id=row.id,ids=children.get(id)??[];let combined:Contour|undefined;const placement:Array<{id:string;x:number}>=[];
  for(const child of ids){const c=contours.get(child)!;const x=combined?separation(combined,c):0;placement.push({id:child,x});combined=combined?merge(combined,c,x):c;}
  const deepest=Math.max(0,...ids.map(id=>branchDepth.get(id)!)),dominant=ids.filter(id=>branchDepth.get(id)===deepest);
  // A continuing trunk stays vertical; short collateral leaves can reuse space in later generations.
  const center=deepest>1&&dominant.length===1?placement.find(p=>p.id===dominant[0])!.x:placement.length?(placement[0].x+placement.at(-1)!.x)/2:0;
  offsets.set(id,placement.map(p=>({...p,x:p.x-center})));branchDepth.set(id,deepest+1);
  contours.set(id,{left:-GENEALOGY_CARD_WIDTH/2,right:GENEALOGY_CARD_WIDTH/2,shift:0,next:combined?shift(combined,-center):undefined});
 }
 const roots=rows.filter(r=>!parents.has(r.id));
 // Unrelated recorded families are separate trees, not an indefinitely wide generation.
 const stack:Array<{id:string;x:number;y:number}>=[];let width=1,totalHeight=0;
 for(const r of roots){
  let c:Contour|undefined=contours.get(r.id)!,dx=0,min=Infinity,max=-Infinity;
  while(c){dx+=c.shift;min=Math.min(min,c.left+dx);max=Math.max(max,c.right+dx);c=c.next;}
  const lastDepth=branchDepth.get(r.id)!-1,height=ys.get(lastDepth)!+levels.get(lastDepth)!;
  stack.push({id:r.id,x:10-min,y:totalHeight});width=Math.max(width,max-min+20);totalHeight+=height+GENEALOGY_GENERATION_GAP;
 }
 while(stack.length){const {id,x,y}=stack.pop()!,r=byId.get(id)!;positions.set(id,{x,y:y+ys.get(r.depth)!,height:heights.get(id)??66});for(const child of offsets.get(id)??[])stack.push({id:child.id,x:x+child.x,y});}
 const edges=rows.flatMap(row=>{const id=row.id,parentId=parents.get(id);if(!parentId)return [];const a=positions.get(parentId)!,b=positions.get(id)!,joint=b.y-GENEALOGY_GENERATION_GAP/2;return [{parentId,childId:id,x1:a.x,y1:a.y+a.height,x2:b.x,y2:b.y,joint,path:`M ${a.x} ${a.y+a.height} V ${joint} H ${b.x} V ${b.y}`}];});
 return {positions,parents,edges,width,height:Math.max(1,totalHeight-GENEALOGY_GENERATION_GAP)};
}
