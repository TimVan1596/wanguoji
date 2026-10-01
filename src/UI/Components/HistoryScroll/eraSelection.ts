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
