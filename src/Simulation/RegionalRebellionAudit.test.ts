import {expect,it} from "vitest";
import {RegionalRebellionAudit} from "./RegionalRebellionAudit";
it("bounds follow-up records, separates continuous survival and resets on hydration",()=>{
  const a=new RegionalRebellionAudit();
  for(let i=0;i<1000;i++)a.created({name:`f${i}`} as any,0,"popular");
  expect(a.snapshot().insufficient60).toBe(256);expect(a.snapshot().overflow).toBe(744);
  a.observe(12,[{name:"f0",status:"ACTIVE"}] as any);expect(a.snapshot().alive12).toBe(1);expect(a.snapshot().matured12).toBe(256);
  a.observe(24,[]);a.observe(60,[{name:"f0",status:"ACTIVE"}] as any);
  expect(a.snapshot().alive60).toBe(0);expect(a.snapshot().insufficient60).toBe(0);
  expect(a.summary()).toContain("非独立数量");a.reset(600);expect(a.snapshot().popular).toBe(0);expect(a.snapshot().worldMonth).toBe(600);
});
