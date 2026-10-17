import type Team from "../Components/Team";
import type { WorldEvent } from "./WorldHistory";

export const ACCESSION_EVENT_TYPES = ["ruler-acceded", "ruler-succession", "ruler-deposed", "dynasty-usurped"];

/** Captured only by the live succession path; never consulted by historical rendering. */
export function captureAccessionCapital(team: Team, worldMonth: number, nextRulerId: string, previousRulerId?: string): Record<string, string | number | undefined> {
  const capital = team.capitalCity;
  const controlled = team.status === "ACTIVE" && team.identityStage === "STATE" && capital && !capital.destroyed &&
    capital.isCapital && capital.ownerFactionId === team.name && team.cities.includes(capital);
  return { accessionCapitalVersion: 1, accessionMonth: worldMonth, accessionFactionId: team.name,
    previousRulerId, nextRulerId, accessionFactionStatus: team.status, accessionIdentityStage: team.identityStage,
    accessionCapitalState: team.identityStage !== "STATE" ? "PROVISIONAL" : team.status === "EXILED" ? "EXILED" : controlled ? "CAPITAL" : "NO_CAPITAL",
    capitalControlled: controlled ? 1 : 0, capitalCityId: controlled ? capital.id : undefined,
    capitalCityName: controlled ? capital.name : undefined };
}

export function formatAccessionCapital(event: WorldEvent) {
  if (typeof event.metadata?.groupedAccessionCapitalText === "string") return event.metadata.groupedAccessionCapitalText;
  if (!ACCESSION_EVENT_TYPES.includes(event.type)) return undefined;
  const m = event.metadata;
  if (m?.accessionCapitalVersion !== 1) return "继位时国都：未记录";
  switch (m.accessionCapitalState) {
    case "CAPITAL": return `继位时国都：${m.capitalCityName}`;
    case "EXILED": return "流亡承统，当时无实际国都。";
    case "PROVISIONAL": return "继任时尚未正式建国，无正式国都。";
    default: return "继位时无实际国都。";
  }
}
