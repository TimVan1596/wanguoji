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

it("keeps the ordinary-popular funnel separate from splits and resets all session-only failure detail",()=>{
  const a=new RegionalRebellionAudit();a.created({name:"split"} as any,0,"split");a.popularFunnel.political=2;a.popularFunnel.draws=1;a.popularFailures["运行时国家注册被拒绝"]=1;
  expect(a.snapshot().popularFunnel.successes).toBe(0);expect(a.snapshot().split).toBe(1);expect(a.summary()).toContain("不含帝国分裂");
  a.reset(120);expect(a.snapshot().popularFunnel.political).toBe(0);expect(a.snapshot().popularFailures).toEqual({});
});
