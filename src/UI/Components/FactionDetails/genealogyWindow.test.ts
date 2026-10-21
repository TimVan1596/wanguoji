import {describe,it,expect} from "vitest";
import {indexGenealogy,genealogyWindow,layoutGenealogy} from "./genealogyWindow";
import type {PoliticalGenealogyNode} from "../../../Politics/DynasticCandidateRules";
const node=(id:string,parentId?:string):PoliticalGenealogyNode=>({ruler:{id,parentId,reignOrdinal:id==='father'?1:undefined} as any,children:[]});
describe('bounded top-down genealogy',()=>{
 it('puts real father above children and siblings side by side with their own positions',()=>{
  const father=node('father'),a=node('a','father'),b=node('b','father');father.children=[a,b];
  const rows=genealogyWindow(indexGenealogy([father]),'a',new Set()),layout=layoutGenealogy(rows),p=layout.positions;
  expect(p.get('father')!.y).toBeLessThan(p.get('a')!.y);expect(p.get('a')!.y).toBe(p.get('b')!.y);expect(p.get('a')!.x).not.toBe(p.get('b')!.x);
  expect(p.get('father')!.x).toBe((p.get('a')!.x+p.get('b')!.x)/2);
 });
 it.each([150,1000,10000])('bounds actual canvas for %s wide recorded relatives without losing searchable IDs',size=>{
  const father=node('father');father.children=Array.from({length:size-1},(_,i)=>node('child-'+i,'father'));
  const index=indexGenealogy([father]),rows=genealogyWindow(index,'father',new Set(['father']));
  expect(index.size).toBe(size);expect(rows.length).toBeLessThanOrEqual(150);expect(layoutGenealogy(rows).width).toBeLessThanOrEqual(1890);
  expect(genealogyWindow(index,'child-'+(size-2),new Set()).some(r=>r.node.ruler.id==='child-'+(size-2))).toBe(true);
 });
 it('does not invent parent lines for detached relatives or expand unrequested descendants',()=>{
  const root=node('root','missing'),child=node('child','root');root.children=[child];const index=indexGenealogy([root]);
  const rows=genealogyWindow(index,'root',new Set());expect(rows.map(r=>r.node.ruler.id)).toEqual(['root']);expect(layoutGenealogy(rows).positions.size).toBe(1);
 });
});
