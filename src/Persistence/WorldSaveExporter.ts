import type Core from "../Game/Core";
import Game from "../Game/Game";
import Npc from "../Components/Npc";
import Player from "../Components/Player";
import ArchivedCities from "../Simulation/ArchivedCities";
import CityNameRegistry from "../Simulation/CityNameRegistry";
import FactionEffects from "../Simulation/FactionEffects";
import FactionRegistry from "../Simulation/FactionRegistry";
import FactionSnapshots from "../Simulation/FactionSnapshots";
import WorldEra from "../Simulation/WorldEra";
import WorldExiles from "../Simulation/WorldExiles";
import WorldRemnants from "../Simulation/WorldRemnants";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";
import { isSafeSnapshotBoundary } from "./SnapshotBoundary";
import { validateWorldSave } from "./WorldSaveValidator";
import { APP_VERSION } from "../config/version";

export class UnsafeSaveSnapshotError extends Error {
  constructor() {
    super("A v1 snapshot requires a paused world at a complete month and fixed-step boundary.");
    this.name = "UnsafeSaveSnapshotError";
  }
}

/** Exports a paused, safe-boundary world. This is a data export only, not a hydration API. */
export function exportWorldSave(core: Core, options: { createdAt?: string; scenarioId?: string } = {}): WorldSaveV1 {
  const sim = core.simulator?.exportState();
  const driver = core.simulationDriver.exportState();
  if (!sim || core.backgroundProgression.isCatchingUp() || !isSafeSnapshotBoundary({
    paused: !sim.running,
    clockElapsedMs: sim.clock.elapsedMs,
    simulationAccumulatorMs: driver.accumulatorMs,
  })) throw new UnsafeSaveSnapshotError();

  const teams = core.teams;
  const factions = teams.map((team) => team.exportState());
  const factionIds = new Set(teams.map((team) => team.name));
  const cities = core.allCities.map((city) => {
    const gridX = Math.round(city.block.x / Game.BlockSize);
    const gridY = Math.round(city.block.y / Game.BlockSize);
    return city.exportState(gridX, gridY);
  });
  const users: Record<string, unknown>[] = [];
  const units: Record<string, unknown>[] = [];
  const seenUnits = new Set<Player>();
  let generatedUnitSequence = 1;
  const stableUnitId = (player: Player) => player.logicalUnitId ?? `runtime-unit-${generatedUnitSequence++}`;
  const addUnitTree = (player: Player, parentUnitId?: string, kind: string = "player", npcKey?: string) => {
    if (seenUnits.has(player)) return stableUnitId(player);
    seenUnits.add(player);
    const unitId = stableUnitId(player);
    const state: Record<string, unknown> = player.exportMovementState(unitId);
    state.parentUnitId = parentUnitId;
    state.kind = kind;
    if (npcKey) state.npcKey = npcKey;
    if (player instanceof Npc) {
      state.npcFaceKey = player.face?.texture?.key;
      state.npcLevelColor = player.faceBg?.fillColor;
    }
    units.push(state);
    state.children = player.children.map((child) => addUnitTree(child, unitId, kind));
    return unitId;
  };

  teams.forEach((team) => {
    [...team.users].forEach((user) => {
      const rootUnitId = addUnitTree(user.player, undefined, "user");
      users.push({
        userId: user.id,
        name: user.name,
        factionId: user.team.name,
        sourceFactionId: user.sourceTeam.name,
        loyalty: user.loyalty,
        role: user.role,
        rulerId: user.rulerId,
        score: user.score,
        face: user.face,
        playerUnitId: rootUnitId,
        slaveUnits: [...user.slaveGroup.npcs.entries()].map(([npcKey, npc]) => addUnitTree(npc, undefined, "slave", npcKey)),
      });
    });
    team.farms.npcs.forEach((npc, key) => addUnitTree(npc, undefined, "farm-npc", key));
  });

  const blocks = core.map?.blocks.flatMap((column, gridX) => column.map((block, gridY) => ({
    gridX,
    gridY,
    ownerFactionId: block.team?.name,
    isHome: block.isHome,
    homeHitPoints: block.hp,
    cityId: block.city?.id,
    isCityCenter: block.isCityCenter,
  }))) ?? [];
  const dynastyState = DynastyRegistry.exportState();
  const dynasties = dynastyState.dynasties.map((dynasty) => ({
    ...dynasty,
    rulers: dynasty.rulers.map((ruler) => {
      const { id, bornYear, naturalDeathYear, accessionYear, plannedEndYear, endYear, politicalStartYear, politicalEndYear, ...rest } = ruler;
      return {
        ...rest,
        rulerId: id,
        bornMonth: bornYear,
        naturalDeathMonth: naturalDeathYear,
        accessionMonth: accessionYear,
        plannedEndMonth: plannedEndYear,
        endMonth: endYear,
        politicalStartMonth: politicalStartYear,
        politicalEndMonth: politicalEndYear,
      };
    }),
  }));
  const autoState = core.simulator?.exportState();
  if (!autoState) throw new UnsafeSaveSnapshotError();
  const raw: WorldSaveV1 = {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: options.createdAt,
    scenarioId: options.scenarioId,
    world: {
      worldMonth: autoState.clock.worldMonth,
      started: autoState.started,
      running: autoState.running,
      selectedSpeed: autoState.selectedSpeed,
      clock: { elapsedMs: autoState.clock.elapsedMs, running: autoState.clock.running },
      simulationDriver: driver,
      map: {
        widthCells: core.map?.getMaxX() ?? 0,
        heightCells: core.map?.getMaxY() ?? 0,
        blockSize: Game.BlockSize,
      },
    },
    factions,
    blocks,
    cities,
    users,
    units,
    dynasties,
    worldHistory: WorldHistory.exportState(),
    worldEra: WorldEra.exportState(),
    factionSnapshots: FactionSnapshots.exportState(),
    worldRemnants: WorldRemnants.exportState(),
    worldExiles: WorldExiles.exportState(),
    factionEffects: FactionEffects.exportState(),
    populationSystem: autoState.populationSystem,
    registries: {
      factionRegistry: FactionRegistry.exportState(),
      cityNameRegistry: CityNameRegistry.exportState(),
      logicalUnitRegistry: core.logicalUnitRegistry.exportState(),
      dynastyRegistrySequence: dynastyState.sequence,
      archivedCities: ArchivedCities.list().map((city) => ({ ...city, destroyedMonth: city.destroyedMonth, foundedMonth: city.foundedMonth })),
      knownFactionIds: [...factionIds],
    },
    worldEventSystem: autoState.worldEventSystem,
  };
  const jsonSafe = omitUndefined(raw) as WorldSaveV1;
  const validation = validateWorldSave(jsonSafe);
  if (!validation.valid) throw new Error(`WorldSaveV1 export failed validation: ${validation.errors.join("; ")}`);
  return jsonSafe;
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => omitUndefined(entry)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (entry !== undefined) result[key] = omitUndefined(entry);
    });
    return result as T;
  }
  return value;
}
