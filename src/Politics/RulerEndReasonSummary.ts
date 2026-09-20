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
      if (ruler.endReason === "去世") {
        summary.natural += 1;
      } else if (ruler.endReason === "战死") {
        summary.battle += 1;
      } else if (ruler.endReason === "被俘处死") {
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
