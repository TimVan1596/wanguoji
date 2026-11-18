export const STEP_PERFORMANCE_SAMPLE_CAPACITY = 300;

export interface StepTimingSummary {
  sampleCount: number;
  averageMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export type StepTimingSnapshot = Record<string, StepTimingSummary>;

interface TimingRing {
  values: number[];
  nextIndex: number;
  count: number;
  months: Array<number|undefined>;
}

/** Session-only diagnostic ring buffers. It never reads or mutates simulation state. */
export class RollingStepPerformance {
  private samples = new Map<string, TimingRing>();

  record(name: string, durationMs: number,monthIndex?:number) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const ring = this.samples.get(name) ?? { values: [], months:[], nextIndex: 0, count: 0 };
    ring.values[ring.nextIndex] = durationMs;
    ring.months[ring.nextIndex]=monthIndex;
    ring.nextIndex = (ring.nextIndex + 1) % STEP_PERFORMANCE_SAMPLE_CAPACITY;
    ring.count = Math.min(STEP_PERFORMANCE_SAMPLE_CAPACITY, ring.count + 1);
    this.samples.set(name, ring);
  }

  snapshot(): StepTimingSnapshot {
    const result:StepTimingSnapshot={};
    const summarize=(values:number[]):StepTimingSummary=>{const sorted=[...values].sort((a,b)=>a-b);return {sampleCount:values.length,averageMs:values.reduce((n,v)=>n+v,0)/values.length,p95Ms:sorted[Math.max(0,Math.ceil(values.length*.95)-1)]??0,p99Ms:sorted[Math.max(0,Math.ceil(values.length*.99)-1)]??0,maxMs:sorted.at(-1)??0};};
    for(const [name,ring] of this.samples){
      const values=ring.values.slice(0,ring.count);result[name]=summarize(values);
      for(const january of [true,false]){const selected=values.filter((_,i)=>ring.months[i]!==undefined&&((ring.months[i]!%12===0)===january));if(selected.length)result[`${name}/${january?'January':'ordinary'}`]=summarize(selected);}
    }
    return result;
  }

  reset() {
    this.samples.clear();
  }
}
