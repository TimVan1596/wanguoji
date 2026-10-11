/** Runtime-only observations. Never exported as authoritative world state. */
export interface TransitionCheck {
  pair: string[];
  blockers: readonly string[];
  preliminary: boolean;
  extra?: Record<string, number>;
  sample?: object;
}
const MAX_UNIQUE_PAIRS = 4096;
const empty = () => ({ observedWorldMonths: 0, evaluationTicks: 0, pairChecks: 0,
  preliminaryEligiblePairs: 0, fullyEligibleChecks: 0, selectedAttempts: 0,
  successfulTransitions: 0, executionFailures: 0, blockerCounts: {} as Record<string, number>,
  soleBlockerCounts: {} as Record<string, number>, failureCounts: {} as Record<string, number>,
  extra: {} as Record<string, number> });
type Counts = ReturnType<typeof empty>;
function add(target: Counts, source: Counts) {
  for (const key of ['observedWorldMonths','evaluationTicks','pairChecks','preliminaryEligiblePairs',
    'fullyEligibleChecks','selectedAttempts','successfulTransitions','executionFailures'] as const) target[key] += source[key];
  for (const key of ['blockerCounts','soleBlockerCounts','failureCounts','extra'] as const)
    for (const [name,n] of Object.entries(source[key])) target[key][name] = (target[key][name] ?? 0) + n;
}
const pairKey = (ids: string[]) => JSON.stringify(ids.slice().sort());
export class PoliticalTransitionObservations {
  private cumulative = empty();
  private buckets = new Map<number, { counts: Counts; pairs: Set<string>; overflow: boolean }>();
  private pairs = new Set<string>();
  private overflow = false;
  private lastObservedMonth = 0;
  private lastEvaluationMonth = -1;
  private startMonth = 0;
  private samples: object[] = [];
  constructor(readonly enabled = true) {}
  reset(month = 0) {
    this.cumulative = empty(); this.buckets.clear(); this.pairs.clear(); this.overflow = false;
    this.startMonth = this.lastObservedMonth = month; this.lastEvaluationMonth = -1; this.samples = [];
  }
  private bucket(month: number) {
    const year = Math.floor((month - 1) / 12);
    for (const key of this.buckets.keys()) if (key < year - 99) this.buckets.delete(key);
    let b = this.buckets.get(year);
    if (!b) { b = { counts: empty(), pairs: new Set(), overflow: false }; this.buckets.set(year,b); }
    return b;
  }
  observeMonth(month: number) {
    if (!this.enabled || month <= this.lastObservedMonth) return;
    this.lastObservedMonth = month;
    this.cumulative.observedWorldMonths++;
    this.bucket(month).counts.observedWorldMonths++;
  }
  evaluation(month: number, rows: TransitionCheck[], extra: Record<string,number> = {}) {
    if (!this.enabled || this.lastEvaluationMonth === month) return;
    this.lastEvaluationMonth = month;
    const b = this.bucket(month), c = empty(); c.evaluationTicks = 1; c.pairChecks = rows.length; c.extra = { ...extra };
    const insert = (set: Set<string>, key: string) => {
      if (set.has(key)) return true;
      if (set.size >= MAX_UNIQUE_PAIRS) return false;
      set.add(key); return true;
    };
    for (const row of rows) {
      c.preliminaryEligiblePairs += Number(row.preliminary);
      const blockers = [...new Set(row.blockers)];
      if (!blockers.length) {
        c.fullyEligibleChecks++;
        const key = pairKey(row.pair);
        if (!insert(this.pairs,key)) this.overflow = true;
        if (!insert(b.pairs,key)) b.overflow = true;
      }
      for (const blocker of blockers) c.blockerCounts[blocker] = (c.blockerCounts[blocker] ?? 0) + 1;
      if (blockers.length === 1) c.soleBlockerCounts[blockers[0]] = (c.soleBlockerCounts[blockers[0]] ?? 0) + 1;
      for (const [key,n] of Object.entries(row.extra ?? {})) c.extra[key] = (c.extra[key] ?? 0) + n;
    }
    add(this.cumulative,c); add(b.counts,c);
    this.samples = rows.slice().sort((a,b) => a.blockers.length - b.blockers.length || pairKey(a.pair).localeCompare(pairKey(b.pair)))
      .slice(0,10).map(r => ({month,pair:r.pair.slice(),blockers:[...r.blockers],...r.sample}));
  }
  attempt(month: number, execute: () => boolean, rejectedReason: () => string) {
    if (!this.enabled) return execute();
    const c = empty(); c.selectedAttempts = 1;
    try {
      const success = execute();
      if (success) c.successfulTransitions = 1;
      else { c.executionFailures = 1; c.failureCounts[rejectedReason()] = 1; }
      return success;
    } catch (error) {
      c.executionFailures = 1;
      const name = error instanceof Error ? error.name : typeof error;
      c.failureCounts[`EXECUTION_THROW:${name}`] = 1;
      throw error; // Diagnostics do not suppress or retry gameplay errors.
    } finally { add(this.cumulative,c); add(this.bucket(month).counts,c); }
  }
  snapshot(month: number) {
    const recent = empty(), unique = new Set<string>(); let overflow = false;
    const year = Math.floor((month - 1) / 12);
    for (const [key,b] of this.buckets) if (key >= year - 99 && key <= year) {
      add(recent,b.counts); overflow ||= b.overflow;
      for (const pair of b.pairs) {
        if (unique.size < MAX_UNIQUE_PAIRS || unique.has(pair)) unique.add(pair); else overflow = true;
      }
    }
    const summary = (c:Counts, pairs:number, overflow:boolean) => ({...structuredClone(c),uniqueEligiblePairs:pairs,
      uniquePairCountIsLowerBound:overflow, eligibilityRate:c.pairChecks ? c.fullyEligibleChecks/c.pairChecks : 0,
      successfulTransitionsPer100ObservedYears:c.observedWorldMonths ? c.successfulTransitions/c.observedWorldMonths*1200 : 0 });
    return { enabled:this.enabled, sessionStartMonth:this.startMonth, observationEndMonth:this.lastObservedMonth,
      sessionCumulative:summary(this.cumulative,this.pairs.size,this.overflow),recent100Years:summary(recent,unique.size,overflow),
      recentCandidates:structuredClone(this.samples), limits:{uniquePairCap:MAX_UNIQUE_PAIRS,annualBuckets:100,recentCandidates:10},
      notes:'recent100Years为当前观察年及前99个观察历年桶；仅实际推进月份计入分母。unique超限为下界；多项阻断之和可超过pairChecks。读取V13/新建世界reset；旧历史资格不可回溯。' };
  }
}
