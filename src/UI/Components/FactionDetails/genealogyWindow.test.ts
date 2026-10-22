import {describe,it,expect} from "vitest";
import {indexGenealogy,genealogyWindow,layoutGenealogy,visibleGenealogyRows} from "./genealogyWindow";
import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
const node=(id:string,parentId?:string):PoliticalGenealogyNode=>({ruler:{id,parentId,reignOrdinal:id==='father'?1:undefined} as any,children:[]});
describe('bounded top-down genealogy',()=>{
 it('puts real father above children and siblings side by side with their own positions',()=>{
  const father=node('father'),a=node('a','father'),b=node('b','father');father.children=[a,b];
  const rows=genealogyWindow(indexGenealogy([father]),'a',new Set(['father'])),layout=layoutGenealogy(rows),p=layout.positions;
  expect(p.get('father')!.y).toBeLessThan(p.get('a')!.y);expect(p.get('a')!.y).toBe(p.get('b')!.y);expect(p.get('a')!.x).not.toBe(p.get('b')!.x);
  expect(p.get('father')!.x).toBe((p.get('a')!.x+p.get('b')!.x)/2);
 });
 it('connects variable card boundaries through one sibling fork and removes folded edges',()=>{
  const father=node('father'),a=node('a','father'),b=node('b','father');father.children=[a,b];const index=indexGenealogy([father]);
  const rows=genealogyWindow(index,'father',new Set(['father'])),layout=layoutGenealogy(rows,new Map([['father',130],['a',82],['b',114]]));
  expect(layout.edges).toHaveLength(2);expect(new Set(layout.edges.map(e=>e.joint)).size).toBe(1);
  for(const e of layout.edges){expect(e.y1).toBe(130);expect(e.y2).toBe(layout.positions.get(e.childId)!.y);}
  const folded=layoutGenealogy(genealogyWindow(index,'father',new Set()));expect(folded.edges).toEqual([]);
 });
 it.each([150,1000,10000])('bounds actual canvas for %s wide recorded relatives without losing searchable IDs',size=>{
  const father=node('father');father.children=Array.from({length:size-1},(_,i)=>node('child-'+i,'father'));
  const index=indexGenealogy([father]),rows=genealogyWindow(index,'father',new Set(['father']));
  expect(index.size).toBe(size);expect(rows.length).toBeLessThanOrEqual(150);expect(layoutGenealogy(rows).width).toBeLessThanOrEqual(1890);
  expect(genealogyWindow(index,'child-'+(size-2),new Set()).some(r=>r.node.ruler.id==='child-'+(size-2))).toBe(true);
 });
 it.each([20,150,1000,10000])('retains every monarch and ancestor in a %s generation trunk',size=>{
  const root=node('k0');root.ruler.reignOrdinal=1;let previous=root;
  for(let i=1;i<size;i++){const child=node('k'+i,'k'+(i-1));child.ruler.reignOrdinal=i+1;previous.children=[child];previous=child;}
  const rows=genealogyWindow(indexGenealogy([root]),'k'+(size-1),new Set()),layout=layoutGenealogy(rows);
  expect(rows.length).toBe(size);expect(layout.parents.size).toBe(size-1);expect(layout.width).toBeLessThan(500);
  for(const edge of layout.edges){const p=layout.positions.get(edge.parentId)!,c=layout.positions.get(edge.childId)!;expect(edge.y1).toBe(p.y+p.height);expect(edge.y2).toBe(c.y);expect(edge.y2).toBeGreaterThan(edge.y1);}
 });
 it('reuses space below short military side branches instead of spreading a long royal trunk',()=>{
  const root=node('k0');root.ruler.reignOrdinal=1;let current=root;
  for(let i=1;i<=100;i++){const king=node('k'+i,current.ruler.id),side=node('side'+i,current.ruler.id);king.ruler.reignOrdinal=i+1;side.ruler.militaryIdentity={} as any;current.children=[king,side];current=king;}
  const index=indexGenealogy([root]),rows=genealogyWindow(index,'k100',new Set([...index.keys()])),layout=layoutGenealogy(rows);
  expect(rows.length).toBe(201);expect(layout.width).toBeLessThan(800);
 });
 it('keeps the requested person mounted when a very large viewport exceeds the DOM budget',()=>{
  const roots=Array.from({length:1000},(_,i)=>node('root-'+i));const rows=genealogyWindow(indexGenealogy(roots),'root-999',new Set()),layout=layoutGenealogy(rows);
  const visible=visibleGenealogyRows(rows,layout,{left:0,top:0,width:2000,height:layout.height},'root-999');
  expect(visible).toHaveLength(150);expect(visible.some(r=>r.node.ruler.id==='root-999')).toBe(true);
 });
 it('stacks unrelated recorded roots without inventing kinship or an unlimited horizontal canvas',()=>{
  const roots=Array.from({length:1000},(_,i)=>{const root=node('house-'+i);root.ruler.reignOrdinal=i+1;return root;});
  const rows=genealogyWindow(indexGenealogy(roots),'house-999',new Set()),layout=layoutGenealogy(rows);
  expect(rows.length).toBe(1000);expect(layout.edges).toEqual([]);expect(layout.width).toBeLessThan(500);
  expect(layout.positions.get('house-999')!.y).not.toBe(layout.positions.get('house-0')!.y);
 });
 it('keeps malformed cyclic evidence finite without drawing an upward parent edge',()=>{
  const a=node('a','b'),b=node('b','a');a.children=[b];b.children=[a];
  const rows=genealogyWindow(indexGenealogy([a]),'b',new Set(['b'])),layout=layoutGenealogy(rows);
  expect(layout.positions.size).toBe(rows.length);for(const p of layout.positions.values()){expect(Number.isFinite(p.x)).toBe(true);expect(Number.isFinite(p.y)).toBe(true);}
  for(const [child,parent]of layout.parents)expect(layout.positions.get(parent)!.y).toBeLessThan(layout.positions.get(child)!.y);
 });
 it('does not invent parent lines for detached relatives or expand unrequested descendants',()=>{
  const root=node('root','missing'),child=node('child','root');root.ruler.militaryIdentity={} as any;root.children=[child];const index=indexGenealogy([root]);
  const rows=genealogyWindow(index,'root',new Set());expect(rows.map(r=>r.node.ruler.id)).toEqual(['root']);expect(layoutGenealogy(rows).positions.size).toBe(1);
 });
});

it('keeps wide collateral accessible through compact branch controls without a name search',()=>{
 const root=node('father');root.children=Array.from({length:30},(_,i)=>node('child-'+i,'father'));const index=indexGenealogy([root]);
 const first=genealogyWindow(index,'father',new Set(['father'])),next=genealogyWindow(index,'father',new Set(['father']),new Map([['father',10]]));
 expect(first.some(r=>r.node.ruler.id==='child-0')).toBe(true);expect(next.some(r=>r.node.ruler.id==='child-10')).toBe(true);expect(next.some(r=>r.node.ruler.id==='child-0')).toBe(false);expect(index.size).toBe(31);
});

it('opens verified military collateral and its true ancestors without opening ordinary descendants',()=>{
 const father=node('father'),king=node('king','father'),uncle=node('uncle','father'),soldier=node('soldier','uncle'),child=node('child','soldier');king.ruler.reignOrdinal=2;soldier.ruler.militaryIdentity={} as any;father.children=[king,uncle];uncle.children=[soldier];soldier.children=[child];
 const index=indexGenealogy([father]),rows=genealogyWindow(index,'king',new Set(),new Map(),new Set(['soldier'])),ids=rows.map(r=>r.node.ruler.id),layout=layoutGenealogy(rows);
 expect(ids).toEqual(expect.arrayContaining(['father','king','uncle','soldier']));expect(ids).not.toContain('child');expect(layout.parents.get('soldier')).toBe('uncle');expect(layout.parents.get('uncle')).toBe('father');
 expect(genealogyWindow(index,'king',new Set()).map(r=>r.node.ruler.id)).not.toContain('soldier');
});
it('bounds default military expansion while keeping the royal trunk and every recorded identity accessible',()=>{
 const father=node('father'),king=node('king','father');king.ruler.reignOrdinal=2;father.children=[king,...Array.from({length:1000},(_,i)=>node('soldier-'+i,'father'))];const index=indexGenealogy([father]),military=new Set(father.children.slice(1).map(n=>n.ruler.id));
 const rows=genealogyWindow(index,'king',new Set(),new Map(),military);expect(rows.length).toBeLessThanOrEqual(66);expect(rows.some(r=>r.node.ruler.id==='king')).toBe(true);expect(index.size).toBe(1002);
 expect(genealogyWindow(index,'soldier-999',new Set(),new Map(),military).some(r=>r.node.ruler.id==='soldier-999')).toBe(true);
});
it('bounds a ten-thousand-person military-only deep branch without repeatedly walking every ancestor',()=>{
 const root=node('father');let current=root;const military=new Set<string>();
 for(let i=1;i<10000;i++){const child=node('military-'+i,current.ruler.id);child.ruler.militaryIdentity={} as any;current.children=[child];current=child;military.add(child.ruler.id);}
 const index=indexGenealogy([root]),rows=genealogyWindow(index,'father',new Set(),new Map(),military);
 expect(index.size).toBe(10000);expect(rows).toHaveLength(65);expect(rows.at(-1)?.node.ruler.id).toBe('military-64');
});
