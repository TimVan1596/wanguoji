/** Bounded session-only observations. Monthly buckets retain only the last 100 years. */
export interface DiplomacyObservation { month: number; kind: string; duration?: number; gap?: number; [key: string]: unknown }
interface Totals { counts: Record<string, number>; durations: Record<string, number>; durationSum: number; durationCount: number; continuousSum: number; continuousCount: number; longestContinuous: number; shortestReformationGap?: number }
const empty = (): Totals => ({ counts: {}, durations: {}, durationSum: 0, durationCount: 0, continuousSum: 0, continuousCount: 0, longestContinuous: 0 });
function add(t: Totals, o: DiplomacyObservation) {
  t.counts[o.kind] = (t.counts[o.kind] ?? 0) + 1;
  if (o.duration !== undefined) { t.durations[o.duration] = (t.durations[o.duration] ?? 0) + 1; t.durationSum += o.duration; t.durationCount++; }
  if (typeof o.continuousDuration === "number") { t.continuousSum += o.continuousDuration; t.continuousCount++; t.longestContinuous = Math.max(t.longestContinuous,o.continuousDuration); }
  if (o.gap !== undefined) {
    t.shortestReformationGap = Math.min(t.shortestReformationGap ?? Infinity, o.gap);
    t.counts.samePairReformationCount = (t.counts.samePairReformationCount ?? 0) + 1;
    if (o.gap <= 60) t.counts.reformedWithin5Years = (t.counts.reformedWithin5Years ?? 0) + 1;
  }
}
function report(t: Totals): Record<string, number | undefined> {
  const middle = (t.durationCount - 1) / 2;
  let seen = 0, lo = 0, hi = 0;
  for (const [duration, count] of Object.entries(t.durations).sort((a,b) => Number(a[0]) - Number(b[0]))) {
    if (seen <= Math.floor(middle) && seen + count > Math.floor(middle)) lo = Number(duration);
    if (seen <= Math.ceil(middle) && seen + count > Math.ceil(middle)) hi = Number(duration);
    seen += count;
  }
  const defaults = Object.fromEntries(["truceFormed","napFormed","allianceFormed","upgrades","truceRenewed","napRenewed","allianceRenewed","expired","cooldownBlocked","reformedAfterCooldown","samePairReformationCount","reformedWithin5Years","commonThreatCandidates","weakThreat","credibleThreat","severeThreat","noStrategicContactBlocked"].map(key=>[key,0]));
  return { ...defaults, ...t.counts, completedContinuousDurationSum: t.continuousSum, completedContinuousCount: t.continuousCount, meanCompletedContinuousDuration: t.continuousCount ? t.continuousSum/t.continuousCount : 0, longestCompletedContinuousRelation: t.longestContinuous, meanInitialDuration: t.durationCount ? t.durationSum / t.durationCount : 0,
    medianInitialDuration: t.durationCount ? (lo + hi) / 2 : 0, shortestReformationGap: t.shortestReformationGap };
}
export class DiplomacyObservations {
  private session = empty(); private months = new Map<number, Totals>();
  private recent: DiplomacyObservation[] = []; private blockers: DiplomacyObservation[] = [];
  record(o: DiplomacyObservation) {
    add(this.session, o);
    const month = o.month;
    const bucket = this.months.get(month) ?? empty(); add(bucket, o); this.months.set(month, bucket);
    this.prune(o.month);
    if (["formation", "upgrade", "renewal"].includes(o.kind)) { this.recent.push(o); if(this.recent.length > 10) this.recent.shift(); }
    if (o.kind === "blocker") { this.blockers.push(o); if(this.blockers.length > 10) this.blockers.shift(); }
  }
  private prune(month: number) { for (const storedMonth of this.months.keys()) if(storedMonth < month - 1200) this.months.delete(storedMonth); }
  snapshot(month: number) {
    this.prune(month); const recent = empty();
    for(const t of this.months.values()) {
      for(const [key,count] of Object.entries(t.counts)) recent.counts[key] = (recent.counts[key] ?? 0) + count;
      for(const [key,count] of Object.entries(t.durations)) recent.durations[key] = (recent.durations[key] ?? 0) + count;
      recent.continuousSum += t.continuousSum; recent.continuousCount += t.continuousCount; recent.longestContinuous = Math.max(recent.longestContinuous,t.longestContinuous);
      recent.durationSum += t.durationSum; recent.durationCount += t.durationCount;
      if(t.shortestReformationGap !== undefined) recent.shortestReformationGap = Math.min(recent.shortestReformationGap ?? Infinity,t.shortestReformationGap);
    }
    return { sessionCumulative: report(this.session), recent100Years: report(recent), recentWindowMonths: 1200, recentLifecycle: this.recent.map(o=>({...o})), recentCandidateBlockers: this.blockers.map(o=>({...o})) };
  }
}
