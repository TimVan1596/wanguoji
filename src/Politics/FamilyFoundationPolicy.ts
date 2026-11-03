/** Independent experiment/replay switch; never changes appointment or political probabilities. */
export const FAMILY_FOUNDATION_POLICIES=['Z48','BARON','FOUNDING'] as const;
export type FamilyFoundationPolicy=typeof FAMILY_FOUNDATION_POLICIES[number];
export function isFamilyFoundationPolicy(x:unknown):x is FamilyFoundationPolicy{return FAMILY_FOUNDATION_POLICIES.includes(x as FamilyFoundationPolicy);}
