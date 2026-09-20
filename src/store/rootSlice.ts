import { createSlice } from "@reduxjs/toolkit";
import Team from "../Components/Team";
import { WorldPhase } from "../Simulation/WorldPhase";

export interface WorldResult {
  type: "unification" | "hegemony";
  teamName: string;
  year: number;
  monthIndex?: number;
  population: number;
  territory: number;
  territoryPercent: number;
  historyEventCount: number;
}

export interface RootDataState {
  teams: Team[];
  winTeam: Team | undefined;
  worldResult: WorldResult | undefined;
  worldMonth: number;
  worldYear: number;
  worldStarted: boolean;
  worldRunning: boolean;
  worldPhase: WorldPhase;
  simulationSpeed: number;
  selectedFactionName: string | undefined;
  selectedCityId: string | undefined;
  rightPanelTab: "history" | "faction" | "city" | "god";
  factionDetailTab: "overview" | "trend" | "house" | "chronicle";
  backgroundCatchUpActive: boolean;
  backgroundCatchUpOverlayVisible: boolean;
  backgroundCatchUpProgress: number;
  backgroundCatchUpCompletedSteps: number;
  backgroundCatchUpTotalSteps: number;
  backgroundCatchUpTruncated: boolean;
  backgroundCatchUpMessage: string | undefined;
}
const initialState: RootDataState = {
  teams: [],
  winTeam: undefined,
  worldResult: undefined,
  worldMonth: 0,
  worldYear: 0,
  worldStarted: false,
  worldRunning: false,
  worldPhase: "FRAGMENTED",
  simulationSpeed: 1,
  selectedFactionName: undefined,
  selectedCityId: undefined,
  rightPanelTab: "history",
  factionDetailTab: "overview",
  backgroundCatchUpActive: false,
  backgroundCatchUpOverlayVisible: false,
  backgroundCatchUpProgress: 1,
  backgroundCatchUpCompletedSteps: 0,
  backgroundCatchUpTotalSteps: 0,
  backgroundCatchUpTruncated: false,
  backgroundCatchUpMessage: undefined,
};

export const rootSlice = createSlice({
  name: "live",
  initialState,
  reducers: {
    setTeams: (state, action) => {
      state.teams = action.payload;
      if (
        state.selectedFactionName &&
        !action.payload.some((team: Team) => team.name === state.selectedFactionName)
      ) {
        state.selectedFactionName = undefined;
      }
    },
    updateTeams: (state) => {
      state.teams = [...state.teams];
    },
    setWinTeam: (state, action) => {
      state.winTeam = action.payload;
    },
    setWorldResult: (state, action) => {
      state.worldResult = action.payload;
    },
    dismissWorldResult: (state) => {
      state.worldResult = undefined;
    },
    setWorldMonth(state, action) {
      state.worldMonth = action.payload.monthIndex;
      state.worldYear = action.payload.year;
    },
    setWorldYear(state, action) {
      state.worldMonth = action.payload;
      state.worldYear = action.payload;
    },
    setWorldStarted(state, action) {
      state.worldStarted = action.payload;
    },
    setWorldRunning(state, action) {
      state.worldRunning = action.payload;
    },
    setWorldPhase(state, action) {
      state.worldPhase = action.payload;
    },
    setSimulationSpeed(state, action) {
      state.simulationSpeed = action.payload;
    },
    setSelectedFactionName(state, action) {
      state.selectedFactionName = action.payload;
    },
    setSelectedCityId(state, action) {
      state.selectedCityId = action.payload;
    },
    setRightPanelTab(state, action) {
      state.rightPanelTab = action.payload;
    },
    setFactionDetailTab(state, action) {
      state.factionDetailTab = action.payload;
    },
    setBackgroundCatchUpState(state, action) {
      state.backgroundCatchUpActive = action.payload.active;
      state.backgroundCatchUpOverlayVisible = action.payload.overlayVisible;
      state.backgroundCatchUpProgress = action.payload.progress;
      state.backgroundCatchUpCompletedSteps = action.payload.completedSteps;
      state.backgroundCatchUpTotalSteps = action.payload.totalSteps;
      state.backgroundCatchUpTruncated = action.payload.truncated;
      state.backgroundCatchUpMessage = action.payload.message;
    },
    resetWorldState() {
      return initialState;
    },
  },
});

export const {
  setTeams,
  updateTeams,
  setWinTeam,
  setWorldResult,
  dismissWorldResult,
  setWorldMonth,
  setWorldYear,
  setWorldStarted,
  setWorldRunning,
  setWorldPhase,
  setSimulationSpeed,
  setSelectedFactionName,
  setSelectedCityId,
  setRightPanelTab,
  setFactionDetailTab,
  setBackgroundCatchUpState,
  resetWorldState,
} = rootSlice.actions;

export default rootSlice.reducer;
