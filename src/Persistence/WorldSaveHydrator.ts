import Block from "../Components/Block";
import City from "../Components/City";
import Npc from "../Components/Npc";
import Player from "../Components/Player";
import Team from "../Components/Team";
import User from "../Components/User";
import Game from "../Game/Game";
import type Core from "../Game/Core";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import ArchivedCities from "../Simulation/ArchivedCities";
import CityNameRegistry from "../Simulation/CityNameRegistry";
import FactionEffects from "../Simulation/FactionEffects";
import FactionRegistry from "../Simulation/FactionRegistry";
import FactionSnapshots from "../Simulation/FactionSnapshots";
import { createLogicalUnitState } from "../Simulation/LogicalUnitState";
import PopulationSystem from "../Simulation/PopulationSystem";
import WorldEra from "../Simulation/WorldEra";
import WorldExiles from "../Simulation/WorldExiles";
import WorldRemnants from "../Simulation/WorldRemnants";
import { validateWorldState } from "../Simulation/WorldInvariant";
import { setWorldPhase } from "../store/rootSlice";
import { store } from "../store";
import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";
import { canonicalizeSavedSnapshotBoundary } from "./SnapshotBoundary";

export interface HydrationReport {
  worldMonth: number;
  factionCount: number;
  cityCount: number;
  unitCount: number;
  historyEventCount: number;
  validatorResult: "valid";
}

export function hydrateWorldSave(core: Core, value: unknown): HydrationReport {
  const validation = validateWorldSave(value);
  if (!validation.valid) throw new Error(`WorldSaveV1 rejected: ${validation.errors.join("; ")}`);
  const save = value as WorldSaveV1;
  if (save.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported save schema version: ${String(save.saveSchemaVersion)}`);
  }
  if (Game.Core !== core) throw new Error("Hydration target is not the active Phaser Core.");
  if (!save.world.started) throw new Error("Cannot hydrate a save that has not started a world.");
  const snapshotBoundary = canonicalizeSavedSnapshotBoundary({
    worldRunning: save.world.running,
    clockRunning: save.world.clock.running,
    clockElapsedMs: save.world.clock.elapsedMs,
    simulationAccumulatorMs: save.world.simulationDriver.accumulatorMs,
  });
  if (!snapshotBoundary) {
    throw new Error("WorldSaveV1 hydration requires the saved complete-month/fixed-step boundary.");
  }
  validateRequiredImportState(save);
  validateGeometryAndOwnership(save, core);

  // All preflight checks happen before teardown; malformed/incompatible saves leave the live world untouched.
  core.prepareForHydration(save.world.map);
  const teams = save.factions.map((state) => Team.hydrate(core.scene, state));
  const teamsById = new Map(teams.map((team) => [team.name, team]));
  core.setHydratedFactionShells(teams);

  const blocksByGrid = new Map<string, Block>();
  core.map!.blocks.forEach((column, x) => column.forEach((block, y) => blocksByGrid.set(`${x},${y}`, block)));

  const citiesById = new Map<string, City>();
  save.cities.forEach((state) => {
    const block = blocksByGrid.get(`${state.centerGridX},${state.centerGridY}`);
    if (!block) throw new Error(`Missing center block for city ${state.cityId}`);
    const city = City.hydrate(state, block, teamsById);
    citiesById.set(city.id, city);
    teamsById.get(city.ownerFactionId)!.addCity(city);
  });
  save.blocks.forEach((state) => {
    const block = blocksByGrid.get(`${state.gridX},${state.gridY}`)!;
    const city = state.cityId ? citiesById.get(state.cityId) : undefined;
    if (state.cityId && !city) throw new Error(`Block references an unavailable active city: ${state.cityId}`);
    block.restoreCanonicalState({
      owner: state.ownerFactionId ? teamsById.get(state.ownerFactionId) : undefined,
      isHome: state.isHome,
      hp: Number(state.homeHitPoints ?? 0),
      city,
      isCityCenter: Boolean(state.isCityCenter),
    });
  });
  save.cities.forEach((state) => {
    const city = citiesById.get(state.cityId)!;
    const orderedCells = Array.isArray(state.fortifiedCells)
      ? state.fortifiedCells as Array<{ gridX: number; gridY: number }>
      : save.blocks.filter((block) => block.cityId === state.cityId).map(({ gridX, gridY }) => ({ gridX, gridY }));
    city.fortifiedCells = orderedCells.map(({ gridX, gridY }) => {
      const block = blocksByGrid.get(`${gridX},${gridY}`);
      if (!block || block.city !== city) throw new Error(`City ${city.id} fortified block sequence conflicts with saved ownership.`);
      return block;
    });
  });
  save.factions.forEach((state) => {
    const team = teamsById.get(state.factionId)!;
    if (state.capitalCityId) {
      const capital = citiesById.get(state.capitalCityId)!;
      team.capital = capital.name;
      team.homeBlock = capital.block;
    }
  });
  citiesById.forEach((city) => city.rebuildRuntimeVisuals());

  importPoliticalAndHistoryState(save);
  const hydrated = hydrateUsersAndUnits(save, core, teamsById);
  const logicalSequence = (save.registries.logicalUnitRegistry as { nextUnitSequence: number }).nextUnitSequence;
  const logicalEntries = save.units.map((unit) => {
    const player = hydrated.playersByUnitId.get(unit.unitId)!;
    const user = unit.userId === undefined ? undefined : hydrated.usersById.get(String(unit.userId));
    return {
      player,
      user,
      state: {
        ...createLogicalUnitState({
          unitId: unit.unitId,
          factionId: unit.factionId,
          x: unit.x,
          y: unit.y,
          vx: unit.vx,
          vy: unit.vy,
          blockSize: Game.BlockSize,
          radius: unit.radius,
          speed: unit.speed,
          userId: typeof unit.userId === "number" ? unit.userId : undefined,
          role: unit.role === "RULER" ? "RULER" : "NORMAL",
          rulerId: unit.rulerId,
        }),
        alive: unit.alive,
      },
    };
  });
  core.logicalUnitRegistry.importState(logicalSequence, logicalEntries);
  core.simulationDriver.importState({ accumulatorMs: snapshotBoundary.simulationAccumulatorMs });
  core.simulator!.importState({
    started: true,
    selectedSpeed: save.world.selectedSpeed,
    clock: { worldMonth: save.world.clock.worldMonth, elapsedMs: snapshotBoundary.clockElapsedMs, running: false },
    populationSystem: save.populationSystem as ReturnType<PopulationSystem["exportState"]>,
    worldEventSystem: save.worldEventSystem as ReturnType<NonNullable<Core["simulator"]>["exportState"]>["worldEventSystem"],
  });
  core.simulator!.setRunning(false);
  core.installHydratedTeams(teams);
  core.setSimulationSpeed(save.world.selectedSpeed);
  store.dispatch(setWorldPhase(core.simulator!.getCurrentPhase(teams)));
  core.scene.physics.world.pause();
  core.scene.time.paused = true;
  core.scene.tweens.pauseAll();

  const invariantIssues = validateWorldState(core);
  if (invariantIssues.length) throw new Error(`Hydrated world invariant failure: ${invariantIssues.join("; ")}`);
  if (WorldHistory.getEventCount() !== (save.worldHistory.events as unknown[]).length) {
    throw new Error("Hydration changed canonical WorldHistory event count.");
  }
  if (core.logicalUnitRegistry.getAliveUnits().length !== save.units.filter((unit) => unit.alive).length) {
    throw new Error("Hydrated active logical unit count does not match the save.");
  }
  return {
    worldMonth: save.world.worldMonth,
    factionCount: teams.length,
    cityCount: save.cities.length,
    unitCount: hydrated.unitCount,
    historyEventCount: WorldHistory.getEventCount(),
    validatorResult: "valid",
  };
}

function hydrateUsersAndUnits(save: WorldSaveV1, core: Core, teams: Map<string, Team>) {
  const playersByUnitId = new Map<string, Player>();
  const usersById = new Map<string, User>();
  const unitById = new Map(save.units.map((unit) => [unit.unitId, unit]));
  const childIds = new Set(save.units.flatMap((unit) => Array.isArray(unit.children) ? unit.children as string[] : []));
  const userSaves = save.users;

  userSaves.forEach((state) => {
    const team = teams.get(state.factionId)!;
    const unit = unitById.get(state.playerUnitId)!;
    const player = new Player(core.scene, unit.x, unit.y, team);
    player.logicalUnitId = unit.unitId;
    player.setTeam(team);
    const user = new User(Number(state.userId), state.name, team, player, state.face as string | undefined, state.loyalty,
      state.role === "RULER" ? "RULER" : "NORMAL", typeof state.rulerId === "string" ? state.rulerId : undefined, { deferRuntime: true });
    user.sourceTeam = teams.get(state.sourceFactionId)!;
    user.score = state.score;
    user.isFaceLoadDone = true;
    player.user = user;
    team.users.add(user);
    if (user.role === "RULER") team.rulerUser = user;
    usersById.set(String(state.userId), user);
    playersByUnitId.set(unit.unitId, player);
    applyUnitState(player, unit);
  });

  const createTree = (unitId: string, inheritedKind?: string, parent?: Player, user?: User, group?: Phaser.GameObjects.Group) => {
    const unit = unitById.get(unitId);
    if (!unit) throw new Error(`Missing unit ${unitId}`);
    let player = playersByUnitId.get(unitId);
    const kind = String(unit.kind ?? inheritedKind ?? "player");
    const team = teams.get(unit.factionId)!;
    const resolvedUser = user ?? (unit.userId === undefined ? undefined : usersById.get(String(unit.userId)));
    if (!player) {
      const parentGroup = group ?? (kind === "slave" ? resolvedUser?.slaveGroup : kind === "farm-npc" ? team.farms : undefined);
      if (kind === "slave" || kind === "farm-npc") {
        if (!parentGroup) throw new Error(`Missing NPC runtime group for ${unitId}`);
        player = new Npc(core.scene, unit.x, unit.y, team, parentGroup, parent);
      } else {
        player = new Player(core.scene, unit.x, unit.y, team, parent);
        player.setTeam(team);
      }
      player.logicalUnitId = unit.unitId;
      player.user = resolvedUser;
      if (parent) parent.children.push(player);
      playersByUnitId.set(unitId, player);
      applyUnitState(player, unit);
      if (player instanceof Npc) {
        const color = unit.npcLevelColor;
        if (typeof color === "number") player.faceBg.setFillStyle(color);
        const faceKey = unit.npcFaceKey ?? unit.faceKey;
        if (typeof faceKey === "string" && core.scene.textures.exists(faceKey)) {
          player.setFace(faceKey);
          applyUnitState(player, unit);
        }
        if (kind === "slave" && resolvedUser && typeof unit.npcKey === "string") resolvedUser.slaveGroup.npcs.set(unit.npcKey, player);
        if (kind === "farm-npc" && typeof unit.npcKey === "string") team.farms.npcs.set(unit.npcKey, player);
      }
    }
    const children = Array.isArray(unit.children) ? unit.children as string[] : save.units.filter((candidate) => candidate.parentUnitId === unitId).map((candidate) => candidate.unitId);
    children.forEach((childId) => createTree(childId, kind, player, resolvedUser, group));
    return player;
  };

  userSaves.forEach((state) => {
    const user = usersById.get(String(state.userId))!;
    createTree(state.playerUnitId, "user", undefined, user);
  });

  userSaves.forEach((state) => {
    const user = usersById.get(String(state.userId))!;
    (Array.isArray(state.slaveUnits) ? state.slaveUnits as string[] : []).forEach((unitId) => createTree(unitId, "slave", undefined, user, user.slaveGroup));
  });
  save.units.filter((unit) => !childIds.has(unit.unitId) && !playersByUnitId.has(unit.unitId)).forEach((unit) => {
    const user = unit.userId === undefined ? undefined : usersById.get(String(unit.userId));
    createTree(unit.unitId, String(unit.kind ?? "player"), undefined, user);
  });
  save.factions.forEach((state) => {
    const team = teams.get(state.factionId)!;
    const farmsRuntime = state.farmsRuntime as { timers?: Array<{ name: string; elapsedMs: number; remainingMs: number; repeatCount: number; paused: boolean }> } | undefined;
    team.farms.init(farmsRuntime?.timers ?? []);
  });
  save.units.forEach((unit) => {
    const faceKey = unit.faceKey;
    const player = playersByUnitId.get(unit.unitId);
    if (player && typeof faceKey === "string" && core.scene.textures.exists(faceKey)) {
      player.setFace(faceKey);
      applyUnitState(player, unit);
    }
  });
  return { unitCount: playersByUnitId.size, playersByUnitId, usersById };
}

function applyUnitState(player: Player, unit: WorldSaveV1["units"][number]) {
  player.applyHydratedMovementState({
    x: unit.x, y: unit.y, vx: unit.vx, vy: unit.vy, speed: unit.speed,
    radius: unit.radius, scale: unit.scale, speedCoefficient: unit.speedCoefficient,
    sizeCoefficient: unit.sizeCoefficient, role: unit.role === "RULER" ? "RULER" : "NORMAL",
    rulerId: unit.rulerId, alive: unit.alive,
  });
}

function importPoliticalAndHistoryState(save: WorldSaveV1) {
  const dynasties = save.dynasties.map((entry) => ({
    ...entry,
    rulers: (entry.rulers as Record<string, unknown>[]).map((ruler) => {
      const { rulerId, bornMonth, naturalDeathMonth, accessionMonth, plannedEndMonth, endMonth, politicalStartMonth, politicalEndMonth, ...rest } = ruler;
      return { ...rest, id: rulerId, bornYear: bornMonth, naturalDeathYear: naturalDeathMonth, accessionYear: accessionMonth,
        plannedEndYear: plannedEndMonth, endYear: endMonth, politicalStartYear: politicalStartMonth, politicalEndYear: politicalEndMonth };
    }),
  }));
  DynastyRegistry.importState({ dynasties, sequence: Number(save.registries.dynastyRegistrySequence) } as ReturnType<typeof DynastyRegistry.exportState>);
  WorldHistory.importState(save.worldHistory as Parameters<typeof WorldHistory.importState>[0]);
  WorldEra.importState(save.worldEra as Parameters<typeof WorldEra.importState>[0]);
  FactionSnapshots.importState(save.factionSnapshots as Parameters<typeof FactionSnapshots.importState>[0]);
  WorldRemnants.importState(save.worldRemnants as Parameters<typeof WorldRemnants.importState>[0]);
  WorldExiles.importState(save.worldExiles as unknown as Parameters<typeof WorldExiles.importState>[0]);
  FactionEffects.importState(save.factionEffects as Parameters<typeof FactionEffects.importState>[0]);
  FactionRegistry.importState(save.registries.factionRegistry as Parameters<typeof FactionRegistry.importState>[0]);
  CityNameRegistry.importState(save.registries.cityNameRegistry as Parameters<typeof CityNameRegistry.importState>[0]);
  const archived = (save.registries.archivedCities as Record<string, unknown>[]).map((city) => ({
    ...city,
    history: (city.history as Record<string, unknown>[]).map(({ monthIndex, ...event }) => ({ ...event, year: monthIndex })),
  }));
  ArchivedCities.importState(archived as Parameters<typeof ArchivedCities.importState>[0]);
}

function validateGeometryAndOwnership(save: WorldSaveV1, core: Core) {
  const { widthCells, heightCells, blockSize } = save.world.map;
  if (!Number.isInteger(widthCells) || !Number.isInteger(heightCells) || widthCells <= 0 || heightCells <= 0 || blockSize <= 0) {
    throw new Error("Save contains invalid map geometry.");
  }
  if (save.blocks.length !== widthCells * heightCells) throw new Error("Save must contain authoritative ownership for every map cell.");
  const blockCoordinates = new Set<string>();
  save.blocks.forEach((block) => {
    if (block.gridX < 0 || block.gridY < 0 || block.gridX >= widthCells || block.gridY >= heightCells) throw new Error("Save block coordinate is outside its map geometry.");
    const key = `${block.gridX},${block.gridY}`;
    if (blockCoordinates.has(key)) throw new Error(`Duplicate block coordinate ${key}.`);
    blockCoordinates.add(key);
  });
  const factionIds = new Set(save.factions.map((faction) => faction.factionId));
  save.cities.forEach((city) => {
    if (!factionIds.has(city.ownerFactionId) || !factionIds.has(city.founderFactionId)) throw new Error(`City ${city.cityId} has an unknown faction reference.`);
    const zone = save.blocks.filter((block) => block.cityId === city.cityId);
    if (!zone.some((block) => block.isCityCenter && block.gridX === city.centerGridX && block.gridY === city.centerGridY)) throw new Error(`City ${city.cityId} has no saved center-cell relationship.`);
    if (zone.some((block) => block.ownerFactionId !== city.ownerFactionId)) throw new Error(`City ${city.cityId} fortified zone ownership conflicts with its owner.`);
    if (Array.isArray(city.fortifiedCells)) {
      const savedZone = city.fortifiedCells as Array<{ gridX: number; gridY: number }>;
      if (savedZone.length !== zone.length || savedZone.some(({ gridX, gridY }) => !zone.some((block) => block.gridX === gridX && block.gridY === gridY))) {
        throw new Error(`City ${city.cityId} fortified zone sequence does not match authoritative block references.`);
      }
    }
    const contacts = Array.isArray(city.siegeContacts) ? city.siegeContacts as Array<{ factionId: string }> : [];
    if (contacts.some((contact) => !factionIds.has(contact.factionId))) throw new Error(`City ${city.cityId} has an unknown siege faction reference.`);
  });
  if (core.scene.renderer.width / blockSize !== widthCells || core.scene.renderer.height / blockSize !== heightCells || blockSize !== Game.BlockSize) {
    throw new Error("Save map geometry is incompatible with this runtime; hydration does not scale coordinates.");
  }
}

function validateRequiredImportState(save: WorldSaveV1) {
  const records: Array<[string, Record<string, unknown>, string[], string[]]> = [
    ["worldHistory", save.worldHistory, ["events", "emittedKeys", "extinctFactionIds"], ["sequence", "unificationCount"]],
    ["worldEra", save.worldEra, ["eras"], ["sequence", "lastObservedMonth"]],
    ["factionSnapshots", save.factionSnapshots, ["snapshots"], ["lastSnapshotMonth"]],
    ["factionEffects", save.factionEffects, ["effects", "strategicModifiers"], ["sequence"]],
    ["populationSystem", save.populationSystem as unknown as Record<string, unknown>, [], ["lastGrowthMonth"]],
    ["worldEventSystem", save.worldEventSystem, ["activeEffects", "cityFoundedMonths", "cityRebellionMonths", "cycleState"], ["nextEventMonth", "sequence", "fractureUntilMonth", "lastRebellionCheckMonth", "lastEmpireSplitCheckMonth", "lastCityFoundCheckMonth", "lastProvisionalPressureMonth"]],
  ];
  records.forEach(([label, record, arrays, numbers]) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Save is missing ${label} import state.`);
    arrays.forEach((key) => { if (!Array.isArray(record[key])) throw new Error(`Save ${label}.${key} is missing or malformed.`); });
    numbers.forEach((key) => { if (typeof record[key] !== "number" || !Number.isFinite(record[key])) throw new Error(`Save ${label}.${key} must be finite.`); });
  });
  const registries = save.registries as Record<string, unknown>;
  [["factionRegistry", ["sequence"]], ["cityNameRegistry", ["reserved", "recentDynamicNames"]], ["logicalUnitRegistry", ["nextUnitSequence"]]]
    .forEach(([name, keys]) => {
      const registry = registries[name as string];
      if (!registry || typeof registry !== "object" || Array.isArray(registry)) throw new Error(`Save is missing registry ${String(name)}.`);
      (keys as string[]).forEach((key) => {
        const field = (registry as Record<string, unknown>)[key];
        const valid = key === "sequence" || key === "nextUnitSequence"
          ? typeof field === "number" && Number.isFinite(field) && field >= 0
          : Array.isArray(field);
        if (!valid) throw new Error(`Save registry ${String(name)}.${key} is malformed.`);
      });
    });
  if (!Array.isArray(registries.archivedCities)) throw new Error("Save registries.archivedCities is missing or malformed.");
  if (typeof registries.dynastyRegistrySequence !== "number" || !Number.isFinite(registries.dynastyRegistrySequence)) throw new Error("Save dynasty registry sequence must be finite.");
  save.factions.forEach((faction) => {
    [faction.firstFoundedMonth, faction.currentActiveSinceMonth, faction.cumulativeActiveMonths, faction.homeGridX, faction.homeGridY]
      .forEach((value) => { if (!Number.isFinite(value)) throw new Error(`Faction ${faction.factionId} has a non-finite canonical number.`); });
    if (!faction.origin || typeof faction.origin !== "object") throw new Error(`Faction ${faction.factionId} is missing origin state.`);
  });
  save.cities.forEach((city) => {
    [city.centerGridX, city.centerGridY, city.foundedMonth, city.defense, city.maxDefense, city.loyalty, city.devastation, city.captureCount]
      .forEach((value) => { if (!Number.isFinite(value)) throw new Error(`City ${city.cityId} has a non-finite canonical number.`); });
  });
  save.units.forEach((unit) => {
    [unit.x, unit.y, unit.vx, unit.vy, unit.speed, unit.radius, unit.scale, unit.speedCoefficient, unit.sizeCoefficient]
      .forEach((value) => { if (!Number.isFinite(value)) throw new Error(`Unit ${unit.unitId} has a non-finite movement value.`); });
    if (unit.radius <= 0 || unit.scale <= 0 || unit.speed < 0) throw new Error(`Unit ${unit.unitId} has invalid physical dimensions or speed.`);
    if (unit.role !== "NORMAL" && unit.role !== "RULER") throw new Error(`Unit ${unit.unitId} has an unsupported role.`);
  });
  save.users.forEach((user) => {
    if (typeof user.userId !== "number" || !Number.isFinite(user.userId)) throw new Error(`User id ${String(user.userId)} is not supported by the current runtime.`);
    if (!Number.isFinite(user.loyalty) || !Number.isFinite(user.score)) throw new Error(`User ${user.userId} has invalid canonical values.`);
  });
}
