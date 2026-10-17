import type { Ruler } from "../Politics/Dynasty";
import type { RulerSaveV16 } from "./WorldSaveSchema";

export function exportRulerSave(ruler: Ruler): RulerSaveV16 {
  const { id, bornYear, naturalDeathYear, accessionYear, plannedEndYear, endYear, politicalStartYear, politicalEndYear, ...rest } = ruler;
  return { ...rest, rulerId: id, bornMonth: bornYear, naturalDeathMonth: naturalDeathYear,
    accessionMonth: accessionYear, plannedEndMonth: plannedEndYear, endMonth: endYear,
    politicalStartMonth: politicalStartYear, politicalEndMonth: politicalEndYear };
}
/** Input is already validated before teardown. No inference or initialization. */
export function importRulerSave(ruler: RulerSaveV16): Ruler {
  const { rulerId, bornMonth, naturalDeathMonth, accessionMonth, plannedEndMonth, endMonth, politicalStartMonth, politicalEndMonth, ...rest } = ruler;
  return { ...rest, id: rulerId, bornYear: bornMonth, naturalDeathYear: naturalDeathMonth,
    accessionYear: accessionMonth, plannedEndYear: plannedEndMonth, endYear: endMonth,
    politicalStartYear: politicalStartMonth, politicalEndYear: politicalEndMonth };
}
