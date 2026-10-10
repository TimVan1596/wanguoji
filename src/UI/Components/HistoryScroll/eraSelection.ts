import type { WorldEra } from "../../../Simulation/WorldEra";
import type { WorldEvent } from "../../../History/WorldHistory";

export const ALL_ERAS_ID = "all";

export interface EraSelectionUIState {
  selectedEraId: string;
  eraTimelineOpen: boolean;
  eraMapOpen: boolean;
}

export type EraSelectionUIAction =
  | { type: "SELECT"; eraId: string }
  | { type: "OPEN_ERA_MAP"; eraId: string }
  | { type: "NAVIGATE_MAP"; eraId: string }
  | { type: "TOGGLE"; eraId: string }
  | { type: "CLOSE_DETAIL" }
  | { type: "TOGGLE_TIMELINE" }
  | { type: "OPEN_MAP" }
  | { type: "CLOSE_MAP" }
  | { type: "RESET_IF_MISSING"; validEraIds: string[] };

export const initialEraSelectionUIState: EraSelectionUIState = {
  selectedEraId: ALL_ERAS_ID,
  eraTimelineOpen: false,
  eraMapOpen: false,
};

export function getSelectedEra<T extends Pick<WorldEra, "id">>(eras: T[], selectedEraId: string): T | undefined {
  return selectedEraId === ALL_ERAS_ID ? undefined : eras.find((era) => era.id === selectedEraId);
}

export function eraSelectionUIReducer(state: EraSelectionUIState, action: EraSelectionUIAction): EraSelectionUIState {
  switch (action.type) {
    case "OPEN_ERA_MAP":
      return { ...state, selectedEraId: action.eraId, eraMapOpen: action.eraId !== ALL_ERAS_ID };
    case "NAVIGATE_MAP":
      return { ...state, selectedEraId: action.eraId };
    case "SELECT":
      return { ...state, selectedEraId: action.eraId, eraMapOpen: false };
    case "TOGGLE":
      return {
        ...state,
        selectedEraId: state.selectedEraId === action.eraId ? ALL_ERAS_ID : action.eraId,
        eraMapOpen: false,
      };
    case "CLOSE_DETAIL":
      return { ...state, selectedEraId: ALL_ERAS_ID, eraMapOpen: false };
    case "TOGGLE_TIMELINE":
      return { ...state, eraTimelineOpen: !state.eraTimelineOpen };
    case "OPEN_MAP":
      return state.selectedEraId === ALL_ERAS_ID ? state : { ...state, eraMapOpen: true };
    case "CLOSE_MAP":
      return { ...state, eraMapOpen: false };
    case "RESET_IF_MISSING":
      return state.selectedEraId !== ALL_ERAS_ID && !action.validEraIds.includes(state.selectedEraId)
        ? { ...state, selectedEraId: ALL_ERAS_ID, eraMapOpen: false }
        : state;
    default:
      return state;
  }
}

export function getEventsForEraSelection(
  selectedEra: Pick<WorldEra, "startMonth" | "endMonth"> | undefined,
  allEvents: WorldEvent[],
  getEventsBetween: (startMonth: number, endMonth?: number) => WorldEvent[]
) {
  return selectedEra ? getEventsBetween(selectedEra.startMonth, selectedEra.endMonth) : allEvents;
}

export function orderAtlasEras<T extends Pick<WorldEra, "id" | "startMonth" | "confirmedMonth">>(eras: readonly T[]): T[] {
  return [...eras].sort((a, b) => a.startMonth - b.startMonth || a.confirmedMonth - b.confirmedMonth || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function getEraNeighbors(eras: readonly WorldEra[], selectedId: string) {
  const ordered = orderAtlasEras(eras), index = ordered.findIndex(e => e.id === selectedId);
  return { ordered, previous: index > 0 ? ordered[index - 1] : undefined, next: index >= 0 ? ordered[index + 1] : undefined };
}
export function getAtlasEraForEvent(event: WorldEvent, eras: readonly WorldEra[]): WorldEra | undefined {
  const id = event.metadata?.eraId;
  // Explicit identity wins; an unavailable era must not fall back to a neighbor.
  if (typeof id === "string") return eras.find(e => e.id === id);
  if (!["world-era-started", "world-unification", "world-hegemony", "world-fractured"].includes(event.type)) return undefined;
  const month = event.monthIndex ?? event.year;
  return orderAtlasEras(eras).find(e => e.startMonth <= month && (e.endMonth === undefined || month <= e.endMonth));
}
export function atlasArrowDirection(key: string, target?: { tagName?: string; isContentEditable?: boolean } | null) {
  if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return 0;
  return key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
}
