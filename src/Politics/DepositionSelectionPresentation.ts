import type {WorldEvent} from "../History/WorldHistory";
/** Read frozen evidence only; absence does not license invented contenders or loyalties. */
export function depositionSelectionLines(event: WorldEvent): string[] {
  if(event.type!=="ruler-deposed"||typeof event.metadata?.depositionSelection!=="string")return [];
  try{
    const s=JSON.parse(event.metadata.depositionSelection);
    if(!Array.isArray(s.candidates)||!s.candidates.length)return [];
    const relation:Record<string,string>={DIRECT_CHILD:"子",GRANDCHILD:"孙",SIBLING:"兄弟",NEPHEW:"侄",UNCLE:"叔伯",COUSIN:"堂亲"};
    const valid=s.candidates.filter((c:any)=>typeof c.name==="string"&&Number.isFinite(c.weight)&&c.weight>0&&relation[c.relation]);
    if(valid.length!==s.candidates.length)return [];
    const total=valid.reduce((n:number,c:any)=>n+c.weight,0);
    return [valid.length===1?"当时仅一名合法成年宗室，无候选竞争。":`当时比较${valid.length}名真实成年宗室；按亲缘合法性及危机下成年资历加权，非固定嫡系或旁系优先。`,
      ...valid.map((c:any)=>`${c.rulerId===s.selectedRulerId?"继位者":"候选"}：${c.name}（前君之${relation[c.relation]}），条件选择权重 ${(100*c.weight/total).toFixed(1)}%。`),
      ...valid.filter((c:any)=>c.ownMilitary&&c.militaryAdvantage>0).map((c:any)=>`${c.name}时任${({PIJIANG:"裨将",JIANGJUN:"将军",SHANGJIANGJUN:"上将军"} as Record<string,string>)[c.ownMilitary.office]}，掌有经核验的本国军队（${c.ownMilitary.members.length}人），在继位者选择中获得${(c.militaryAdvantage*100).toFixed(0)}%的有限权重加成；不代表军队拥立。`),
      s.supporterPersonId?"有真实军权参与本次废立；不表示任何候选人与将领存在私人效忠关系。":"无已核验的军权参与本次废立。",
      "继任选择复用本次废立成功抽签，不另行抽签；不改变正常继承顺序。"];
  }catch{return [];}
}
