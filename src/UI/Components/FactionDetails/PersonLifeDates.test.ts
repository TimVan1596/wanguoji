import {expect,it} from "vitest";
import {personLifeDates} from "./PersonLifeDates";
import {formatRulerLifeAge} from "./RoyalPresentation";
it("uses the same canonical birth month across royal and military identities",()=>{
 const royal={bornYear:-13,deathMonth:12},military={bornMonth:-13,deathMonth:12};
 expect(personLifeDates(royal.bornYear,royal.deathMonth)).toEqual(personLifeDates(military.bornMonth,military.deathMonth));
 expect(personLifeDates(-13,12)).toEqual(["出生：纪元前2年12月","死亡：1年1月"]);
 expect(formatRulerLifeAge({status:"dead",bornYear:-13,deathMonth:12,deathReason:"去世"},50)).toBe("享年2岁");
});
it("does not convert retirement or political termination into a death date",()=>{
 expect(personLifeDates(-1,undefined)).toEqual(["出生：纪元前1年12月"]);expect(personLifeDates(undefined,undefined)).toEqual(["出生：未载"]);
 expect(formatRulerLifeAge({status:"deposed",bornYear:-13,endYear:0,naturalDeathYear:100},12)).toBe("当前年龄2岁");
 expect(formatRulerLifeAge({status:"politically-ended",bornYear:-13,endYear:0},12)).not.toContain("享年");
});
