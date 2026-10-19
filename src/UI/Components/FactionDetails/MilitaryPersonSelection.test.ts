import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {reconcileMilitaryPersonSelection as reconcile,toggleMilitaryPerson} from "./MilitaryPersonSelection";
const active:any={personId:"a",factionId:"qin",status:"ACTIVE"},second:any={personId:"b",factionId:"qin",status:"ACTIVE"},retired:any={personId:"r",factionId:"qin",status:"RETIRED"},dead:any={personId:"d",status:"DEAD"};
const formations:any[]=[{status:"ACTIVE",commanderPersonId:"a",factionId:"qin"},{status:"ACTIVE",commanderPersonId:"b",factionId:"qin"}],live=new Set(["a","b","r"]);
it("opens all verified current commanders while retired, dead and invalid commands stay folded",()=>{
  const state=reconcile(undefined,"qin",[dead,retired,active,second],formations,live);
  expect(state.expandedIds).toEqual(["a","b"]);expect(state.focusedId).toBe("a");
  expect(reconcile(undefined,"qin",[dead,retired],[],live).expandedIds).toEqual([]);
  expect(reconcile(undefined,"qin",[active],[],live).focusedId).toBeUndefined();
});
it("active headings switch one map focus without folding the other; history expansion survives refresh",()=>{
  const people=[active,second,retired,dead],state=reconcile(undefined,"qin",people,formations,live);
  const focused=toggleMilitaryPerson(state,"b",true);expect(focused.expandedIds).toEqual(["a","b"]);expect(focused.focusedId).toBe("b");
  const history=toggleMilitaryPerson(focused,"d");expect(reconcile(history,"qin",[...people],formations,live)).toBe(history);
  expect(toggleMilitaryPerson(history,"d").expandedIds).not.toContain("d");
  expect(reconcile(history,"wei",people,formations,live).focusedId).toBeUndefined();
  expect(reconcile(history,"qin",people.map(p=>({...p})),formations,live).expandedIds).toEqual(["a","b"]);
});
it("clears invalid focus after dissolution and keeps empty selections stable",()=>{
  const state=reconcile(undefined,"qin",[active,second,retired],formations,live);
  expect(reconcile(state,"qin",[active,second,retired],formations.slice(1),live).focusedId).toBe("b");
  expect(reconcile(state,"qin",[active,second,retired],[],live).expandedIds).toEqual([]);
  const empty=reconcile(undefined,"qin",[],[],new Set());expect(reconcile(empty,"qin",[],[],new Set())).toBe(empty);
});
it("the panel automatically draws only the focused command and exposes none of the four map buttons",()=>{
  const s=readFileSync(new URL("./index.tsx",import.meta.url),"utf8");
  for(const label of ["定位部队","查看目标城","显示军令方向","清除标记"])expect(s).not.toContain(`>${label}</Button>`);
  expect(s).toContain("core?.showMilitaryCommand(focusedCommand,true)");expect(s).toContain("return ()=>core?.clearMilitaryCommandHighlight()");
});
