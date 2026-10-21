import { yearsToMonths } from "../Simulation/WorldTime";

export interface RulerLifespanBand {
  maxRoll: number;
  minAgeYears: number;
  maxAgeYears: number;
}

export const RULER_LIFESPAN_BANDS: RulerLifespanBand[] = [
  { maxRoll: 8, minAgeYears: 45, maxAgeYears: 54 },
  { maxRoll: 78, minAgeYears: 55, maxAgeYears: 74 },
  { maxRoll: 95, minAgeYears: 75, maxAgeYears: 84 },
  { maxRoll: 100, minAgeYears: 85, maxAgeYears: 92 },
];

export function createNaturalDeathMonth(
  birthMonth: number,
  roll: (maxExclusive: number) => number
) {
  const rollValue = roll(100);
  const band =
    RULER_LIFESPAN_BANDS.find((item) => rollValue < item.maxRoll) ??
    RULER_LIFESPAN_BANDS[RULER_LIFESPAN_BANDS.length - 1];
  const spanYears =
    band.minAgeYears + roll(band.maxAgeYears - band.minAgeYears + 1);
  return birthMonth + yearsToMonths(spanYears);
}

export function getAgeAtMonth(birthMonth: number, month: number) {
  return Math.max(0, Math.floor((month - birthMonth) / 12));
}

/** Conditional on this resident being demonstrably alive now. Up to age 85 the
 * original lifespan-band mass is spread over months. Its last 5% is an open,
 * increasing-hazard old-age tail, so even residents older than the old maximum
 * have a defined remaining life. No accession-relative minimum term. */
export function createSurvivingResidentDeathMonth(birthMonth:number,currentMonth:number,roll:(max:number)=>number){
  const age=Math.max(0,currentMonth-birthMonth),tailStart=85*12;
  const survival=(a:number)=>{
    if(a>=tailStart)return .05*Math.exp(-2.5*Math.expm1((a-tailStart)/120));
    let mass=.05,previous=0;
    for(const band of RULER_LIFESPAN_BANDS.slice(0,3)){
      const low=band.minAgeYears*12,high=(band.maxAgeYears+1)*12;
      mass+=(band.maxRoll-previous)/100*Math.max(0,Math.min(1,(high-Math.max(a,low))/(high-low)));
      previous=band.maxRoll;
    }
    return mass;
  };
  // Invert the conditional survival without subtracting tiny old-age probabilities.
  const u=(roll(0x1000000)+.5)/0x1000000;
  if(age>=tailStart){
    const delta=120*Math.log1p(-Math.log(u)/2.5*Math.exp(-(age-tailStart)/120));
    return currentMonth+Math.max(1,Math.ceil(delta));
  }
  const target=survival(age)*u;
  let low=age,high=tailStart;
  if(target<.05)high=tailStart+120*Math.log1p(-Math.log(target/.05)/2.5);
  else for(let i=0;i<50;i++){const mid=(low+high)/2;if(survival(mid)>target)low=mid;else high=mid;}
  return birthMonth+Math.max(age+1,Math.ceil(high));
}

export function deriveHeirBirthMonth(
  parentBirthMonth: number,
  currentMonth: number,
  roll: (maxExclusive: number) => number,
  minParentAgeMonths = 18 * 12,
  maxParentAgeMonths = 40 * 12
) {
  const parentAgeMonths = currentMonth - parentBirthMonth;
  if (parentAgeMonths < minParentAgeMonths) {
    return undefined;
  }
  const earliest = parentBirthMonth + minParentAgeMonths;
  const latest = Math.min(currentMonth, parentBirthMonth + maxParentAgeMonths);
  return earliest + roll(Math.max(1, latest - earliest + 1));
}

export function isNaturallyDeadByMonth(
  naturalDeathMonth: number | undefined,
  month: number
) {
  return naturalDeathMonth !== undefined && month >= naturalDeathMonth;
}
