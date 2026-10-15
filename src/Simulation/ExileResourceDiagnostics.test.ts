import { describe, expect, it } from "vitest";
import { ExileResourceDiagnostics } from "./ExileResourceDiagnostics";
describe("流亡会话统计",()=>{
  it("资源首次归零按流亡事件只计一次，读档前已归零不算新转变",()=>{
    const d=new ExileResourceDiagnostics(), episode={};
    d.recordResources(episode,1,0,1,0,false);
    d.recordResources(episode,0,0,0,0,false);
    d.recordResources(episode,1,0,1,0,true);
    d.recordResources({},0,0,0,0,true);
    expect(d.snapshot()).toMatchObject({resourceChecks:4,remnantFirstZero:1,legitimacyFirstZero:1,claimantBlocked:2});
    d.recordResources({},1,0,1,0,true);
    expect(d.snapshot().remnantFirstZero).toBe(2);
  });
  it("12/60月随访不足和连续在国分别统计，再流亡不误当成功",()=>{
    const d=new ExileResourceDiagnostics();d.recordRestoration("qin",0);
    d.updateFollowups(11,[{name:"qin",status:"ACTIVE"}]);
    expect(d.snapshot()).toMatchObject({insufficient12:1,insufficient60:1,matured12:0});
    d.updateFollowups(12,[{name:"qin",status:"ACTIVE"}]);
    expect(d.snapshot()).toMatchObject({matured12:1,active12:1,insufficient12:0});
    d.started("qin");d.updateFollowups(60,[{name:"qin",status:"ACTIVE"}]);
    expect(d.snapshot()).toMatchObject({matured60:1,active60:0,reexiles:1,insufficient60:0});
    const later=new ExileResourceDiagnostics();later.recordRestoration("qin",0);later.updateFollowups(60,[{name:"qin",status:"ACTIVE"}]);
    later.started("qin");expect(later.snapshot()).toMatchObject({active60:1,reexiles:1});
  });
  it("长期样本容量固定且明确报告未跟踪数量",()=>{
    const d=new ExileResourceDiagnostics();
    for(let i=0;i<600;i++) d.recordRestoration(`f${i}`,0);
    expect(d.snapshot()).toMatchObject({restorations:600,insufficient60:512,followupOverflow:88});
  });
});
