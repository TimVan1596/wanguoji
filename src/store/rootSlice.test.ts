import { describe, expect, it } from "vitest";
import reducer, {
  resetWorldState,
  setSelectedFactionName,
  setTeams,
} from "./rootSlice";

function faction(name: string): any {
  return { name };
}

describe("root selection state", () => {
  it("does not auto-select the first faction when teams are synced", () => {
    let state = reducer(undefined, resetWorldState());
    state = reducer(state, setTeams([faction("秦"), faction("赵")]));
    expect(state.selectedFactionName).toBeUndefined();
  });

  it("keeps the selected faction when a runtime faction is added", () => {
    let state = reducer(undefined, resetWorldState());
    state = reducer(state, setTeams([faction("秦"), faction("赵")]));
    state = reducer(state, setSelectedFactionName("赵"));
    state = reducer(state, setTeams([faction("秦"), faction("赵"), faction("新郑义军")]));
    expect(state.selectedFactionName).toBe("赵");
  });

  it("keeps empty selection when a runtime faction is added", () => {
    let state = reducer(undefined, resetWorldState());
    state = reducer(state, setTeams([faction("秦"), faction("赵")]));
    state = reducer(state, setTeams([faction("秦"), faction("赵"), faction("新郑义军")]));
    expect(state.selectedFactionName).toBeUndefined();
  });

  it("keeps an extinct archived faction selection through unrelated runtime creation", () => {
    let state = reducer(undefined, resetWorldState());
    state = reducer(state, setTeams([faction("秦"), faction("赵")]));
    state = reducer(state, setSelectedFactionName("赵"));
    state = reducer(state, setTeams([faction("秦"), faction("赵"), faction("大梁义军")]));
    expect(state.selectedFactionName).toBe("赵");
  });

  it("clears selection only when the selected faction id is absent", () => {
    let state = reducer(undefined, resetWorldState());
    state = reducer(state, setTeams([faction("秦"), faction("赵")]));
    state = reducer(state, setSelectedFactionName("赵"));
    state = reducer(state, setTeams([faction("秦")]));
    expect(state.selectedFactionName).toBeUndefined();
  });
});
