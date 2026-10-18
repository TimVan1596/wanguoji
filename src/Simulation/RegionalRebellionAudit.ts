import {emptyPopularSpatialCounts} from "./PopularDistricts";
import type Team from "../Components/Team";
/** Session-only bounded observations. Never consulted for eligibility or random decisions. */
export class RegionalRebellionAudit {
  counts={cityChecks:0,politicalCities:0,loyaltyBlocked:0,stabilityBlocked:0,capacityBlocked:0,identityBlocked:0,
    validOrdinary:0,discontentBlocked:0,geographyBlocked:0,supporters:0,noSupport:0,draws:0,drawFailed:0,executionFailed:0,
    popular:0,split:0,splitChecks:0,splitPolitical:0,splitRestored:0,alive12:0,matured12:0,alive60:0,matured60:0,overflow:0};
  spatial=emptyPopularSpatialCounts();
  accountSpatial(value:ReturnType<typeof emptyPopularSpatialCounts>){for(const k of Object.keys(this.spatial) as Array<keyof typeof this.spatial>)this.spatial[k]+=value[k];}
  private pending:Array<{id:string;month:number;active:boolean;observed12:boolean}>=[];
  month=0;
  reset(month:number){this.counts=new RegionalRebellionAudit().counts;this.spatial=emptyPopularSpatialCounts();this.pending=[];this.month=month;}
  observe(month:number,teams:Team[]){
    this.month=month;const active=new Set(teams.filter(t=>t.status==="ACTIVE").map(t=>t.name));
    for(const p of this.pending){p.active&&=active.has(p.id);if(!p.observed12&&month-p.month>=12){p.observed12=true;this.counts.matured12++;if(p.active)this.counts.alive12++;}
      if(month-p.month>=60){this.counts.matured60++;if(p.active)this.counts.alive60++;}}
    this.pending=this.pending.filter(p=>month-p.month<60);
  }
  created(team:Team,month:number,kind:"popular"|"split"){this.counts[kind]++;if(this.pending.length<256)this.pending.push({id:team.name,month,active:true,observed12:false});else this.counts.overflow++;}
  snapshot(restored=0){return {...this.counts,spatial:{...this.spatial},restored:restored+this.counts.splitRestored,worldMonth:this.month,insufficient12:this.pending.filter(p=>!p.observed12).length,insufficient60:this.pending.length};}
  summary(restored=0){const c=this.snapshot(restored);return [
    "地方叛乱与帝国分裂（本次会话，读档重置；检查/候选均为累计人次或城次，非独立数量）",
    `实际城市检查${c.cityChecks}；民变城市政治资格通过${c.politicalCities}；城市忠诚不足以形成危机${c.loyaltyBlocked}；国家稳定度阻断${c.stabilityBlocked}；势力数量上限阻断${c.capacityBlocked}`,
    `有效普通User ${c.validOrdinary}人次；身份阻断${c.identityBlocked}；地理位置阻断${c.geographyBlocked}；个人及地方不满不足${c.discontentBlocked}；合格本地支持者${c.supporters}人次；无真实支持者${c.noSupport}次`,
    `权威位置：Arcade实际Player ${this.spatial.arcadePosition}；逻辑模式 ${this.spatial.logicalPosition}；Arcade位置与旧注册坐标相差一格以上${this.spatial.staleRegistryPosition}`,
    `空间阻断：非法/越界${this.spatial.invalidPosition}；无主地块${this.spatial.unowned}；敌国地块${this.spatial.foreign}；另一座本国城市${this.spatial.otherCity}；另一城市辖区${this.spatial.otherDistrict}；本国孤立地块无可达辖城${this.spatial.disconnected}`,
    `旧小城域以外${this.spatial.outsideLegacy}人次，其中经本国连通辖区重新识别${this.spatial.recoveredDistrict}；旧城域构造为空${this.spatial.emptyLegacyArea}城次；当前城市无有效辖区${this.spatial.emptyDistrict}城次`,
    `逻辑身份引用不符${this.spatial.referenceMismatch}（其中位置可解析且在本国地块${this.spatial.referenceWithOwnedPosition}，仍不作为合法响应者）；辖区只说明当前控制联系，不证明籍贯或居住史。`,
    `真正城市政治抽签${c.draws}（包括原复国共享抽签，非额外民变抽签）；未命中${c.drawFailed}；新建势执行失败${c.executionFailed}`,
    `帝国候选检查${c.splitChecks}；分裂政治资格通过${c.splitPolitical}；民众叛乱成功${c.popular}；帝国分裂成功${c.split}；原历史势力恢复${c.restored}`,
    `新建政权连续在国：12月${c.alive12}/${c.matured12}，随访不足${c.insufficient12}；60月${c.alive60}/${c.matured60}，随访不足${c.insufficient60}；随访容量256，未跟踪${c.overflow}`,
    "个人忠诚保持原值；起事意愿由真实城域危机派生，军政人物不作为民变领袖。"
  ].join("\n");}
}
