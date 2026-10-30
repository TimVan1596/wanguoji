import type { MilitaryPoliticalEvidence } from "./MilitaryPoliticalInfluence";

/** Session-only observations of the already computed, single political draw. */
export class MilitaryPoliticalDiagnostics {
  private totals = this.empty();
  private blockers:Record<string,number>={};
  private empty() { return { checks: 0, crisisChecks: 0, eligibleActorChecks: 0, identityBlocked: 0, riskChanged: 0,
    draws: 0, baselineExpected: 0, finalExpected: 0, militarySuccesses: 0, militaryFailures: 0, nonMilitarySuccesses: 0 }; }
  reset() { this.totals = this.empty();this.blockers={}; }
  observe(military: MilitaryPoliticalEvidence | undefined, crisis: boolean, baseline: number, final: number, draw: boolean, success: boolean) {
    for(const b of military?.blocked??[])this.blockers[b.reason]=(this.blockers[b.reason]??0)+1;
    const t = this.totals; t.checks++; if (crisis) t.crisisChecks++;
    t.eligibleActorChecks += military?.candidates.length ?? 0; t.identityBlocked += military?.identityBlocked ?? 0;
    if (final > baseline) t.riskChanged++;
    if (draw) { t.baselineExpected += baseline; t.finalExpected += final; }
    if (draw && final > baseline) { t.draws++; if (success) t.militarySuccesses++; else t.militaryFailures++; }
    else if (success) t.nonMilitarySuccesses++;
  }
  snapshot() {
    const t = this.totals;
    return { ...t, blockers:{...this.blockers}, chineseSummary: `真实军权政治参与（本次会话，读档重置；非独立国家数）\n政治检查：${t.checks}次；真实危机检查：${t.crisisChecks}次\n符合军事资格：${t.eligibleActorChecks}人次；军权身份阻断：${t.identityBlocked}人次；维持原王统：${this.blockers.SUPPORTS_CONTINUITY??0}人次\n风险实际改变：${t.riskChanged}次；资格放宽：0次\n军事参与单次抽签：${t.draws}次（不按将领人数叠加）\n同批抽签原基线条件期望：${t.baselineExpected.toFixed(4)}；新规则条件期望：${t.finalExpected.toFixed(4)}\n军事参与成功：${t.militarySuccesses}次；未成功：${t.militaryFailures}次\n无军事参与的政治转型：${t.nonMilitarySuccesses}次\n区分宗室内部废立与异姓易代；本版未实现将领本人篡位。` };
  }
}
