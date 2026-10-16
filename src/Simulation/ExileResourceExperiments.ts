import { EXILE_REMNANT_DECAY_CHANCE } from "../config/simulation";
import { decayExileLegitimacy, decayRemnantPopulation } from "../Politics/ExileRules";
import type { RestorationTenureEvidence } from "./RestorationTenureEvidence";

export const PRODUCTION_REMNANT_PROTECTION = 0.25 as const;
export type RemnantProtection = 0 | 0.25 | 0.5;
export function getRemnantDecayChance(evidence: Pick<RestorationTenureEvidence, "complete" | "stateTenureMonths" | "currentHouseTenureMonths">,
  exileMonths: number, protection: RemnantProtection = PRODUCTION_REMNANT_PROTECTION) {
  if (!evidence.complete || ![0, .25, .5].includes(protection) || !Number.isFinite(exileMonths) || exileMonths < 0 ||
      !Number.isFinite(evidence.stateTenureMonths) || evidence.stateTenureMonths < 0 ||
      !Number.isFinite(evidence.currentHouseTenureMonths) || evidence.currentHouseTenureMonths < 0) return EXILE_REMNANT_DECAY_CHANCE;
  const s = evidence.stateTenureMonths / (evidence.stateTenureMonths + 3600);
  const d = evidence.currentHouseTenureMonths / (evidence.currentHouseTenureMonths + 3600);
  return EXILE_REMNANT_DECAY_CHANCE * (1 - protection * (.25 * s + .75 * d) * Math.max(0, 1 - exileMonths / 240));
}
/** Shared production/UI policy. The episode must agree with authoritative lifecycle evidence. */
export function getProductionRemnantProtection(evidence: RestorationTenureEvidence, worldMonth: number,
  startedMonth: number | undefined, lastExiledMonth: number | undefined) {
  const validEpisode = Number.isSafeInteger(worldMonth) && worldMonth >= 0 &&
    Number.isSafeInteger(startedMonth) && startedMonth! >= 0 && startedMonth! <= worldMonth &&
    startedMonth === lastExiledMonth && evidence.evidenceEndMonth === worldMonth;
  const exileMonths = validEpisode ? worldMonth - startedMonth! : undefined;
  const complete = evidence.complete && validEpisode;
  const chance = getRemnantDecayChance({ ...evidence, complete }, exileMonths ?? -1);
  const status = !complete ? "INSUFFICIENT" : exileMonths! >= 240 ? "EXPIRED" : "LIGHT";
  return { chance, status, exileMonths, remainingMonths: complete ? Math.max(0, 240 - exileMonths!) : undefined };
}
export interface ExileResourceSample {
  factionId: string; startedMonth: number; initialRemnants: number; initialLegitimacy: number;
  emperor: boolean; tenure: RestorationTenureEvidence;
}

/** Exact conditional resource distribution, NOT a city/war/claimant simulator. No RNG. */
export function compareExileResourceProtection(sample: ExileResourceSample) {
  if (!Number.isSafeInteger(sample.initialRemnants) || sample.initialRemnants < 0 || sample.initialRemnants > 32 ||
      !Number.isFinite(sample.initialLegitimacy) || sample.initialLegitimacy < 0 || sample.initialLegitimacy > 100) return [];
  return ([0, .25, .5] as const).map(protection => {
    // Legitimacy rounded to 1e-6 only to coalesce mathematically identical branches.
    let states = new Map<string, { n: number; l: number; weight: number }>();
    states.set("initial", { n: sample.initialRemnants, l: sample.initialLegitimacy, weight: 1 });
    const checkpoints: Array<{ years: number; remnantSurvival: number; positiveResources: number; expectedLegitimacy: number }> = [];
    let zeroTime = 0, firstZeroProbability = sample.initialRemnants === 0 ? 1 : 0, resourceAnnualOpportunities = 0;
    for (let at = 1; at <= 240; at++) {
      const next = new Map<string, { n: number; l: number; weight: number }>();
      const put = (n: number, l: number, weight: number) => {
        const key = `${n}:${Math.round(l * 1e6)}`;
        const old = next.get(key);
        if (old) old.weight += weight; else next.set(key, { n, l, weight });
      };
      const p = getRemnantDecayChance(sample.tenure, at, protection);
      for (const row of states.values()) {
        const l = at % 12 === 0 ? decayExileLegitimacy(row.l, row.n, sample.emperor ? 2.2 : 4) : row.l;
        if (at % 18 === 0 && row.n > 0) {
          const n = decayRemnantPopulation(row.n);
          put(n, l, row.weight * p); put(row.n, l, row.weight * (1 - p));
          if (n === 0) { firstZeroProbability += row.weight * p; zeroTime += at * row.weight * p; }
        } else put(row.n, l, row.weight);
      }
      states = next;
      if (at % 12 === 0) resourceAnnualOpportunities += [...states.values()].reduce((sum,r) => sum + (r.n > 0 && r.l > 0 ? r.weight : 0), 0);
      if ([60,120,240].includes(at)) checkpoints.push({ years: at / 12,
        remnantSurvival: [...states.values()].reduce((sum,r) => sum + (r.n > 0 ? r.weight : 0), 0),
        positiveResources: [...states.values()].reduce((sum,r) => sum + (r.n > 0 && r.l > 0 ? r.weight : 0), 0),
        expectedLegitimacy: [...states.values()].reduce((sum,r) => sum + r.l * r.weight, 0) });
    }
    return { protection, checkpoints, firstZeroProbability,
      meanFirstZeroMonthWithinWindow: firstZeroProbability ? zeroTime / firstZeroProbability : undefined,
      censoredAt240Months: 1 - firstZeroProbability, resourceAnnualOpportunities };
  });
}
