import { deriveRestorationTenureEvidence, type RestorationTenureInput } from "./RestorationTenureEvidence";
import type { CityHistoryEvent } from "../Components/City";

export type RestorationBasis = "FORMER_CAPITAL" | "LONG_RULE";
export interface HistoricalCityRule { factionId: string; heldMonths: number; formalCapitalRecorded: boolean; }
export interface RestorationHistoricalProfile {
  factionId: string;
  stateTenureMonths: number;
  complete: boolean;
  evidenceEndMonth: number;
  currentHouseContinuityMonths: number;
  currentHouseEpochStartMonth?: number;
  currentHouseTenureMonths: number;
  historicalCityBasis: RestorationBasis;
  heldMonths: number;
  stateHistoricalWeight: number;
  houseHistoricalWeight: number;
  /** Analysis-only multiplier. Production risk remains unchanged in B1. */
  combinedMultiplier: number;
}
interface CityEvidence { foundedYear: number; founderFactionId: string; ownerFactionId: string; history: CityHistoryEvent[]; captureCount: number; }
const transfers = new Set(["captured", "recovered", "merged", "submitted"]);

/** Append order is authoritative within a month; capital changes never transfer ownership. */
export function deriveHistoricalCityRules(city: CityEvidence, worldMonth: number, formalMonths: ReadonlyMap<string, number>): HistoricalCityRule[] | undefined {
  const events = city.history;
  if (!Array.isArray(events) || !events.length || events[0].type !== "founded" || events[0].year !== city.foundedYear ||
      events[0].newOwnerFactionId !== city.founderFactionId || !Number.isSafeInteger(worldMonth) || !Number.isSafeInteger(city.foundedYear) || city.foundedYear < 0 || city.foundedYear > worldMonth) return undefined;
  let owner = city.founderFactionId, since = city.foundedYear, last = since, count = 0;
  let lastTransfer: CityHistoryEvent | undefined;
  const results = new Map<string, HistoricalCityRule>();
  const close = (month: number) => {
    const row = results.get(owner) ?? { factionId: owner, heldMonths: 0, formalCapitalRecorded: false };
    row.heldMonths += month - since;
    results.set(owner, row); since = month;
  };
  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    if (!Number.isSafeInteger(event.year) || event.year < last || event.year > worldMonth) return undefined;
    last = event.year;
    if (event.type === "founded") return undefined;
    if (transfers.has(event.type)) {
      if (event.previousOwnerFactionId !== owner || !event.newOwnerFactionId || event.newOwnerFactionId === owner) return undefined;
      close(event.year); owner = event.newOwnerFactionId; lastTransfer = event;
      if (event.type === "captured" || event.type === "recovered") count++;
    } else if (event.type === "capital-started" || event.type === "capital-relocated") {
      if (event.newOwnerFactionId !== owner || !event.wasCapital) return undefined;
      close(event.year);
      const formal = formalMonths.get(owner);
      if (formal !== undefined && event.year >= formal) results.get(owner)!.formalCapitalRecorded = true;
    } else if (event.type === "capital-lost") {
      if (!event.wasCapital || (event.previousOwnerFactionId !== owner &&
          !(lastTransfer?.year === event.year && lastTransfer.previousOwnerFactionId === event.previousOwnerFactionId && event.newOwnerFactionId === owner))) return undefined;
      // Capture records the capital loss immediately before the ownership event.
      close(event.year);
    } else return undefined;
  }
  if (owner !== city.ownerFactionId || count !== city.captureCount || last > worldMonth || since > worldMonth) return undefined;
  close(worldMonth);
  return [...results.values()].sort((a, b) => a.factionId < b.factionId ? -1 : a.factionId > b.factionId ? 1 : 0);
}

export function getHistoricalRestorationBasis(rule: HistoricalCityRule): RestorationBasis | undefined {
  if (rule.formalCapitalRecorded && rule.heldMonths >= 120) return "FORMER_CAPITAL";
  if (rule.heldMonths >= 360) return "LONG_RULE";
  return undefined;
}

/** Pure, bounded analysis profile. It describes recorded tenure, not public support. */
export function deriveRestorationHistoricalProfile(input: {
  factionId: string;
  stateTenureMonths: number;
  currentHouseTenureMonths?: number;
  currentHouseContinuityMonths?: number;
  complete?: boolean;
  currentHouseEpochStartMonth?: number;
  worldMonth: number;
  basis: RestorationBasis;
  heldMonths: number;
  cap?: number;
}): RestorationHistoricalProfile {
  const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const stateTenureMonths = input.complete === false ? 0 : nonNegative(input.stateTenureMonths);
  const currentHouseTenureMonths = input.complete === false ? 0 : nonNegative(input.currentHouseTenureMonths ?? 0);
  // Each tenure source saturates over 300 years; neither can grow without bound.
  const saturatingWeight = (months: number) => 0.15 * months / (months + 3600);
  const stateHistoricalWeight = saturatingWeight(stateTenureMonths);
  const houseHistoricalWeight = saturatingWeight(currentHouseTenureMonths);
  const cap = Number.isFinite(input.cap) ? Math.max(1, Math.min(1.35, input.cap!)) : 1.35;
  return {
    factionId: input.factionId,
    complete: input.complete !== false,
    evidenceEndMonth: input.worldMonth,
    currentHouseContinuityMonths: input.currentHouseContinuityMonths ?? 0,
    stateTenureMonths,
    currentHouseEpochStartMonth: input.currentHouseEpochStartMonth,
    currentHouseTenureMonths,
    historicalCityBasis: input.basis,
    heldMonths: nonNegative(input.heldMonths),
    stateHistoricalWeight,
    houseHistoricalWeight,
    combinedMultiplier: Math.min(cap, 1 + stateHistoricalWeight + houseHistoricalWeight),
  };
}

/** Adapt authoritative runtime records to the pure profile without mutating them. */
export function deriveFactionRestorationHistoricalProfile(input: RestorationTenureInput & {
  basis: RestorationBasis; heldMonths: number; cap?: number;
}): RestorationHistoricalProfile {
  const evidence = deriveRestorationTenureEvidence(input);
  return deriveRestorationHistoricalProfile({ ...evidence, worldMonth: input.worldMonth,
    basis: input.basis, heldMonths: input.heldMonths, cap: input.cap });
}

/** Counterfactual only: preserves each production path's existing hard probability ceiling. */
export function applyRestorationHistoricalMultiplier(baseChance: number, multiplier: number, pathCap = 0.09) {
  const chance = Number.isFinite(baseChance) ? Math.max(0, baseChance) : 0;
  const factor = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
  const cap = Number.isFinite(pathCap) ? Math.max(0, pathCap) : 0;
  return Math.min(cap, chance * factor);
}

export function historicalRestorationChance(baseChance: number, basis: RestorationBasis, heldMonths: number, exileMonths: number) {
  const duration = Math.min(1.25, 1 + Math.max(0, heldMonths - 360) / 2400);
  const weight = basis === "FORMER_CAPITAL" ? 0.5 : 0.25;
  return Math.max(0, Math.min(0.09, baseChance * weight * duration / (1 + Math.max(0, exileMonths) / 1200)));
}

/** One city draw: the largest individual chance caps total risk, candidate count cannot inflate it. */
export function selectRestorationOpportunity<T>(rows: Array<{ chance: number; value: T }>, draw: number): T | undefined {
  const chance = Math.max(0, ...rows.map(row => row.chance));
  if (draw > chance || chance <= 0) return undefined;
  const total = rows.reduce((sum, row) => sum + row.chance, 0);
  let point = (draw / chance) * total;
  for (const row of rows) { point -= row.chance; if (point <= 0 && row.chance > 0) return row.value; }
  return rows[rows.length - 1]?.value;
}

/** Additional evidence, never a replacement for the validated ownership timeline. */
export function getWarTornCityEvidence(city: { loyalty: number; devastation: number; history: CityHistoryEvent[] }, worldMonth: number, ownerStability: number) {
  const recentTransfers = city.history.filter(event =>
    (event.type === "captured" || event.type === "recovered") && event.year >= worldMonth - 60 && event.year <= worldMonth).length;
  return { recentTransfers, eligible: city.loyalty > 28 && city.loyalty < 40 && city.devastation >= 70 &&
    (recentTransfers >= 2 || ownerStability <= 40) };
}

/** Bounded annual risk, shared by all historical claimants to this city. No RNG here. */
export function warTornRestorationChance(input: { loyalty: number; devastation: number; ownerStability: number; recentTransfers: number;
  basis: RestorationBasis; heldMonths: number; legitimacy: number; exileMonths: number }) {
  if (input.loyalty <= 28 || input.loyalty >= 40 || input.devastation < 70 || input.legitimacy <= 0 ||
      (input.recentTransfers < 2 && input.ownerStability > 40)) return 0;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const loyalty = clamp((40 - input.loyalty) / 12);
  const damage = clamp((input.devastation - 60) / 40);
  const unrest = input.recentTransfers >= 2 ? 1 : .75;
  const instability = .5 + .5 * clamp((100 - input.ownerStability) / 100);
  const history = (input.basis === "FORMER_CAPITAL" ? 1 : .5) * Math.min(1.25, 1 + Math.max(0, input.heldMonths - 360) / 2400);
  return Math.min(.03, .03 * loyalty * damage * unrest * instability * history * clamp(input.legitimacy / 100) /
    (1 + Math.max(0, input.exileMonths) / 600));
}

/** Probability mass belonging to actual restoration slots in the existing single city draw. */
export function getRestorationDrawExpectation(rows: readonly { chance: number; restoration: boolean }[]) {
  const max = Math.max(0, ...rows.map(r => r.chance));
  const total = rows.reduce((sum,r) => sum + Math.max(0,r.chance), 0);
  if (total <= 0) return 0;
  let prefix = 0, expectation = 0;
  for (const row of rows) {
    const end = prefix + Math.max(0,row.chance);
    if (row.restoration) expectation += Math.max(0, Math.min(1,max*end/total) - Math.min(1,max*prefix/total));
    prefix = end;
  }
  return expectation;
}

/** Resident response has its own graduated crisis component; it never changes
 * remnant risk. Historical tenure is evidence, not a record of popular loyalty. */
export function localResidentRestorationChance(input: {
  legacyChance:number; loyalty:number; devastation:number; recentTransfers:number; ownerStability:number;
  legitimacy:number; basis:RestorationBasis; tenure:Pick<import("./RestorationTenureEvidence").RestorationTenureEvidence,"complete"|"stateTenureMonths"|"currentHouseTenureMonths">;
}) {
  const {loyalty,devastation,recentTransfers,ownerStability,legitimacy}=input;
  if (![loyalty,devastation,recentTransfers,ownerStability,legitimacy,input.legacyChance].every(Number.isFinite) || legitimacy<=0 || loyalty>=40 ||
      (loyalty>28 && (devastation<70 || (recentTransfers<2 && ownerStability>40)))) return 0;
  const clamp=(v:number)=>Math.max(0,Math.min(1,v));
  const crisis=.45*clamp((40-loyalty)/40)+.25*clamp(devastation/100)+.15*clamp(recentTransfers/3)+.15*clamp((100-ownerStability)/100);
  const t=input.tenure;
  const valid=t.complete && Number.isSafeInteger(t.stateTenureMonths) && t.stateTenureMonths>=0 && Number.isSafeInteger(t.currentHouseTenureMonths) && t.currentHouseTenureMonths>=0 && t.currentHouseTenureMonths<=t.stateTenureMonths;
  const h=valid ? .25*t.stateTenureMonths/(t.stateTenureMonths+3600)+.75*t.currentHouseTenureMonths/(t.currentHouseTenureMonths+3600) : 0;
  const graduated=.02*crisis*crisis*(.5+.5*clamp(legitimacy/100))*(input.basis==="FORMER_CAPITAL"?1:.7)*(.75+.25*h);
  return Math.min(loyalty>28?.03:.09,Math.max(0,input.legacyChance,graduated));
}

/** Keep every v31s slot's probability mass. Only the shared, bounded unused city
 * risk budget can fund the resident increment; extra candidates cannot add risk. */
export function getLocalResponseDrawDistribution(rows: readonly {legacyChance:number;chance:number;local:boolean}[], cap:number) {
  const baselineChance=Math.min(1,Math.max(0,...rows.map(r=>r.legacyChance)));
  const total=rows.reduce((sum,r)=>sum+Math.max(0,r.legacyChance),0);
  const baseline=rows.map(r=>total>0?baselineChance*Math.max(0,r.legacyChance)/total:0);
  const oldLocal=Math.max(0,...rows.filter(r=>r.local).map(r=>r.legacyChance));
  const newLocal=Math.max(0,...rows.filter(r=>r.local).map(r=>r.chance));
  const extraChance=Math.max(0,Math.min(cap-baselineChance,newLocal-oldLocal));
  const localWeight=rows.reduce((sum,r)=>sum+(r.local?Math.max(0,r.chance):0),0);
  const extra=rows.map(r=>r.local && localWeight>0 ? extraChance*Math.max(0,r.chance)/localWeight:0);
  return {baselineChance,extraChance,baseline,extra,probabilities:baseline.map((p,i)=>p+extra[i])};
}

export function selectLocalResponseOpportunity<T>(rows:Array<{legacyChance:number;chance:number;local:boolean;value:T}>,draw:number,cap:number):T|undefined {
  const d=getLocalResponseDrawDistribution(rows,cap);
  if(draw<=d.baselineChance) return selectRestorationOpportunity(rows.map(r=>({chance:r.legacyChance,value:r.value})),draw);
  let point=draw-d.baselineChance;
  if(point>d.extraChance || d.extraChance<=0) return undefined;
  for(let i=0;i<rows.length;i++){point-=d.extra[i];if(point<=0 && d.extra[i]>0)return rows[i].value;}
  return undefined;
}
