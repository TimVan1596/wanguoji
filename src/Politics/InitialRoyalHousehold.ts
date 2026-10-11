import { HEIR_PARENT_MIN_AGE_AT_BIRTH, HEIR_PARENT_MAX_AGE_AT_BIRTH } from "../config/simulation";
import { deriveHeirBirthMonth } from "./RulerLifespanRules";

export interface InitialRelativePlan { kind: "PARENT" | "SIBLING" | "CHILD"; bornMonth: number }
/** A small new-world household, never a target-sized succession pool. Months throughout. */
export function planInitialRoyalHousehold(founderBornMonth: number, month: number,
  roll: (length: number) => number): InitialRelativePlan[] {
  const age = month - founderBornMonth;
  const choice = roll(100);
  // Young founders more often lack children. No family is guaranteed.
  const young = age < 22 * 12;
  const none = young ? 30 : 15;
  const childOnlyEnd = young ? 55 : 60;
  const siblingOnlyEnd = young ? 90 : 85;
  if (choice < none) return [];
  const child = choice < childOnlyEnd || choice >= siblingOnlyEnd;
  const sibling = choice >= childOnlyEnd;
  const result: InitialRelativePlan[] = [];
  if (sibling) {
    const parentBornMonth = founderBornMonth - (HEIR_PARENT_MIN_AGE_AT_BIRTH + roll(5)) * 12;
    const earliest = Math.max(parentBornMonth + HEIR_PARENT_MIN_AGE_AT_BIRTH * 12, founderBornMonth - 48);
    const latest = Math.min(month, parentBornMonth + HEIR_PARENT_MAX_AGE_AT_BIRTH * 12, founderBornMonth + 48);
    if (earliest <= latest) result.push({ kind: "PARENT", bornMonth: parentBornMonth },
      { kind: "SIBLING", bornMonth: earliest + roll(latest - earliest + 1) });
  }
  if (child) {
    const bornMonth = deriveHeirBirthMonth(founderBornMonth, month, roll,
      HEIR_PARENT_MIN_AGE_AT_BIRTH * 12, HEIR_PARENT_MAX_AGE_AT_BIRTH * 12);
    if (bornMonth !== undefined) result.push({ kind: "CHILD", bornMonth });
  }
  return result;
}
