import { compareExileResourceProtection, type ExileResourceSample } from "./ExileResourceExperiments";

/** Bounded session observations owned/reset by WorldExiles. Never persisted or used by rules. */
export class ExileResourceDiagnostics {
  newExiles = 0; resourceChecks = 0; remnantChecks = 0; remnantHits = 0;
  remnantFirstZero = 0; legitimacyFirstZero = 0; claimantBlocked = 0;
  restorations = 0; reexiles = 0; matured12 = 0; active12 = 0; matured60 = 0; active60 = 0; followupOverflow = 0; reexileTrackingOverflow = 0;
  private restoredSinceExile = new Set<string>();
  private zeroSeen = new WeakMap<object, { remnant: boolean; legitimacy: boolean }>();
  private samples: ExileResourceSample[] = [];
  private comparisonCache?: { sample: ExileResourceSample; text: string };
  private followups: Array<{ factionId: string; month: number; checked12: boolean; ended: boolean; reexiled: boolean }> = [];
  started(factionId: string) {
    this.newExiles++;
    if (this.restoredSinceExile.delete(factionId)) this.reexiles++;
    for (const f of this.followups) if (f.factionId === factionId && !f.reexiled) {
      f.reexiled = true; f.ended = true;
    }
  }
  replaceEpisode(previous: object, next: object) {
    const seen = this.zeroSeen.get(previous);
    if (seen) this.zeroSeen.set(next, seen);
  }
  recordResources(key: object, beforeN: number, afterN: number, beforeL: number, afterL: number, claimant: boolean) {
    this.resourceChecks++;
    if (!claimant) this.claimantBlocked++;
    const seen = this.zeroSeen.get(key) ?? { remnant: false, legitimacy: false };
    if (!seen.remnant && beforeN > 0 && afterN <= 0) { this.remnantFirstZero++; seen.remnant = true; }
    if (!seen.legitimacy && beforeL > 0 && afterL <= 0) { this.legitimacyFirstZero++; seen.legitimacy = true; }
    this.zeroSeen.set(key, seen);
  }
  addSample(sample: ExileResourceSample) { this.samples.push(sample); if (this.samples.length > 16) this.samples.shift(); }
  recordRestoration(factionId: string, month: number) {
    this.restorations++;
    if (this.restoredSinceExile.size < 4096) this.restoredSinceExile.add(factionId); else this.reexileTrackingOverflow++;
    if (this.followups.length >= 512) { this.followupOverflow++; return; }
    this.followups.push({ factionId, month, checked12: false, ended: false, reexiled: false });
  }
  updateFollowups(month: number, teams: readonly { name: string; status: string }[]) {
    const states = new Map(teams.map(t => [t.name,t.status]));
    this.followups = this.followups.filter(f => {
      const status = states.get(f.factionId);
      if (status !== "ACTIVE") f.ended = true;
      if (status === "EXILED" && !f.reexiled) { f.reexiled = true; if (this.restoredSinceExile.delete(f.factionId)) this.reexiles++; }
      if (!f.checked12 && month - f.month >= 12) { f.checked12 = true; this.matured12++; if (!f.ended) this.active12++; }
      if (month - f.month >= 60) { this.matured60++; if (!f.ended) this.active60++; return false; }
      return true;
    });
  }
  snapshot() {
    return { newExiles: this.newExiles, resourceChecks: this.resourceChecks, remnantChecks: this.remnantChecks,
      remnantHits: this.remnantHits, remnantFirstZero: this.remnantFirstZero, legitimacyFirstZero: this.legitimacyFirstZero,
      claimantBlocked: this.claimantBlocked, restorations: this.restorations, reexiles: this.reexiles,
      matured12: this.matured12, active12: this.active12, matured60: this.matured60, active60: this.active60,
      insufficient12: this.followups.filter(f => !f.checked12).length, insufficient60: this.followups.length,
      followupOverflow: this.followupOverflow, reexileTrackingOverflow: this.reexileTrackingOverflow, sampleCount: this.samples.length };
  }
  getSamples() { return structuredClone(this.samples); }
  comparisonSummary() {
    const sample = this.samples[this.samples.length - 1];
    if (!sample) return "资源对照：本次会话尚无新流亡样本；生产a=0（45%）。";
    if (this.comparisonCache?.sample === sample) return this.comparisonCache.text;
    const rows = compareExileResourceProtection(sample);
    const text = `资源对照（最近真实新流亡样本；条件模型，未模拟城市/战争/继统者死亡）：${sample.factionId}；国家正式在国${sample.tenure.stateTenureMonths}月、当前王统在国${sample.tenure.currentHouseTenureMonths}月（证据截止${sample.tenure.evidenceEndMonth}月）；起始残部${sample.initialRemnants}，合法性${sample.initialLegitimacy}；年资证据${sample.tenure.complete ? "完整" : "不足，保护中性"}\n` +
      (rows.length ? rows.map(r => `a=${r.protection}：5/10/20年残部存续 ${r.checkpoints.map(p => `${(p.remnantSurvival*100).toFixed(2)}%`).join("/")}；同期资源均正 ${r.checkpoints.map(p => `${(p.positiveResources*100).toFixed(2)}%`).join("/")}；20年内首归零条件均月${r.meanFirstZeroMonthWithinWindow?.toFixed(1) ?? "—"}（窗口未归零${(r.censoredAt240Months*100).toFixed(2)}%）；年末资源均正检查期望${r.resourceAnnualOpportunities.toFixed(3)}次`).join("\n") : "样本超过有限分布计算容量（32人），仅保留观测输入。") +
      "\n以上不是实际城市资格次数或自然复国率；生产仍a=0，不执行实验保护。";
    this.comparisonCache = { sample, text }; return text;
  }
}
