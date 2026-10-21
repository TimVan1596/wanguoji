import {expect,it} from "vitest";
import {depositionSelectionLines} from "./DepositionSelectionPresentation";
it("distinguishes candidate's own command from an unrelated general's coup pressure",()=>{
 const selection={candidates:[{rulerId:"son",name:"秦继",relation:"DIRECT_CHILD",weight:1.55,militaryAdvantage:.15,ownMilitary:{office:"PIJIANG",members:[{},{}]}}],selectedRulerId:"son"};
 const event:any={type:"ruler-deposed",metadata:{depositionSelection:JSON.stringify(selection)}};
 const lines=depositionSelectionLines(event).join(" ");expect(lines).toContain("秦继时任裨将");expect(lines).toContain("15%");expect(lines).toContain("未记录普通将领施压");expect(lines).toContain("不代表军队拥立");
 delete (selection.candidates[0] as any).ownMilitary;selection.candidates[0].militaryAdvantage=0;(selection as any).supporterPersonId="ordinary";event.metadata.depositionSelection=JSON.stringify(selection);
 const plain=depositionSelectionLines(event).join(" ");expect(plain).not.toContain("掌有经核验");expect(plain).toContain("不表示其支持某位候选宗室");
});
