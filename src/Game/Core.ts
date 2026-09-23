import CardController from "../Card/Controller";
import Block from "../Components/Block";
import Map from "../Components/Map";
import { MessageToast } from "../Components/MessageToast";
import Player from "../Components/Player";
import Team from "../Components/Team";
import City from "../Components/City";
import Game from "./Game";
import WorldHistory from "../History/WorldHistory";
import AutoSimulator from "../Simulation/AutoSimulator";
import WorldRemnants from "../Simulation/WorldRemnants";
import { resolveFactionStatus } from "../Simulation/FactionLifecycle";
import { hasFormalStateIdentity } from "../Simulation/FactionIdentity";
import WorldExiles from "../Simulation/WorldExiles";
import DynastyRegistry from "../Politics/Dynasty";
import FactionRegistry from "../Simulation/FactionRegistry";
import FactionEffects from "../Simulation/FactionEffects";
import ArchivedCities from "../Simulation/ArchivedCities";
import CityNameRegistry from "../Simulation/CityNameRegistry";
import { RuntimeFactionRegistry } from "../Simulation/RuntimeFactionRegistry";
import { validateWorldState } from "../Simulation/WorldInvariant";
import { getCityCameraFocusTarget } from "../Simulation/MapInteraction";
import { CityInteractionIndex } from "../Simulation/CityInteractionIndex";
import {
  CityPointerResolution,
  getPointerDragDistance,
  logCityClickProbe,
  resolveCityPointerPosition,
} from "../Simulation/CityClickProbe";
import { InitialPopulationMap } from "../Simulation/PopulationSystem";
import SimulationDriver from "../Simulation/SimulationDriver";
import {
  BASE_PLAY_RATE,
  SIMULATION_FIXED_STEP_MS,
} from "../Simulation/SimulationDriver";
import ManualArcadePhysicsStepper from "../Simulation/PhysicsStepLifecycle";
import BackgroundProgressionController, {
  CATCH_UP_CPU_BUDGET_MS,
  MAX_CATCH_UP_STEPS_PER_FRAME,
} from "../Simulation/BackgroundProgressionController";
import LogicalSimulationCore from "../Simulation/LogicalSimulationCore";
import LogicalUnitRegistry from "../Simulation/LogicalUnitRegistry";
import WorldEra from "../Simulation/WorldEra";
import {
  FACTION_LABEL_REFRESH_MONTHS,
  FOCUSED_FACTION_OTHER_OPACITY,
  EXTINCTION_LOW_SURRENDER_CHANCE,
  EXTINCTION_MID_SURRENDER_CHANCE,
  EXTINCTION_REMNANT_LOYALTY,
  RULER_ESCAPE_BASE_CHANCE,
} from "../config/simulation";
import { store } from "../store";
import { ConfigState } from "../store/configSlice";
import {
  setTeams,
  updateTeams,
  setWinTeam,
  setWorldResult,
  setWorldRunning,
  setWorldStarted,
  setWorldMonth,
  setSelectedFactionName,
  setSimulationSpeed,
  setSelectedCityId,
  setRightPanelTab,
  setBackgroundCatchUpState,
} from "../store/rootSlice";
import { setTodayMvpUsers } from "../store/topSlice";
import { SnapshotBoundaryRequest } from "../Persistence/SnapshotBoundary";
import User from "../Components/User";
import {
  getGridGodRuntimeMode,
  GridGodRuntimeMode,
} from "../Runtime/DesktopRuntime";

type DesktopRuntimeDiagnostics = {
  desktopMode: boolean;
  documentVisibilityState: DocumentVisibilityState | "unknown";
  focused: boolean;
  worldMonth: number;
  fixedSteps: number;
  physicsSteps: number;
  lastSimulationStepRealAt: number;
  catchUpDebtSteps: number;
};

export default class Core {
  map: Map | undefined;
  config: ConfigState | undefined;
  private runtimeFactions = new RuntimeFactionRegistry<Team>();
  isGameOver = false;
  toast: MessageToast | undefined;

  static PLAYER_DEPTH = 2000;
  static TOAST_DEPTH = 3000;
  cardController: CardController | undefined;
  simulator: AutoSimulator | undefined;
  simulationDriver = new SimulationDriver();
  backgroundProgression = new BackgroundProgressionController();
  logicalUnitRegistry = new LogicalUnitRegistry();
  logicalSimulationCore = new LogicalSimulationCore({
    registry: this.logicalUnitRegistry,
    getWorldMonth: () => this.simulator?.year ?? 0,
  });
  logicalGameplayAuthority = false;
  manualPhysicsStepping = true;
  private manualPhysicsStepper = new ManualArcadePhysicsStepper();
  private simulationDiagnostics = {
    fixedSimulationSteps: 0,
    physicsSteps: 0,
    occupationCallbacks: 0,
    siegeContactSubmissions: 0,
    userDeaths: 0,
  };
  factionLabels = new globalThis.Map<string, Phaser.GameObjects.Text>();
  mapTooltip: Phaser.GameObjects.Text | undefined;
  private lastLabelYear = -1;
  private lastFocusedFactionName: string | undefined;
  private lastFocusSyncYear = -1;
  private lastInvariantYear = -1;
  private hoveredCityId: string | undefined;
  readonly cityInteractionIndex = new CityInteractionIndex();
  private pointerDownScreen: { x: number; y: number } | undefined;
  private worldInstanceId = 0;
  private visibilityListenerBound = false;
  private snapshotBoundaryRequest = new SnapshotBoundaryRequest();
  private runtimeMode: GridGodRuntimeMode = getGridGodRuntimeMode();
  private lastDesktopHeartbeatAt = 0;
  private catchUpDiagnostics = {
    hiddenElapsedRealMs: 0,
    requestedCatchUpSteps: 0,
    executedCatchUpSteps: 0,
    remainingSteps: 0,
    catchUpFrames: 0,
    catchUpCpuMs: 0,
    truncated: false,
  };
  private desktopRuntimeDiagnostics: DesktopRuntimeDiagnostics = {
    desktopMode: this.runtimeMode === "DESKTOP_CONTINUOUS",
    documentVisibilityState: "unknown",
    focused: true,
    worldMonth: 0,
    fixedSteps: 0,
    physicsSteps: 0,
    lastSimulationStepRealAt: 0,
    catchUpDebtSteps: 0,
  };

  constructor(public game: Phaser.Game, public scene: Phaser.Scene) {}

  get teams() {
    return this.runtimeFactions.list();
  }

  clearUp() {
    this.snapshotBoundaryRequest.cancel(new Error("Safe snapshot request was canceled because the world was reset."));
    this.worldInstanceId += 1;
    this.isGameOver = false;
    WorldRemnants.reset();
    WorldExiles.reset();
    ArchivedCities.reset();
    CityNameRegistry.reset();
    DynastyRegistry.reset();
    FactionRegistry.reset();
    FactionEffects.reset();
    store.dispatch(setWorldStarted(false));
    store.dispatch(setWorldRunning(false));
    store.dispatch(setWorldMonth({ monthIndex: 0, year: 0 }));
    store.dispatch(setSimulationSpeed(1));
    store.dispatch(setSelectedFactionName(undefined));
    store.dispatch(setSelectedCityId(undefined));
    store.dispatch(setRightPanelTab("history"));
    store.dispatch(setWinTeam(undefined));
    store.dispatch(setWorldResult(undefined));
    this.factionLabels.clear();
    this.mapTooltip = undefined;
    this.lastLabelYear = -1;
    this.lastFocusedFactionName = undefined;
    this.lastFocusSyncYear = -1;
    this.lastInvariantYear = -1;
    this.hoveredCityId = undefined;
    this.pointerDownScreen = undefined;
    this.cityInteractionIndex.reset();
    this.simulationDriver.reset();
    this.backgroundProgression.reset();
    this.syncBackgroundCatchUpStore();
    this.logicalUnitRegistry.reset();
    this.logicalSimulationCore.reset();
    this.manualPhysicsStepper.reset();
    this.resetSimulationDiagnostics();
    this.unbindMapPointerResolver();
  }

  async init(scene: Phaser.Scene) {
    this.clearUp();
    this.scene = scene;
    this.config = store.getState().config;
    this.runtimeMode = getGridGodRuntimeMode();
    this.desktopRuntimeDiagnostics.desktopMode =
      this.runtimeMode === "DESKTOP_CONTINUOUS";
    this.map = new Map(this.scene);
    this.bindMapPointerResolver();
    this.bindVisibilityListener();
    this.cardController = new CardController(this.scene, this.config.cards);
    const initialTeams = this.config.teams.map((team) => {
      const homeX = this.resolveSpawn(team.homeX, team.spawnX, "x");
      const homeY = this.resolveSpawn(team.homeY, team.spawnY, "y");
      return new Team(
        this.scene,
        team.name,
        team.color,
        homeX,
        homeY,
        team.joinCommand,
        team.shortName,
        team.capital,
        team.houseName,
        team.icon,
        team.hall,
        team.tile,
        team.farms,
        true,
        Boolean(team.capitalIndestructible)
      );
    });
    this.runtimeFactions.reset(initialTeams);
    this.createInitialCities();
    this.rebuildCityInteractionIndex();

    this.teams.forEach((team) => this.registerTeamColliders(team));
    store.dispatch(setTeams(this.teams));
    store.dispatch(setSelectedFactionName(undefined));
    store.dispatch(setSelectedCityId(undefined));

    this.toast = new MessageToast(this.scene, {
      x: this.scene.renderer.width / 2,
      y: this.scene.renderer.height - 40,
      text: this.scene.add.text(0, 0, "", {
        fontSize: "30px",
        stroke: "#000",
        strokeThickness: 5,
      }),
      duration: {
        hold: 1000,
      },
    }).setDepth(Core.TOAST_DEPTH);
    this.simulator = new AutoSimulator();
    this.setSimulationSpeed(1);
    this.asyncTeamsToStore();
  }

  asyncTeamsToStore() {
    this.scene.time.addEvent({
      delay: 500,
      callback: () => {
        store.dispatch(updateTeams());
      },
      loop: true,
    });
  }

  addRuntimeTeam(team: Team) {
    const existingTeams = this.teams;
    if (!this.runtimeFactions.register(team)) {
      console.error(`[Wanguoji] Runtime faction id duplicated: ${team.name}`);
      return false;
    }
    this.registerTeamColliders(team);
    existingTeams.forEach((existingTeam) => {
      this.scene.physics.add.collider(
        existingTeam.players,
        team.blocks,
        //@ts-ignore
        this.onPlayerOverlapBlock.bind(this)
      );
      this.scene.physics.add.collider(
        existingTeam.farms,
        team.blocks,
        //@ts-ignore
        this.onPlayerOverlapBlock.bind(this)
      );
    });
    store.dispatch(setTeams(this.teams));
    return true;
  }

  private registerTeamColliders(team: Team) {
    const otherTeamsBlock = this.teams
      .filter((t) => t !== team)
      .map((t) => t.blocks);
    if (!this.map) {
      return;
    }
    this.scene.physics.add.collider(
      team.players,
      [this.map.blocksGroup, ...otherTeamsBlock],
      //@ts-ignore
      this.onPlayerOverlapBlock.bind(this)
    );
    this.scene.physics.add.collider(
      team.farms,
      [this.map.blocksGroup, ...otherTeamsBlock],
      //@ts-ignore
      this.onPlayerOverlapBlock.bind(this)
    );
  }

  createInitialCities() {
    this.teams.forEach((team) => {
      if (!team.homeBlock) {
        return;
      }
      const cityName = team.capital ?? `${team.name}都城`;
      const cityId = `city-${team.name}-${cityName}`;
      const reservedCityName = CityNameRegistry.allocateCityName(cityName, cityId, 0);
      new City(
        cityId,
        reservedCityName,
        team.name,
        team.homeBlock,
        0,
        true,
        team.capitalIndestructible,
        team.capitalIndestructible
      );
    });
  }

  onPlayerOverlapBlock(player: Player, block: Block) {
    if (this.logicalGameplayAuthority) {
      return;
    }
    this.simulationDiagnostics.occupationCallbacks += 1;
    if (block.city && block.city.ownerTeam !== player.team) {
      this.simulationDiagnostics.siegeContactSubmissions += 1;
    }
    block.setTeam(player.team, player);
    if (player.user) {
      player.user.score += 1;
    }
    this.checkGameOver();
  }

  checkGameOver() {
    this.simulator?.observeWorld(this.teams, this.totalCells);
  }

  checkGameOverByTime() {
    const aliveTeams = this.teams.filter((team) => !team.isDie);
    // get max blocks team
    const maxBlocksTeam = aliveTeams.reduce((max, team) => {
      return team.blocks.children.size > max.blocks.children.size ? team : max;
    });
    this.onGameOver(maxBlocksTeam);
  }

  onGameOver(team: Team) {
    if (this.isGameOver) return;
    store.dispatch(setWinTeam(team));
    const mvpUser = team.mvpUser;
    if (mvpUser) {
      store.dispatch(setTodayMvpUsers(mvpUser));
    }
  }

  handleFactionExtinction(
    fallenTeam: Team,
    conqueror: Team,
    finalCity: City,
    year: number,
    historyGroupId?: string
  ) {
    const users = [...fallenTeam.users];
    let surrenderedPopulation = 0;
    let disbandedPopulation = 0;
    let remnantPopulation = 0;

    users.forEach((user) => {
      if (user.loyalty >= EXTINCTION_REMNANT_LOYALTY) {
        remnantPopulation += 1;
        user.destroyUser(true);
        return;
      }

      const surrenderChance =
        user.loyalty < 40
          ? EXTINCTION_LOW_SURRENDER_CHANCE
          : EXTINCTION_MID_SURRENDER_CHANCE;
      if (Math.random() <= surrenderChance) {
        surrenderedPopulation += 1;
        user.obedience(conqueror);
      } else {
        disbandedPopulation += 1;
        user.destroyUser(true);
      }
    });

    const eventMetadata = {
      conquerorFactionId: conqueror.name,
      cityId: finalCity.id,
      cityName: finalCity.name,
      populationBefore: users.length,
      surrenderedPopulation,
      disbandedPopulation,
      remnantPopulation,
      attackerPopulation: conqueror.users.size,
      defenderPopulation: users.length,
      attackerTerritoryShare:
        (conqueror.blocks.children.size / Math.max(this.totalCells, 1)) * 100,
      defenderTerritoryShare:
        (fallenTeam.blocks.children.size / Math.max(this.totalCells, 1)) * 100,
      previousOwner: fallenTeam.name,
      founder: finalCity.founderFactionId,
      wasCapital: finalCity.isCapital ? 1 : 0,
    };

    if (!hasFormalStateIdentity(fallenTeam)) {
      WorldRemnants.setPopulation(fallenTeam.name, 0, year);
      fallenTeam.markExtinct(year);
      DynastyRegistry.markExtinct(fallenTeam, year);
      WorldHistory.addFactionDissolved(
        year,
        fallenTeam.name,
        eventMetadata,
        historyGroupId
      );
      WorldHistory.addPopulationSurrendered(
        year,
        fallenTeam.name,
        conqueror.name,
        surrenderedPopulation,
        historyGroupId
      );
      return;
    }

    WorldRemnants.add(fallenTeam.name, remnantPopulation, year);
    const rulerEscaped =
      remnantPopulation > 0 && Math.random() <= getRulerEscapeChance(remnantPopulation);
    const heirContinues =
      remnantPopulation > 0 &&
      (rulerEscaped || DynastyRegistry.resolveCapturedRuler(fallenTeam, conqueror, year));
    const nextStatus = resolveFactionStatus(
      fallenTeam.cities.length,
      heirContinues ? remnantPopulation : 0
    );
    if (nextStatus === "EXILED") {
      fallenTeam.markExiled(year);
      DynastyRegistry.markExiled(fallenTeam, year);
      WorldExiles.start(fallenTeam, year, remnantPopulation);
      WorldHistory.addFactionExiled(
        year,
        fallenTeam.name,
        DynastyRegistry.getRulerTitleDisplay(fallenTeam.name, year),
        remnantPopulation,
        eventMetadata,
        historyGroupId
      );
    } else {
      WorldRemnants.setPopulation(fallenTeam.name, 0, year);
      fallenTeam.markExtinct(year);
      DynastyRegistry.markExtinct(fallenTeam, year);
      WorldHistory.addFactionExtinct(
        year,
        fallenTeam.name,
        `${fallenTeam.name}国残部消散，${fallenTeam.name}国彻底灭亡`,
        eventMetadata,
        historyGroupId
      );
    }
    WorldHistory.addPopulationSurrendered(
      year,
      fallenTeam.name,
      conqueror.name,
      surrenderedPopulation,
      historyGroupId
    );
  }

  handleRulerCombatDeath(user: User) {
    if (!this.simulator || user.role !== "RULER" || !user.rulerId) {
      return true;
    }
    return DynastyRegistry.handleRulerCombatDeath(
      user.team,
      user.rulerId,
      this.simulator.year
    );
  }

  startWorld(populations: InitialPopulationMap) {
    if (!this.simulator || !this.map) {
      return;
    }
    this.simulationDriver.reset();
    this.backgroundProgression.reset();
    this.syncBackgroundCatchUpStore();
    this.worldInstanceId += 1;
    this.manualPhysicsStepper.reset();
    this.resetSimulationDiagnostics();
    this.simulator.startWorld(this.teams, this.totalCells, populations);
  }

  setWorldRunning(running: boolean) {
    if (!this.simulator) {
      return;
    }
    if (this.backgroundProgression.isCatchingUp()) {
      return;
    }
    this.simulator.setRunning(running);
    if (running) {
      this.scene.time.paused = false;
      this.scene.tweens.resumeAll();
      this.scene.physics.world.resume();
    } else {
      this.scene.time.paused = true;
      this.scene.tweens.pauseAll();
      this.scene.physics.world.pause();
    }
  }

  pauseAtNextSafeSnapshotBoundary() {
    const simulation = this.simulator?.exportState();
    const request = this.snapshotBoundaryRequest.request({
      worldStarted: Boolean(this.simulator && store.getState().root.worldStarted),
      catchingUp: this.backgroundProgression.isCatchingUp(),
      worldMonth: simulation?.clock.worldMonth ?? 0,
      paused: !this.simulator?.isRunning(),
      clockElapsedMs: simulation?.clock.elapsedMs ?? Number.NaN,
      simulationAccumulatorMs: this.simulationDriver.getAccumulatorMs(),
    });
    if (request.pending && !this.simulator?.isRunning()) this.setWorldRunning(true);
    return request.promise;
  }

  getSnapshotRequestDiagnostics() {
    return this.snapshotBoundaryRequest.getDiagnostics();
  }

  prepareForHydration(expected: { widthCells: number; heightCells: number; blockSize: number }) {
    if (this.backgroundProgression.isCatchingUp()) throw new Error("Cannot hydrate during background catch-up.");
    if (this.simulator?.isRunning()) throw new Error("Hydration requires a paused world.");
    if (expected.blockSize !== Game.BlockSize || expected.widthCells !== this.scene.renderer.width / Game.BlockSize || expected.heightCells !== this.scene.renderer.height / Game.BlockSize) {
      throw new Error("Save map geometry is incompatible with the current runtime; no coordinates were scaled.");
    }
    this.scene.physics.world.pause();
    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
    this.scene.physics.world.colliders.getActive().forEach((collider) => collider.destroy());
    const destroyedPlayers = new Set<Player>();
    const destroyPlayer = (player: Player) => {
      if (destroyedPlayers.has(player)) return;
      destroyedPlayers.add(player);
      [...player.children].forEach(destroyPlayer);
      player.children = [];
      player.line?.destroy();
      player.team.players.remove(player);
      player.destroy(true);
    };
    this.teams.forEach((team) => {
      team.farms.setDie();
      team.users.forEach((user) => {
        user.slaveGroup.collider?.destroy();
        [...user.slaveGroup.npcs.values()].forEach(destroyPlayer);
        user.slaveGroup.npcs.clear();
        user.slaveGroup.clear(false, false);
        user.slaveGroup.destroy(true, false);
      });
      [...team.farms.npcs.values()].forEach(destroyPlayer);
      team.farms.npcs.clear();
      [...team.players.getChildren()].forEach((player) => destroyPlayer(player as Player));
      team.players.clear(false, false);
      team.players.destroy(true, false);
      team.blocks.clear(false, false);
      team.blocks.destroy(true, false);
      team.farms.clear(false, false);
      team.farms.destroy(true, false);
      team.cities.forEach((city) => city.destroyRuntimeVisuals());
    });
    this.map?.blocks.flat().forEach((block) => block.destroyRuntimeObjects());
    this.map?.blocksGroup.destroy(false);
    this.factionLabels.forEach((label) => label.destroy());
    this.mapTooltip?.destroy();
    this.clearUp();
    this.runtimeFactions.reset();
    this.map = new Map(this.scene);
    this.bindMapPointerResolver();
    this.simulator = new AutoSimulator();
    this.scene.physics.world.pause();
    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
  }

  installHydratedTeams(teams: Team[]) {
    this.runtimeFactions.reset(teams);
    teams.forEach((team) => this.registerTeamColliders(team));
    teams.flatMap((team) => [...team.users]).forEach((user) => user.slaveGroup.addCollider());
    this.rebuildCityInteractionIndex();
    store.dispatch(setTeams(teams));
    store.dispatch(setSelectedFactionName(undefined));
    store.dispatch(setSelectedCityId(undefined));
    store.dispatch(setRightPanelTab("history"));
  }

  setHydratedFactionShells(teams: Team[]) {
    this.runtimeFactions.reset(teams);
  }

  setSimulationSpeed(speed: number) {
    if (this.backgroundProgression.isCatchingUp()) {
      return;
    }
    const safeSpeed = Math.max(1, Math.min(4, speed));
    this.simulator?.setSpeed(safeSpeed);
    if (this.scene?.physics?.world) {
      this.scene.physics.world.timeScale = 1;
    }
    const effectivePlayRate = BASE_PLAY_RATE * safeSpeed;
    if (this.scene?.time) {
      this.scene.time.timeScale = effectivePlayRate;
    }
    if (this.scene?.tweens) {
      this.scene.tweens.timeScale = effectivePlayRate;
    }
  }

  selectCity(cityId: string) {
    store.dispatch(setSelectedCityId(cityId));
    store.dispatch(setRightPanelTab("city"));
    this.refreshCityVisuals();
  }

  rebuildCityInteractionIndex() {
    this.cityInteractionIndex.rebuild(this.allCities, Game.BlockSize);
  }

  registerCityInteraction(city: City) {
    this.cityInteractionIndex.registerCity(city, Game.BlockSize);
  }

  unregisterCityInteraction(cityId: string) {
    this.cityInteractionIndex.unregisterCity(cityId);
  }

  focusCity(cityId: string) {
    this.focusCameraOnCity(cityId);
  }

  focusCameraOnCity(cityId: string) {
    const city = this.allCities.find((item) => item.id === cityId);
    this.selectCity(cityId);
    if (!city) {
      return;
    }
    const camera = this.scene.cameras.main;
    const target = getCityCameraFocusTarget(
      city.block.x,
      city.block.y,
      Game.BlockSize,
      camera.zoom
    );
    camera.centerOn(target.centerX, target.centerY);
    camera.setZoom(target.zoom);
    city.setZoneHighlight(true);
    this.scene.time.delayedCall(1200, () => {
      if (store.getState().root.selectedCityId === city.id) {
        city.setZoneHighlight(false);
        city.block.updateCityDisplay();
      }
    });
  }

  selectFaction(name: string | undefined) {
    store.dispatch(setSelectedFactionName(name));
    if (name) {
      store.dispatch(setRightPanelTab("faction"));
    }
  }

  showCityTooltip(city: City, block: Block) {
    const owner = city.ownerTeam?.name ?? "无";
    const founder = city.founderTeam?.name ?? city.founderFactionId;
    const text = `${city.name}\n当前：${owner}\n原属：${founder}\n城防：${city.defense}/${city.maxDefense}\n忠诚：${city.loyalty}`;
    if (!this.mapTooltip) {
      this.mapTooltip = this.scene.add
        .text(0, 0, text, {
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#111111dd",
          padding: { x: 6, y: 4 },
        })
        .setDepth(Core.TOAST_DEPTH + 1);
    }
    this.mapTooltip.setText(text);
    this.mapTooltip.setPosition(block.x + Game.BlockSize + 4, block.y);
    this.mapTooltip.setVisible(true);
  }

  hideMapTooltip() {
    this.mapTooltip?.setVisible(false);
  }

  private bindMapPointerResolver() {
    this.unbindMapPointerResolver();
    this.scene.input.enabled = true;
    this.scene.input.topOnly = false;
    this.scene.input.on("pointerdown", this.handleMapPointerDown, this);
    this.scene.input.on("pointerup", this.handleMapPointerUp, this);
    this.scene.input.on("pointermove", this.handleMapPointerMove, this);
    this.scene.input.on("gameout", this.clearHoveredCity, this);
  }

  private unbindMapPointerResolver() {
    if (!this.scene?.input) {
      return;
    }
    this.scene.input.off("pointerdown", this.handleMapPointerDown, this);
    this.scene.input.off("pointerup", this.handleMapPointerUp, this);
    this.scene.input.off("pointermove", this.handleMapPointerMove, this);
    this.scene.input.off("gameout", this.clearHoveredCity, this);
  }

  private handleMapPointerDown(pointer: Phaser.Input.Pointer) {
    const position = this.resolvePointerPosition(pointer);
    this.pointerDownScreen = { x: position.canvasX, y: position.canvasY };
  }

  private handleMapPointerUp(pointer: Phaser.Input.Pointer) {
    const position = this.resolvePointerPosition(pointer);
    const dragDistance = getPointerDragDistance(this.pointerDownScreen, {
      x: position.canvasX,
      y: position.canvasY,
    });
    const selectedCityBefore = store.getState().root.selectedCityId;
    const interactionCityId = this.cityInteractionIndex.resolveGrid(
      position.gridX,
      position.gridY
    );
    const blockCityId = this.map
      ?.getBlock(position.gridX, position.gridY)
      ?.city?.id;
    if (!this.isPointerClick(dragDistance)) {
      this.pointerDownScreen = undefined;
      logCityClickProbe({
        ...position,
        cameraScrollX: this.scene.cameras.main.scrollX,
        cameraScrollY: this.scene.cameras.main.scrollY,
        cameraZoom: this.scene.cameras.main.zoom,
        dragDistance,
        pointerHandlerTriggered: true,
        interactionCityId,
        blockCityId,
        selectedCityBefore,
        selectedCityAfter: store.getState().root.selectedCityId,
      });
      return;
    }
    this.pointerDownScreen = undefined;
    const city = interactionCityId
      ? this.allCities.find((item) => item.id === interactionCityId)
      : undefined;
    if (city) {
      this.selectCity(city.id);
      logCityClickProbe({
        ...position,
        cameraScrollX: this.scene.cameras.main.scrollX,
        cameraScrollY: this.scene.cameras.main.scrollY,
        cameraZoom: this.scene.cameras.main.zoom,
        dragDistance,
        pointerHandlerTriggered: true,
        interactionCityId,
        blockCityId,
        selectedCityBefore,
        selectedCityAfter: store.getState().root.selectedCityId,
      });
      return;
    }
    this.selectFaction(undefined);
    logCityClickProbe({
      ...position,
      cameraScrollX: this.scene.cameras.main.scrollX,
      cameraScrollY: this.scene.cameras.main.scrollY,
      cameraZoom: this.scene.cameras.main.zoom,
      dragDistance,
      pointerHandlerTriggered: true,
      interactionCityId,
      blockCityId,
      selectedCityBefore,
      selectedCityAfter: store.getState().root.selectedCityId,
    });
  }

  private handleMapPointerMove(pointer: Phaser.Input.Pointer) {
    const city = this.resolveCityFromPointer(pointer);
    if (city?.id === this.hoveredCityId) {
      return;
    }
    this.clearHoveredCity();
    if (!city) {
      return;
    }
    this.hoveredCityId = city.id;
    city.setZoneHighlight(true);
    this.showCityTooltip(city, city.block);
  }

  private resolveCityFromPointer(pointer: Phaser.Input.Pointer) {
    const position = this.resolvePointerPosition(pointer);
    const cityId = this.cityInteractionIndex.resolveGrid(position.gridX, position.gridY);
    return cityId ? this.allCities.find((city) => city.id === cityId) : undefined;
  }

  private resolvePointerPosition(pointer: Phaser.Input.Pointer): CityPointerResolution {
    return resolveCityPointerPosition(
      pointer,
      this.scene.cameras.main,
      Game.BlockSize,
      this.game.canvas?.getBoundingClientRect(),
      {
        width: this.scene.renderer.width,
        height: this.scene.renderer.height,
      }
    );
  }

  private isPointerClick(dragDistance: number) {
    return dragDistance <= 6;
  }

  private clearHoveredCity() {
    if (this.hoveredCityId) {
      this.allCities
        .find((city) => city.id === this.hoveredCityId)
        ?.setZoneHighlight(false);
    }
    this.hoveredCityId = undefined;
    this.hideMapTooltip();
  }

  private refreshCityVisuals() {
    this.allCities.forEach((city) => {
      city.refreshZoneVisual();
      city.fortifiedCells.forEach((cell) => cell.updateCityDisplay());
    });
  }

  get allCities() {
    return this.teams.flatMap((team) => team.cities);
  }

  get allDynasties() {
    return DynastyRegistry.getAll();
  }

  get totalCells() {
    if (!this.map) {
      return 1;
    }
    return this.map.getMaxX() * this.map.getMaxY();
  }

  private resolveSpawn(
    fallback: number,
    ratio: number | undefined,
    axis: "x" | "y"
  ) {
    if (!this.map || ratio === undefined) {
      return fallback;
    }
    const max = axis === "x" ? this.map.getMaxX() : this.map.getMaxY();
    return Phaser.Math.Clamp(Math.round(ratio * (max - 1)), 1, max - 3);
  }

  update(delta: number) {
    if (this.simulator) {
      this.manualPhysicsStepper.beginFrame();
      if (this.backgroundProgression.consumeSuppressNextForegroundDelta()) {
        delta = 0;
        this.simulationDriver.reset();
      }
      if (this.backgroundProgression.isCatchingUp()) {
        this.runBackgroundCatchUpFrame();
      } else {
        const result = this.simulationDriver.updateForeground(delta, {
          isRunning: () => Boolean(this.simulator?.isRunning()),
          getSpeed: () => this.simulator?.getSpeed() ?? 1,
          getBasePlayRate: () => BASE_PLAY_RATE,
          step: (fixedDeltaMs) => this.advanceLogicalStep(fixedDeltaMs),
        });
        if (result.stopped) {
          const clock = this.simulator?.exportState().clock;
          this.snapshotBoundaryRequest.recordPreExportState(
            clock?.elapsedMs ?? Number.NaN,
            this.simulationDriver.getAccumulatorMs()
          );
        }
      }
      if (this.logicalGameplayAuthority) {
        this.logicalUnitRegistry.syncVisuals();
      }
    }
    this.validateWorldStateInDev();
    if (!this.backgroundProgression.isCatchingUp()) {
      this.refreshPresentationFrame();
    }
    this.updateDesktopRuntimeDiagnostics();
    this.sendDesktopHeartbeatIfNeeded();
  }

  private refreshPresentationFrame() {
    this.updateFactionLabels();
    this.updateFactionFocus();
    this.teams.filter((team) => team.status === "ACTIVE").forEach((team) => {
      team.players.children.each((player) => player.update());
      team.blocks.children.each((block) => block.update());
    });
  }

  private runBackgroundCatchUpFrame() {
    if (!this.simulator?.isRunning()) {
      this.backgroundProgression.reset();
      this.syncBackgroundCatchUpStore();
      return;
    }
    WorldHistory.beginBatchNotifications();
    WorldEra.beginBatchNotifications();
    let result;
    try {
      result = this.backgroundProgression.runChunk({
        maxSteps: MAX_CATCH_UP_STEPS_PER_FRAME,
        cpuBudgetMs: CATCH_UP_CPU_BUDGET_MS,
        nowMs: () => performance.now(),
        step: () => this.advanceLogicalStep(SIMULATION_FIXED_STEP_MS),
      });
    } finally {
      WorldEra.endBatchNotifications();
      WorldHistory.endBatchNotifications();
    }
    this.catchUpDiagnostics.executedCatchUpSteps += result.executedSteps;
    this.catchUpDiagnostics.remainingSteps = result.remainingSteps;
    this.catchUpDiagnostics.catchUpFrames += 1;
    this.catchUpDiagnostics.catchUpCpuMs += result.cpuMs;
    this.syncBackgroundCatchUpStore();
    if (result.complete) {
      this.onBackgroundCatchUpComplete();
    }
  }

  private onBackgroundCatchUpComplete() {
    this.simulationDriver.reset();
    this.syncBackgroundCatchUpStore();
    this.refreshCityVisuals();
    this.refreshPresentationFrame();
    store.dispatch(updateTeams());
  }

  private advanceLogicalStep(fixedDeltaMs: number): void | "stop-and-discard" {
    this.simulationDiagnostics.fixedSimulationSteps += 1;
    this.desktopRuntimeDiagnostics.lastSimulationStepRealAt =
      typeof performance === "undefined" ? Date.now() : performance.now();
    if (this.logicalGameplayAuthority) {
      this.logicalSimulationCore.step(fixedDeltaMs);
    } else if (this.manualPhysicsStepping) {
      this.advanceArcadePhysicsStep(fixedDeltaMs);
    }
    this.simulator?.advance(fixedDeltaMs, this.teams, this.totalCells);
    const clock = this.simulator?.exportState().clock;
    if (clock && this.snapshotBoundaryRequest.reachBoundary(clock.worldMonth, clock.elapsedMs)) {
      this.setWorldRunning(false);
      return "stop-and-discard";
    }
  }

  private advanceArcadePhysicsStep(fixedDeltaMs: number) {
    const world = this.scene?.physics?.world;
    if (!world) {
      return;
    }
    if (world.isPaused) {
      return;
    }
    world.timeScale = 1;
    if (this.manualPhysicsStepper.step(world, this.scene.game.loop.now, fixedDeltaMs)) {
      this.simulationDiagnostics.physicsSteps += 1;
    }
  }

  recordUserDeathForDiagnostics() {
    this.simulationDiagnostics.userDeaths += 1;
  }

  getSimulationDiagnostics() {
    return {
      ...this.simulationDiagnostics,
      ...this.manualPhysicsStepper.getDiagnostics(),
      backgroundCatchUp: { ...this.catchUpDiagnostics },
      desktopRuntime: { ...this.desktopRuntimeDiagnostics },
    };
  }

  private resetSimulationDiagnostics() {
    this.simulationDiagnostics = {
      fixedSimulationSteps: 0,
      physicsSteps: 0,
      occupationCallbacks: 0,
      siegeContactSubmissions: 0,
      userDeaths: 0,
    };
    this.catchUpDiagnostics = {
      hiddenElapsedRealMs: 0,
      requestedCatchUpSteps: 0,
      executedCatchUpSteps: 0,
      remainingSteps: 0,
      catchUpFrames: 0,
      catchUpCpuMs: 0,
      truncated: false,
    };
    this.desktopRuntimeDiagnostics = {
      desktopMode: this.runtimeMode === "DESKTOP_CONTINUOUS",
      documentVisibilityState:
        typeof document === "undefined" ? "unknown" : document.visibilityState,
      focused: typeof document === "undefined" ? true : document.hasFocus(),
      worldMonth: 0,
      fixedSteps: 0,
      physicsSteps: 0,
      lastSimulationStepRealAt: 0,
      catchUpDebtSteps: 0,
    };
    this.lastDesktopHeartbeatAt = 0;
  }

  private bindVisibilityListener() {
    if (this.visibilityListenerBound || typeof document === "undefined") {
      return;
    }
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.visibilityListenerBound = true;
  }

  private handleVisibilityChange = () => {
    if (!this.simulator || typeof document === "undefined") {
      return;
    }
    const nowMs = performance.now();
    if (document.hidden) {
      this.updateDesktopRuntimeDiagnostics();
      this.backgroundProgression.handleHidden({
        nowMs,
        selectedSpeed: this.simulator.getSpeed(),
        paused: !this.simulator.isRunning(),
        worldInstanceId: this.worldInstanceId,
        runtimeMode: this.runtimeMode,
      });
      this.syncBackgroundCatchUpStore();
      return;
    }

    const before = this.backgroundProgression.getSnapshot();
    const snapshot = this.backgroundProgression.handleVisible({
      nowMs,
      worldInstanceId: this.worldInstanceId,
      runtimeMode: this.runtimeMode,
    });
    if (snapshot.catchUpDebtSteps > 0) {
      this.simulationDriver.reset();
    }
    if (snapshot.catchUpTotalSteps !== before.catchUpTotalSteps) {
      this.catchUpDiagnostics.hiddenElapsedRealMs =
        snapshot.catchUpHiddenElapsedRealMs;
      this.catchUpDiagnostics.requestedCatchUpSteps =
        snapshot.catchUpTotalSteps;
      this.catchUpDiagnostics.remainingSteps = snapshot.catchUpDebtSteps;
      this.catchUpDiagnostics.truncated = snapshot.catchUpTruncated;
    }
    this.syncBackgroundCatchUpStore();
    this.updateDesktopRuntimeDiagnostics();
  };

  private syncBackgroundCatchUpStore() {
    const snapshot = this.backgroundProgression.getSnapshot();
    const completedMonths = Math.floor(
      (snapshot.catchUpCompletedSteps * SIMULATION_FIXED_STEP_MS) / 1000
    );
    const completedYears = Math.floor(completedMonths / 12);
    store.dispatch(
      setBackgroundCatchUpState({
        active: snapshot.mode === "CATCH_UP",
        overlayVisible: snapshot.mode === "CATCH_UP" && snapshot.catchUpShowOverlay,
        progress: snapshot.catchUpProgress,
        completedSteps: snapshot.catchUpCompletedSteps,
        totalSteps: snapshot.catchUpTotalSteps,
        truncated: snapshot.catchUpTruncated,
        message:
          completedYears > 0
            ? `已补算约 ${completedYears} 年`
            : undefined,
      })
    );
  }

  private updateDesktopRuntimeDiagnostics() {
    const snapshot = this.backgroundProgression.getSnapshot();
    this.desktopRuntimeDiagnostics = {
      desktopMode: this.runtimeMode === "DESKTOP_CONTINUOUS",
      documentVisibilityState:
        typeof document === "undefined" ? "unknown" : document.visibilityState,
      focused: typeof document === "undefined" ? true : document.hasFocus(),
      worldMonth: this.simulator?.year ?? 0,
      fixedSteps: this.simulationDiagnostics.fixedSimulationSteps,
      physicsSteps: this.simulationDiagnostics.physicsSteps,
      lastSimulationStepRealAt:
        this.desktopRuntimeDiagnostics.lastSimulationStepRealAt,
      catchUpDebtSteps: snapshot.catchUpDebtSteps,
    };
  }

  private sendDesktopHeartbeatIfNeeded() {
    if (this.runtimeMode !== "DESKTOP_CONTINUOUS") {
      return;
    }
    const bridge = typeof window === "undefined" ? undefined : window.gridGodDesktop;
    if (!bridge?.sendHeartbeat) {
      return;
    }
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    if (now - this.lastDesktopHeartbeatAt < 5000) {
      return;
    }
    this.lastDesktopHeartbeatAt = now;
    bridge.sendHeartbeat({
      worldMonth: this.desktopRuntimeDiagnostics.worldMonth,
      fixedSteps: this.desktopRuntimeDiagnostics.fixedSteps,
      physicsSteps: this.desktopRuntimeDiagnostics.physicsSteps,
      catchUpDebtSteps: this.desktopRuntimeDiagnostics.catchUpDebtSteps,
      documentVisibilityState:
        this.desktopRuntimeDiagnostics.documentVisibilityState,
      focused: this.desktopRuntimeDiagnostics.focused,
      timestamp: Date.now(),
    });
  }

  private validateWorldStateInDev() {
    if (!import.meta.env.DEV) {
      return;
    }
    const year = this.simulator?.year ?? 0;
    if (year === this.lastInvariantYear || year % 12 !== 0) {
      return;
    }
    this.lastInvariantYear = year;
    validateWorldState(this);
  }

  private updateFactionLabels() {
    const year = this.simulator?.year ?? 0;
    if (year === this.lastLabelYear || year % FACTION_LABEL_REFRESH_MONTHS !== 0) {
      return;
    }
    this.lastLabelYear = year;
    this.teams.forEach((team) => {
      if (team.status !== "ACTIVE") {
        const existingLabel = this.factionLabels.get(team.name);
        if (existingLabel) {
          existingLabel.setVisible(false);
        }
        return;
      }
      const positionBlock = this.getFactionLabelBlock(team);
      let label = this.factionLabels.get(team.name);
      if (!label) {
        label = this.scene.add
          .text(0, 0, team.displayName, {
            fontSize: "72px",
            color: "#ffffff",
            stroke: "#111111",
            strokeThickness: 8,
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setAlpha(0.22)
          .setDepth(450);
        label.disableInteractive();
        this.factionLabels.set(team.name, label);
      }
      label.setText(team.displayName);
      label.setVisible(Boolean(positionBlock && !team.isDie));
      if (positionBlock) {
        label.setPosition(
          positionBlock.x + Game.BlockSize / 2,
          positionBlock.y + Game.BlockSize / 2
        );
      }
    });
  }

  private getFactionLabelBlock(team: Team) {
    const blocks = team.blocks.children.getArray() as Block[];
    if (blocks.length === 0) {
      return undefined;
    }
    const center = blocks.reduce(
      (sum, block) => ({
        x: sum.x + block.x + Game.BlockSize / 2,
        y: sum.y + block.y + Game.BlockSize / 2,
      }),
      { x: 0, y: 0 }
    );
    center.x /= blocks.length;
    center.y /= blocks.length;
    return blocks
      .map((block) => ({
        block,
        distance:
          (block.x + Game.BlockSize / 2 - center.x) ** 2 +
          (block.y + Game.BlockSize / 2 - center.y) ** 2,
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.block;
  }

  private updateFactionFocus() {
    const selectedFactionName = store.getState().root.selectedFactionName;
    const year = this.simulator?.year ?? 0;
    if (
      selectedFactionName === this.lastFocusedFactionName &&
      year === this.lastFocusSyncYear
    ) {
      return;
    }
    this.lastFocusedFactionName = selectedFactionName;
    this.lastFocusSyncYear = year;
    this.teams.forEach((team) => {
      const focused = !selectedFactionName || selectedFactionName === team.name;
      const alpha = focused ? 1 : FOCUSED_FACTION_OTHER_OPACITY;
      team.blocks.children.each((block) => {
        (block as Block).setAlpha(alpha);
      });
      team.players.children.each((player) => {
        (player as Player).setAlpha(alpha);
      });
      const label = this.factionLabels.get(team.name);
      label?.setAlpha(focused ? 0.24 : 0.08);
    });
  }
}

function getRulerEscapeChance(remnantPopulation: number) {
  const remnantBonus = Math.min(0.18, remnantPopulation * 0.015);
  return Math.min(0.92, RULER_ESCAPE_BASE_CHANCE + remnantBonus);
}
