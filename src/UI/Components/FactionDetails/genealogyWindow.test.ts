import {describe,it,expect} from "vitest";
import {indexGenealogy,genealogyWindow,layoutGenealogy} from "./genealogyWindow";
import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
const node=(id:string,parentId?:string):PoliticalGenealogyNode=>({ruler:{id,parentId,reignOrdinal:id==='father'?1:undefined} as any,children:[]});
describe('bounded top-down genealogy',()=>{
 it('puts real father above children and siblings side by side with their own positions',()=>{
  const father=node('father'),a=node('a','father'),b=node('b','father');father.children=[a,b];
  const rows=genealogyWindow(indexGenealogy([father]),'a',new Set(['father'])),layout=layoutGenealogy(rows),p=layout.positions;
  expect(p.get('father')!.y).toBeLessThan(p.get('a')!.y);expect(p.get('a')!.y).toBe(p.get('b')!.y);expect(p.get('a')!.x).not.toBe(p.get('b')!.x);
  expect(p.get('father')!.x).toBe((p.get('a')!.x+p.get('b')!.x)/2);
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
 it('keeps malformed cyclic evidence finite without drawing an upward parent edge',()=>{
  const a=node('a','b'),b=node('b','a');a.children=[b];b.children=[a];
  const rows=genealogyWindow(indexGenealogy([a]),'b',new Set(['b'])),layout=layoutGenealogy(rows);
  expect(layout.positions.size).toBe(rows.length);for(const p of layout.positions.values()){expect(Number.isFinite(p.x)).toBe(true);expect(Number.isFinite(p.y)).toBe(true);}
  for(const [child,parent]of layout.parents)expect(layout.positions.get(parent)!.y).toBeLessThan(layout.positions.get(child)!.y);
 });
 it('does not invent parent lines for detached relatives or expand unrequested descendants',()=>{
  const root=node('root','missing'),child=node('child','root');root.children=[child];const index=indexGenealogy([root]);
  const rows=genealogyWindow(index,'root',new Set());expect(rows.map(r=>r.node.ruler.id)).toEqual(['root']);expect(layoutGenealogy(rows).positions.size).toBe(1);
 });
});
