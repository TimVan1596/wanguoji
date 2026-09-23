import Game from "../Game/Game";
import { FarmConfig } from "../store/configSlice";
import Block from "./Block";
import City from "./City";
import Farms from "./Farms";
import Player from "./Player";
import User, { PlayerRole } from "./User";
import {
  FactionStatus,
  getCumulativeActiveYears,
  initializeFactionLifecycle,
  markLifecycleActive,
  markLifecycleExiled,
  markLifecycleExtinct,
} from "../Simulation/FactionLifecycle";
import {
  FactionIdentityStage,
  FactionNameHistoryEntry,
  FactionOrigin,
  SovereigntyHistoryEntry,
  SovereigntyRank,
  formFactionState,
  getFactionDisplayName,
  getFactionDisplayNameAtMonth,
  initializeFactionIdentity,
  proclaimEmperor,
} from "../Simulation/FactionIdentity";

export type { FactionStatus };
export type FactionType = "KINGDOM" | "REBEL" | "FRONTIER" | "SPLIT";

export default class Team {
  players: Phaser.GameObjects.Group;
  blocks: Phaser.GameObjects.Group;
  users: Set<User> = new Set();
  rulerUser: User | undefined;
  cities: City[] = [];
  homeBlock: Block | undefined;
  public joinCommand: string[] = [];
  public status: FactionStatus = "ACTIVE";
  public factionType: FactionType = "KINGDOM";
  public displayName: string;
  public identityStage: FactionIdentityStage = "STATE";
  public sovereigntyRank: SovereigntyRank = "KING";
  public sovereigntyHistory: SovereigntyHistoryEntry[] = [];
  public nameHistory: FactionNameHistoryEntry[] = [];
  public origin: FactionOrigin;
  public stateFormationEligibleSinceMonth: number | undefined;
  public stateFoundedMonth: number | undefined;
  public emperorEligibleSinceMonth: number | undefined;
  public proclaimedEmperorMonth: number | undefined;
  firstFoundedYear = 0;
  currentActiveSinceYear = 0;
  lastExiledYear: number | undefined;
  restorationYears: number[] = [];
  extinctionYear: number | undefined;
  cumulativeActiveYears = 0;
  farms: Farms;
  constructor(
    public scene: Phaser.Scene,
    public name: string,
    public color: number,
    public homeX: number,
    public homeY: number,
    joinCommand: string[],
    public shortName?: string,
    public capital?: string,
    public houseName?: string,
    public icon?: string,
    public hall?: string,
    public tile?: string,
    public npcsConfig?: FarmConfig[],
    autoInitHome = true,
    public capitalIndestructible = false
  ) {
    this.players = new Phaser.GameObjects.Group(scene);
    this.blocks = new Phaser.GameObjects.Group(scene);
    this.displayName = name;
    this.origin = {
      type: "INITIAL",
      foundedMonth: 0,
      foundingCityIds: [],
    };
    this.homeBlock = Game.Core.map?.getBlock(homeX, homeY);
    this.joinCommand = [...joinCommand, this.name];
    this.farms = new Farms(this.scene, this, this.npcsConfig);
    if (this.shortName) {
      this.joinCommand.push(this.shortName);
    }
    if (autoInitHome) {
      this.loadTile();
    }
    this.initializeIdentity(0);
  }

  loadTile() {
    if (!this.tile) {
      this.initHomeBlock();
      return;
    }
    this.scene.load.image(this.tile, this.tile);
    this.scene.load.once("complete", () => {
      this.initHomeBlock();
      this.initFarms();
    });
    this.scene.load.start();
  }

  initHomeBlock() {
    if (this.homeBlock) {
      this.homeBlock?.setFillStyle(this.color);
      this.homeBlock.setTeam(this);
      this.homeBlock?.setIsHome(this.hall);
    }
  }

  initFarms() {
    this.farms.init();
  }

  makeUser(
    id: number,
    name: string,
    face?: string,
    loyalty = 70,
    role: PlayerRole = "NORMAL",
    rulerId?: string
  ) {
    const spawnBlock = this.spawnBlock;
    if (!spawnBlock) return false;
    if (this.isDie) return false;
    if (Team.GetUserById(id)) return false;
    const { x, y } = spawnBlock;
    const player = new Player(this.scene, x, y, this);
    player.setTeam(this);
    const user = new User(id, name, this, player, face, loyalty, role, rulerId);
    player.user = user;
    player.setRole(role, rulerId);
    user.setTeam(this);
    Game.Core?.logicalUnitRegistry.registerPlayer(player, user);
    if (role === "RULER") {
      this.rulerUser = user;
    }
    return user;
  }

  getUserById(id: number) {
    return [...this.users].find((user) => user.id === id);
  }

  removeOneUser() {
    for (const user of this.users) {
      if (user.destroyUser()) {
        return;
      }
    }
  }

  static GetUserById(id: number) {
    const teams = Game.Core.teams;
    const users = teams.map((v) => [...v.users]).flat();
    return users.find((user) => user.id === id);
  }

  static GetMinPlayerTeam() {
    const teams = Game.Core.teams;
    const minTeam = [...teams].sort(
      (a, b) => a.players.children.size - b.players.children.size
    )[0];
    return minTeam;
  }

  static GetOtherTeams(team: Team) {
    return Game.Core.teams.filter((t) => t !== team);
  }

  hasJoinKeyword(text: string) {
    return this.joinCommand.some((c) => c === text) || this.displayName === text;
  }

  initializeIdentity(year: number) {
    initializeFactionIdentity(this, year);
    if (this.origin.type === "INITIAL") {
      this.origin.foundedMonth = year;
    }
  }

  setOrigin(origin: FactionOrigin) {
    this.origin = {
      ...origin,
      foundingCityIds: origin.foundingCityIds
        ? [...origin.foundingCityIds]
        : undefined,
    };
  }

  formState(displayName: string, year: number) {
    const formed = formFactionState(this, displayName, year);
    if (formed && !this.joinCommand.includes(displayName)) {
      this.joinCommand.push(displayName);
    }
    return formed;
  }

  proclaimEmperor(year: number) {
    return proclaimEmperor(this, year);
  }

  getDisplayName() {
    return getFactionDisplayName(this);
  }

  getDisplayNameAtMonth(monthIndex: number) {
    return getFactionDisplayNameAtMonth(this, monthIndex);
  }

  obedience(team: Team) {
    if (this.isDie) {
      [...this.users].forEach((user) => {
        user.setTeam(team);
        user.slaveGroup.reset();
      });
      this.farms?.setDie();
    }
  }

  get mvpUser(): User | undefined {
    return [...this.users]
      .filter((u) => u.sourceTeam === u.team)
      .sort((a, b) => b.score - a.score)[0];
  }

  get isDie() {
    return this.status !== "ACTIVE";
  }

  get capitalCity() {
    return this.cities.find((city) => city.isCapital);
  }

  get spawnBlock() {
    return this.capitalCity?.block ?? this.cities[0]?.block ?? this.homeBlock;
  }

  addCity(city: City) {
    if (!this.cities.includes(city)) {
      this.cities.push(city);
    }
  }

  initializeLifecycle(year: number) {
    initializeFactionLifecycle(this, year);
  }

  markActive(year: number) {
    markLifecycleActive(this, year);
  }

  markExiled(year: number) {
    markLifecycleExiled(this, year);
    this.removeRulerUnit(true);
  }

  markExtinct(year: number) {
    markLifecycleExtinct(this, year);
    this.removeRulerUnit(true);
  }

  getCumulativeActiveYears(year: number) {
    return getCumulativeActiveYears(this, year);
  }

  removeCity(city: City) {
    this.cities = this.cities.filter((item) => item !== city);
    if (this.homeBlock === city.block) {
      this.homeBlock = this.capitalCity?.block ?? this.cities[0]?.block;
    }
  }

  removeRulerUnit(silentRulerDeath = true) {
    this.rulerUser?.destroyUser(silentRulerDeath);
    this.rulerUser = undefined;
  }

  setCapitalCity(city: City, year = 0) {
    this.cities.forEach((item) => {
      if (item !== city) {
        item.setCapital(false, year);
      }
    });
    city.setCapital(true, year);
    this.homeBlock = city.block;
    this.capital = city.name;
  }

  chooseCapitalCandidate() {
    return [...this.cities].sort((a, b) => {
      if (b.maxDefense !== a.maxDefense) {
        return b.maxDefense - a.maxDefense;
      }
      if (b.defense !== a.defense) {
        return b.defense - a.defense;
      }
      if (a.foundedYear !== b.foundedYear) {
        return a.foundedYear - b.foundedYear;
      }
      return a.id.localeCompare(b.id);
    })[0];
  }

  exportState() {
    return {
      factionId: this.name,
      displayName: this.displayName,
      color: this.color,
      factionType: this.factionType,
      status: this.status,
      firstFoundedMonth: this.firstFoundedYear,
      currentActiveSinceMonth: this.currentActiveSinceYear,
      lastExiledMonth: this.lastExiledYear,
      restorationMonths: [...this.restorationYears],
      extinctionMonth: this.extinctionYear,
      cumulativeActiveMonths: this.cumulativeActiveYears,
      identityStage: this.identityStage,
      sovereigntyRank: this.sovereigntyRank,
      sovereigntyHistory: this.sovereigntyHistory.map((entry) => ({ ...entry })),
      stateFormationEligibleSinceMonth: this.stateFormationEligibleSinceMonth,
      stateFoundedMonth: this.stateFoundedMonth,
      emperorEligibleSinceMonth: this.emperorEligibleSinceMonth,
      proclaimedEmperorMonth: this.proclaimedEmperorMonth,
      nameHistory: this.nameHistory.map((entry) => ({ ...entry })),
      origin: { ...this.origin, foundedMonth: this.origin.foundedMonth },
      houseName: this.houseName,
      homeGridX: this.homeBlock ? Math.round(this.homeBlock.x / this.homeBlock.width) : this.homeX,
      homeGridY: this.homeBlock ? Math.round(this.homeBlock.y / this.homeBlock.height) : this.homeY,
      capitalCityId: this.capitalCity?.id,
      capitalName: this.capital,
      shortName: this.shortName,
      icon: this.icon,
      hall: this.hall,
      tile: this.tile,
      farmsConfig: this.npcsConfig?.map((entry) => ({ ...entry })),
      farmsRuntime: this.farms.exportState(),
      capitalIndestructible: this.capitalIndestructible,
      joinCommand: [...this.joinCommand],
    };
  }
}
