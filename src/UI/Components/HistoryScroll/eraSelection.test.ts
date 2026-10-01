import { describe, expect, it, vi } from "vitest";
import {
  ALL_ERAS_ID,
  eraSelectionUIReducer,
  getEventsForEraSelection,
  getSelectedEra,
  initialEraSelectionUIState,
} from "./eraSelection";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../../../Persistence/WorldSaveSchema";

describe("HistoryScroll Era selection UI state", () => {
  it("selects Era A, then toggles the same timeline entry off", () => {
    const selected = eraSelectionUIReducer(initialEraSelectionUIState, { type: "SELECT", eraId: "A" });
    expect(selected.selectedEraId).toBe("A");
    const toggledOn = eraSelectionUIReducer(selected, { type: "TOGGLE", eraId: "A" });
    expect(toggledOn.selectedEraId).toBe(ALL_ERAS_ID);
    const toggledBackOn = eraSelectionUIReducer(toggledOn, { type: "TOGGLE", eraId: "A" });
    expect(toggledBackOn.selectedEraId).toBe("A");
  });

  it("closes detail and map together and returns to all-era history", () => {
    const selected = { ...initialEraSelectionUIState, selectedEraId: "A", eraMapOpen: true };
    const closed = eraSelectionUIReducer(selected, { type: "CLOSE_DETAIL" });
    expect(closed).toMatchObject({ selectedEraId: ALL_ERAS_ID, eraMapOpen: false });
    expect(getSelectedEra([{ id: "A" }], closed.selectedEraId)).toBeUndefined();
    const allEvents = [{ id: "a" }, { id: "b" }] as any[];
    expect(getEventsForEraSelection(undefined, allEvents, () => [])).toBe(allEvents);
  });

  it("switches A to B, resets the old map dialog, and filters selected-era history", () => {
    const selectedA = { ...initialEraSelectionUIState, selectedEraId: "A", eraMapOpen: true };
    const selectedB = eraSelectionUIReducer(selectedA, { type: "SELECT", eraId: "B" });
    expect(selectedB).toMatchObject({ selectedEraId: "B", eraMapOpen: false });
    const getEventsBetween = vi.fn(() => [{ id: "B-event" }] as any[]);
    const result = getEventsForEraSelection({ startMonth: 12, endMonth: 24 }, [], getEventsBetween);
    expect(result).toEqual([{ id: "B-event" }]);
    expect(getEventsBetween).toHaveBeenCalledWith(12, 24);
  });

  it("keeps the selected Era when the timeline list is collapsed", () => {
    const selected = { ...initialEraSelectionUIState, selectedEraId: "A" };
    const collapsed = eraSelectionUIReducer(selected, { type: "TOGGLE_TIMELINE" });
    expect(collapsed).toMatchObject({ selectedEraId: "A", eraTimelineOpen: true });
  });

  it("selection changes and stale-era reset cannot leave a dialog referencing the previous map", () => {
    const selected = eraSelectionUIReducer(
      { ...initialEraSelectionUIState, selectedEraId: "A", eraMapOpen: true },
      { type: "RESET_IF_MISSING", validEraIds: ["B"] }
    );
    expect(selected).toMatchObject({ selectedEraId: ALL_ERAS_ID, eraMapOpen: false });
    expect(eraSelectionUIReducer(initialEraSelectionUIState, { type: "OPEN_MAP" }).eraMapOpen).toBe(false);
  });

  it("keeps the save schema version unchanged", () => {
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(1);
  });
});
