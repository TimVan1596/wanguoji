import {expect,it} from "vitest";
import {reconcileMilitaryPersonSelection as reconcile,toggleMilitaryPerson} from "./MilitaryPersonSelection";
const active:any={personId:"a",factionId:"qin",status:"ACTIVE"},retired:any={personId:"r",factionId:"qin",status:"RETIRED"},dead:any={personId:"d",status:"DEAD"};
const formations:any[]=[{status:"ACTIVE",commanderPersonId:"a",factionId:"qin"}],live=new Set(["a","r"]);
it("prefers a real current command, then a verified living retiree, never a dead person",()=>{
  expect(reconcile(undefined,"qin",[dead,retired,active],formations,live).selectedId).toBe("a");
  expect(reconcile(undefined,"qin",[dead,retired],[],live).selectedId).toBe("r");
  expect(reconcile(undefined,"qin",[dead],[],live).selectedId).toBeUndefined();
  expect(reconcile(undefined,"qin",[active],[],live).selectedId).toBeUndefined();
});
it("preserves manual collapse across monthly refresh, resets country and hydration selections",()=>{
  const people=[active,retired,dead],state=reconcile(undefined,"qin",people,formations,live),collapsed=toggleMilitaryPerson(state,"a");
  expect(reconcile(collapsed,"qin",[...people],formations,live)).toBe(collapsed);
  expect(reconcile(collapsed,"wei",people,formations,live).manual).toBe(false);
  expect(reconcile(collapsed,"qin",people.map(p=>({...p})),formations,live).selectedId).toBe("a");
  expect(toggleMilitaryPerson(collapsed,"d").selectedId).toBe("d");
});
it("invalidates automatic command selection after dissolution and keeps empty selections stable",()=>{
  const state=reconcile(undefined,"qin",[active,retired],formations,live);
  expect(reconcile(state,"qin",[active,retired],[],live).selectedId).toBe("r");
  const empty=reconcile(undefined,"qin",[],[],new Set());expect(reconcile(empty,"qin",[],[],new Set())).toBe(empty);
});
