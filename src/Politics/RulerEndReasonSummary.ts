import { hasRecordedRulerDeath } from "./RulerLifeState";
import type { Ruler } from "./Dynasty";

export interface RulerEndReasonSummary {
  natural: number;
  battle: number;
  capture: number;
  other: number;
}

export function summarizeRulerEndReasons(rulers: Ruler[]): RulerEndReasonSummary {
  return rulers.reduce<RulerEndReasonSummary>(
    (summary, ruler) => {
      if (ruler.endYear === undefined) {
        return summary;
      }
      if (hasRecordedRulerDeath(ruler) && (ruler.deathReason === "去世" || ruler.deathReason === "自然去世")) {
        summary.natural += 1;
      } else if (hasRecordedRulerDeath(ruler) && ruler.deathReason === "战死") {
        summary.battle += 1;
      } else if (hasRecordedRulerDeath(ruler) && ruler.deathReason === "被俘处死") {
        summary.capture += 1;
      } else {
        summary.other += 1;
      }
      return summary;
    },
    {
      natural: 0,
      battle: 0,
      capture: 0,
      other: 0,
    }
  );
}
