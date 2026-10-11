import { describe,expect,it } from "vitest";
import { PoliticalTransitionObservations } from "./PoliticalTransitionObservations";
import { formatPoliticalTransitionChineseSummary } from "./PoliticalTransitionChineseSummary";
describe("和平政治转型中文摘要",()=>{
  it("零样本、加载会话、资格阻断与保留历史的口径分开，摘要没有英文缩写",()=>{
    const obs=new PoliticalTransitionObservations();obs.reset(12000);
    obs.observeMonth(12001);obs.evaluation(12012,[{pair:["a","b"],preliminary:true,blockers:["PEACE_EVIDENCE_INSUFFICIENT"]}]);
    const empty=new PoliticalTransitionObservations().snapshot(12012);
    const text=formatPoliticalTransitionChineseSummary({worldMonth:12012,peacefulReunification:obs.snapshot(12012),
      strategicUnion:empty,peacefulSubmission:empty,retainedCanonicalHistory:{submittedEvents:1,mergedEvents:3}});
    expect(text).toContain("本次实际观察：1个月");expect(text).toContain("同源长期互不侵犯候选检查：1");
    expect(text).toContain("十年和平证据不足或条约记录矛盾：1");expect(text).toContain("长期互不侵犯归并次数：0");
    expect(text).toContain("同源合邦3次，纳土归附1次");expect(text).toContain("旧历史资格不可回溯");
    expect(text).not.toMatch(/NAP|ALLIANCE|NaN|Infinity|Submission|Strategic/);
  });
});
