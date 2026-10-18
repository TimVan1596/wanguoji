import {expect,it} from "vitest";
import {buildPopulationRecoveryLines,populationCauseLabel} from "./PopulationPresentation";
import {PopulationTransitionAudit} from "../../../Simulation/PopulationTransitionAudit";
it("compact overview distinguishes true growth, transfer and session history without leaking internal identities",()=>{
  const team:any={name:"internal-id",displayName:"秦",status:"ACTIVE",users:new Set([1,2,3,4]),blocks:{children:{size:16}},cities:[]};
  const audit=new PopulationTransitionAudit();audit.reset(0,[team]);team.users.add(5);
  audit.record(team,4,5,{cause:"IMMIGRATION",month:6});audit.reconcile(6,[team]);
  const lines=buildPopulationRecoveryLines(team,6,audit.getSummary(team.name,[team]),audit.getRecent()[0]);
  expect(lines.length).toBeLessThanOrEqual(10);expect(lines.join(" ")).toContain("外来迁入+1");
  expect(lines.join(" ")).toContain("读档重置");expect(lines.join(" ")).toContain("国家之间转属不增加世界总人口");
  expect(lines.join(" ")).not.toContain("internal-id");expect(populationCauseLabel("SPECIAL_EVENT")).toBe("特殊外源增员");
});
