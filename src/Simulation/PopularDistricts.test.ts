import {expect,it} from "vitest";
import {buildPopularDistricts} from "./PopularDistricts";
function fixture(){
  const team:any={name:"a",cities:[]},map:any={blocks:Array.from({length:40},(_,x)=>Array.from({length:3},(_,y)=>({x:x*32,y:y*32,team}))) };
  team.cities=[{id:"a",ownerFactionId:"a",block:map.blocks[0][1]},{id:"b",ownerFactionId:"a",block:map.blocks[30][1]}];return {team,map};
}
it("assigns rural owned land by nearest reachable city beyond the old radius, without crossing enemy or unowned land",()=>{
  const {team,map}=fixture();let d=buildPopularDistricts(team,map,32);
  expect(d.district.get("10,1")).toBe("a");expect(d.distance.get("10,1")).toBe(10);expect(d.district.get("25,1")).toBe("b");
  map.blocks[20].forEach((b:any)=>b.team=undefined);map.blocks[39].forEach((b:any)=>b.team={name:"enemy"});
  d=buildPopularDistricts(team,map,32);expect(d.district.has("20,1")).toBe(false);expect(d.district.has("39,1")).toBe(false);
  map.blocks[35].forEach((b:any)=>b.team=undefined);d=buildPopularDistricts(team,map,32);expect(d.district.has("37,1")).toBe(false);
});
it("ties are stable under city order changes; no controlled city means no invented local affiliation",()=>{
  const {team,map}=fixture();const a=buildPopularDistricts(team,map,32);team.cities.reverse();const b=buildPopularDistricts(team,map,32);
  expect(b.district).toEqual(a.district);expect(a.district.get("15,1")).toBe("a");team.cities=[];expect(buildPopularDistricts(team,map,32).district.size).toBe(0);
});
