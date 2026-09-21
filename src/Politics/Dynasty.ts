import Team from "../Components/Team";
import { getFactionStability } from "../Components/City";
import Game from "../Game/Game";
import { getPopulationCapacity } from "../Simulation/PopulationSystem";
import FactionEffects from "../Simulation/FactionEffects";
import {
  HEIR_PARENT_MAX_AGE_AT_BIRTH,
  HEIR_PARENT_MIN_AGE_AT_BIRTH,
  RULER_COMBAT_MIN_AGE,
  RULER_MAX_AGE_AT_ACCESSION,
  RULER_MIN_AGE_AT_ACCESSION,
} from "../config/simulation";
import WorldHistory from "../History/WorldHistory";
import {
  calculateSuccessionEffect,
  pickRulerGivenName,
} from "./SuccessionRules";
import { shouldDynastyContinue } from "../Simulation/FactionLifecycle";
import { monthsToYears, yearsToMonths } from "../Simulation/WorldTime";
import WorldRemnants from "../Simulation/WorldRemnants";
import { shouldCreateActiveHeir } from "./ExileRules";
import {
  createRulerChronicle,
  finishRulerChronicle,
  observeRulerPeak,
  RulerChronicle,
  RulerReignSnapshot,
} from "./RulerChronicle";
import { shouldRulerBattleDeathOccur } from "./RulerBattleRules";
import { getNextRulerReignOrdinal } from "./RulerOrdinalRules";
import {
  formatRulerTitleAtMonth,
  getRulerTitleAtMonth,
  getNaturalDeathVerbForTitle,
  getSuccessionVerbForTitle,
} from "./RulerTitleRules";
import { getSuccessionShockMultiplier } from "../Simulation/SovereigntyModifiers";
import { finalizeRulerPosthumousNames } from "./PosthumousRules";
import {
  createNaturalDeathMonth,
  deriveHeirBirthMonth,
  isNaturallyDeadByMonth,
} from "./RulerLifespanRules";

export type RulerStatus = "ruling" | "exiled" | "heir" | "dead";
export type RulerRelationType =
  | "FOUNDER"
  | "DIRECT_CHILD"
  | "COLLATERAL_KIN"
  | "NEW_HOUSE"
  | "LEADER_SUCCESSOR";

export interface Ruler {
  id: string;
  houseName: string;
  givenName: string;
  bornYear: number;
  naturalDeathYear?: number;
  accessionYear?: number;
  plannedEndYear?: number;
  endYear?: number;
  politicalStartYear?: number;
  politicalEndYear?: number;
  parentId?: string;
  predecessorId?: string;
  relationType?: RulerRelationType;
  reignOrdinal?: number;
  endReason?: string;
  status: RulerStatus;
  chronicle?: RulerChronicle;
  posthumousEpithet?: string;
  posthumousEpithetReasons?: string[];
  templeName?: string;
  templeNameReasons?: string[];
}

export interface Dynasty {
  factionId: string;
  houseName: string;
  rulers: Ruler[];
  currentRulerId: string | null;
  heirIds: string[];
  lastRulerBattleDeathYear?: number;
}

const rulerGivenNamePool = {
  singleNames: [
    "安",
    "昭",
    "武",
    "文",
    "景",
    "烈",
    "成",
    "康",
    "惠",
    "襄",
    "平",
    "宣",
    "靖",
    "威",
    "怀",
  ],
  doubleNamePrefixes: ["子", "伯", "仲", "叔", "景", "文", "元", "明"],
  doubleNameSuffixes: ["安", "衡", "宣", "平", "宁", "成", "怀", "昭", "远", "和"],
  doubleNameChancePercent: 24,
};

class DynastyRegistryStore {
  private dynasties = new Map<string, Dynasty>();
  private sequence = 0;

  reset() {
    this.dynasties.clear();
    this.sequence = 0;
  }

  initializeFaction(team: Team, year: number) {
    if (this.dynasties.has(team.name)) {
      return this.dynasties.get(team.name);
    }
    const houseName = team.houseName ?? `${team.name}氏`;
    const ruler = this.createFormalRuler(team, houseName, year);
    ruler.reignOrdinal = 1;
    ruler.relationType = "FOUNDER";
    const dynasty: Dynasty = {
      factionId: team.name,
      houseName,
      rulers: [ruler],
      currentRulerId: ruler.id,
      heirIds: [],
    };
    this.dynasties.set(team.name, dynasty);
    this.ensureActiveHeir(team, dynasty, year);
    WorldHistory.addRulerAcceded(year, team.name, this.getRulerTitle(team, ruler, year), ruler.id);
    this.ensureRulerUnit(team);
    return dynasty;
  }

  update(year: number, teams: Team[]) {
    teams.filter((team) => shouldDynastyContinue(team.status)).forEach((team) => {
      const dynasty = this.initializeFaction(team, 0);
      if (dynasty) {
        this.archiveNaturallyDeadHeirs(dynasty, year);
      }
      const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
      if (
        !dynasty ||
        !ruler ||
        ruler.accessionYear === undefined ||
        !isNaturallyDeadByMonth(ruler.naturalDeathYear ?? ruler.plannedEndYear, year)
      ) {
        if (ruler) {
          this.observeRuler(team, ruler, year);
        }
        if (dynasty) {
          this.ensureActiveHeir(team, dynasty, year);
        }
        this.ensureRulerUnit(team);
        return;
      }
      this.succeedRuler(team, dynasty, ruler, year, "natural");
    });
  }

  markExiled(team: Team, year: number) {
    const dynasty = this.initializeFaction(team, 0);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (ruler && ruler.status !== "dead") {
      ruler.status = "exiled";
    }
    team.removeRulerUnit(true);
    WorldHistory.addDynastyExiled(
      year,
      team.name,
      ruler ? this.getRulerTitle(team, ruler, year) : this.getRulerDisplay(team.name)
    );
  }

  markRestored(team: Team, year: number, cityName: string) {
    const dynasty = this.initializeFaction(team, 0);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (ruler && ruler.status !== "dead") {
      ruler.status = "ruling";
    }
    this.ensureRulerUnit(team);
    WorldHistory.addDynastyRestored(
      year,
      team.name,
      ruler ? this.getRulerTitle(team, ruler, year) : this.getRulerDisplay(team.name),
      cityName
    );
  }

  markExtinct(team: Team, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (ruler?.chronicle) {
      if (ruler.status !== "dead") {
        ruler.status = "dead";
        ruler.endYear = year;
        ruler.endReason = "彻底灭亡";
      }
      finishRulerChronicle(
        ruler.chronicle,
        createTerminalRulerSnapshot(year),
        ruler.endReason ?? "彻底灭亡"
      );
      finalizeRulerPosthumousNames(ruler, dynasty?.rulers ?? [], team, year);
    }
    if (dynasty) {
      this.archiveHeirs(dynasty, year, "王统断绝");
      dynasty.currentRulerId = null;
    }
    team.removeRulerUnit(true);
  }

  get(factionId: string) {
    return this.dynasties.get(factionId);
  }

  getCurrentRuler(factionId: string) {
    const dynasty = this.dynasties.get(factionId);
    if (!dynasty?.currentRulerId) {
      return undefined;
    }
    return dynasty.rulers.find((ruler) => ruler.id === dynasty.currentRulerId);
  }

  hasClaimant(factionId: string) {
    const dynasty = this.dynasties.get(factionId);
    if (!dynasty) {
      return false;
    }
    const current = this.getCurrentRuler(factionId);
    if (current && current.status !== "dead") {
      return true;
    }
    return dynasty.heirIds.some((id) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === id);
      return Boolean(heir && heir.status !== "dead");
    });
  }

  getRulerDisplay(factionId: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler) {
      return "无";
    }
    return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  }

  handleRulerCombatDeath(team: Team, rulerId: string, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty?.rulers.find((item) => item.id === rulerId);
    if (!dynasty || !ruler || ruler.status === "dead") {
      return true;
    }
    const stability = getFactionStability(team) ?? 100;
    const capitalUnderSiege = Boolean(team.capitalCity?.underSiege);
    const rulerInSiege = Boolean(
      Game.Core?.teams.some((candidate) =>
        candidate.cities.some(
          (city) => city.ownerTeam !== team && city.underSiege && city.attackingFactionId === team.name
        )
      )
    );
    const severeCrisis = Boolean(capitalUnderSiege && stability <= 25);
    const monthsSinceLastBattleDeath =
      dynasty.lastRulerBattleDeathYear === undefined
        ? undefined
        : year - dynasty.lastRulerBattleDeathYear;
    if (!shouldRulerBattleDeathOccur({
      reignMonths: year - (ruler.accessionYear ?? year),
      monthsSinceLastBattleDeath,
      severeCrisis,
      capitalUnderSiege,
      rulerInSiege,
      sovereigntyRank: team.sovereigntyRank,
    })) {
      return false;
    }
    dynasty.lastRulerBattleDeathYear = year;
    team.rulerUser = undefined;
    this.succeedRuler(team, dynasty, ruler, year, "combat");
    return true;
  }

  private succeedRuler(
    team: Team,
    dynasty: Dynasty,
    predecessor: Ruler,
    year: number,
    reason: "natural" | "combat" | "captured"
  ) {
    predecessor.status = "dead";
    predecessor.endYear = year;
    predecessor.endReason =
      reason === "combat" ? "战死" : reason === "captured" ? "被俘处死" : "去世";
    if (predecessor.chronicle) {
      finishRulerChronicle(
        predecessor.chronicle,
        createRulerSnapshot(team, year),
        predecessor.endReason
      );
      finalizeRulerPosthumousNames(predecessor, dynasty.rulers, team, year);
    }
    this.archiveNaturallyDeadHeirs(dynasty, year);
    let successor = this.consumeHeir(dynasty, year);
    if (!successor && team.status === "ACTIVE" && team.cities.length > 0) {
      const newHouse =
        team.identityStage === "PROVISIONAL"
          ? dynasty.houseName
          : dynasty.houseName === `${team.name}氏`
          ? `${team.name}新氏`
          : `${team.name}氏`;
      successor = this.createHeir(
        team,
        newHouse,
        year,
        undefined,
        predecessor.id,
        team.identityStage === "PROVISIONAL" ? "LEADER_SUCCESSOR" : "NEW_HOUSE"
      );
      dynasty.rulers.push(successor);
    }
    if (!successor) {
      dynasty.currentRulerId = null;
      WorldHistory.addDynastyLineEnded(
        year,
        team.name,
        this.getRulerPersonalName(predecessor)
      );
      if (
        team.status !== "ACTIVE" &&
        (WorldRemnants.get(team.name)?.population ?? 0) <= 0
      ) {
        team.markExtinct(year);
        this.markExtinct(team, year);
        WorldHistory.addFactionExtinct(
          year,
          team.name,
          `${team.name}国残部已经消散，${dynasty.houseName}王统断绝，${team.name}国彻底灭亡`
        );
      }
      return;
    }
    const nextRuler = successor;
    nextRuler.accessionYear = year;
    nextRuler.politicalEndYear = undefined;
    nextRuler.predecessorId = predecessor.id;
    nextRuler.reignOrdinal = nextRuler.reignOrdinal ?? this.getNextReignOrdinal(dynasty);
    nextRuler.plannedEndYear = nextRuler.naturalDeathYear;
    nextRuler.chronicle = createRulerChronicle(createRulerSnapshot(team, year));
    nextRuler.status = team.status === "EXILED" ? "exiled" : "ruling";
    dynasty.currentRulerId = nextRuler.id;
    if (reason === "natural") {
      team.removeRulerUnit(true);
    }

    const reignYears = year - (predecessor.accessionYear ?? year);
    const rule = calculateSuccessionEffect(
      year,
      reignYears,
      dynasty.rulers
        .filter((ruler) => ruler.id !== nextRuler.id && ruler.predecessorId)
        .map((ruler) => ruler.accessionYear)
        .filter((accessionYear): accessionYear is number => accessionYear !== undefined)
        .concat(
          nextRuler.relationType === "NEW_HOUSE" ||
            Math.floor(monthsToYears(year - nextRuler.bornYear)) < 16
            ? [year, year]
            : []
        ),
      getSuccessionShockMultiplier(team.sovereigntyRank)
    );
    const effect = FactionEffects.addSuccessionEffect(team.name, year, rule);
    WorldHistory.addRulerSuccession(
      year,
      team.name,
      this.getRulerPersonalName(predecessor),
      this.getRulerPersonalName(nextRuler),
      {
        reason,
        previousRulerTitle: this.getRulerTitle(team, predecessor, year),
        rulerPoliticalTitle: getRulerTitleAtMonth(team, year),
        naturalDeathVerb: getNaturalDeathVerbForTitle(getRulerTitleAtMonth(team, year)),
        nextSuccessionVerb: getSuccessionVerbForTitle(
          getRulerTitleAtMonth(team, year)
        ),
        previousRulerId: predecessor.id,
        nextRulerId: nextRuler.id,
        relationType: nextRuler.relationType,
        reignMonths: reignYears,
        reignYears: Math.round(monthsToYears(reignYears)),
        age: Math.round(monthsToYears(year - predecessor.bornYear)),
        actorFactionColor: team.color,
        population: team.users.size,
        populationCapacity: getPopulationCapacity(team),
        territoryPercent:
          (team.blocks.children.size / Math.max(Game.Core?.totalCells ?? 1, 1)) *
          100,
        cityCount: team.cities.length,
        stability: getFactionStability(team) ?? 0,
        factionStatus: team.status,
        effectType: effect.type,
        effectDuration: Math.round(monthsToYears(effect.endYear - effect.startYear)),
        loyaltyRecoveryMultiplier: effect.loyaltyRecoveryMultiplier,
        rebellionRiskMultiplier: effect.rebellionRiskMultiplier,
        recentSuccessionCount: rule.recentSuccessionCount,
      }
    );
    this.ensureActiveHeir(team, dynasty, year);
    this.ensureRulerUnit(team);
  }

  resolveCapturedRuler(team: Team, conqueror: Team, year: number) {
    const dynasty = this.dynasties.get(team.name);
    const ruler = dynasty ? this.getCurrentRuler(team.name) : undefined;
    if (!dynasty || !ruler || ruler.status === "dead") {
      return false;
    }
    const eventId = WorldHistory.addRulerCaptured(
      year,
      team.name,
      this.getRulerTitle(team, ruler, year),
      conqueror.name,
      this.getRulerTitleDisplay(conqueror.name, year),
      ruler.id
    );
    if (ruler.chronicle) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
    this.succeedRuler(team, dynasty, ruler, year, "captured");
    return this.hasClaimant(team.name);
  }

  ensureRulerUnit(team: Team) {
    if (team.status !== "ACTIVE") {
      team.removeRulerUnit(true);
      return;
    }
    const ruler = this.getCurrentRuler(team.name);
    if (!ruler || ruler.status === "dead") {
      return;
    }
    const month = Game.Core?.simulator?.year ?? ruler.accessionYear ?? 0;
    if (Math.floor(monthsToYears(Math.max(0, month - ruler.bornYear))) < RULER_COMBAT_MIN_AGE) {
      team.removeRulerUnit(true);
      return;
    }
    if (team.rulerUser?.rulerId === ruler.id && team.users.has(team.rulerUser)) {
      return;
    }
    team.removeRulerUnit(true);
    const name = this.getRulerTitle(team, ruler, month);
    team.makeUser(
      getRulerUserId(ruler.id),
      name,
      undefined,
      100,
      "RULER",
      ruler.id
    );
  }

  recordCityCaptured(rulerId: string | undefined, cityId: string, eventId?: string) {
    if (!rulerId) {
      return;
    }
    const ruler = this.findRulerById(rulerId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.citiesCapturedPersonally += 1;
    ruler.chronicle.deathCityId = ruler.chronicle.deathCityId ?? cityId;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordCityLost(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.citiesLostDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordRebellion(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.rebellionsDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordRestoration(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.restorationsDuringReign += 1;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordUnification(factionId: string, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.completedUnification = true;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordStateFounded(factionId: string, stateName: string, year: number, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.foundedStateName = stateName;
    ruler.chronicle.foundedStateMonth = year;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  recordEmperorProclaimed(factionId: string, year: number, eventId?: string) {
    const ruler = this.getCurrentRuler(factionId);
    if (!ruler?.chronicle) {
      return;
    }
    ruler.chronicle.proclaimedEmperorMonth = year;
    if (eventId) {
      ruler.chronicle.notableEventIds.push(eventId);
    }
  }

  private createFormalRuler(
    team: Team,
    houseName: string,
    accessionYear: number,
    parentId?: string,
    predecessorId?: string
  ): Ruler {
    this.sequence += 1;
    const accessionAge = Phaser.Math.Between(
      RULER_MIN_AGE_AT_ACCESSION,
      RULER_MAX_AGE_AT_ACCESSION
    );
    const bornYear = accessionYear - yearsToMonths(accessionAge);
    const naturalDeathYear = createNaturalDeathMonth(bornYear, (max) =>
      Phaser.Math.Between(0, max - 1)
    );
    const recentNames =
      this.dynasties
        .get(team.name)
        ?.rulers.filter((ruler) => ruler.reignOrdinal !== undefined)
        .map((ruler) => ruler.givenName) ?? [];
    return {
      id: `${team.name}-ruler-${this.sequence}`,
      houseName,
      givenName: pickRulerGivenName(rulerGivenNamePool, recentNames, (max) =>
        Phaser.Math.Between(0, max - 1)
      ),
      bornYear,
      naturalDeathYear,
      accessionYear,
      politicalStartYear: accessionYear,
      plannedEndYear: naturalDeathYear,
      parentId,
      predecessorId,
      status: team.status === "EXILED" ? "exiled" : "ruling",
      chronicle: createRulerChronicle(createRulerSnapshot(team, accessionYear)),
    };
  }

  private createHeir(
    team: Team,
    houseName: string,
    politicalStartYear: number,
    parentId?: string,
    predecessorId?: string,
    relationType: RulerRelationType = "DIRECT_CHILD"
  ): Ruler {
    this.sequence += 1;
    const parent = parentId
      ? this.dynasties
          .get(team.name)
          ?.rulers.find((ruler) => ruler.id === parentId)
      : undefined;
    const derivedBornYear = parent
      ? deriveHeirBirthMonth(
          parent.bornYear,
          politicalStartYear,
          (max) => Phaser.Math.Between(0, max - 1),
          yearsToMonths(HEIR_PARENT_MIN_AGE_AT_BIRTH),
          yearsToMonths(HEIR_PARENT_MAX_AGE_AT_BIRTH)
        )
      : undefined;
    const bornYear = derivedBornYear ?? politicalStartYear - yearsToMonths(
          Phaser.Math.Between(RULER_MIN_AGE_AT_ACCESSION, RULER_MAX_AGE_AT_ACCESSION)
        );
    const naturalDeathYear = createNaturalDeathMonth(bornYear, (max) =>
      Phaser.Math.Between(0, max - 1)
    );
    const recentNames =
      this.dynasties
        .get(team.name)
        ?.rulers.filter((ruler) => ruler.reignOrdinal !== undefined)
        .map((ruler) => ruler.givenName) ?? [];
    return {
      id: `${team.name}-ruler-${this.sequence}`,
      houseName,
      givenName: pickRulerGivenName(rulerGivenNamePool, recentNames, (max) =>
        Phaser.Math.Between(0, max - 1)
      ),
      bornYear,
      naturalDeathYear,
      plannedEndYear: naturalDeathYear,
      politicalStartYear,
      parentId,
      predecessorId,
      relationType,
      status: "heir",
    };
  }

  private getNextReignOrdinal(dynasty: Dynasty) {
    return getNextRulerReignOrdinal(dynasty.rulers);
  }

  private ensureActiveHeir(team: Team, dynasty: Dynasty, year: number) {
    if (!shouldCreateActiveHeir(team.status)) {
      return;
    }
    const livingHeir = dynasty.heirIds
      .map((id) => dynasty.rulers.find((ruler) => ruler.id === id))
      .find((ruler) => ruler && ruler.status !== "dead");
    if (livingHeir) {
      return;
    }
    const current = this.getCurrentRuler(team.name);
    if (
      !current ||
      Math.floor(monthsToYears(Math.max(0, year - current.bornYear))) <
        HEIR_PARENT_MIN_AGE_AT_BIRTH
    ) {
      return;
    }
    const heir = this.createHeir(
      team,
      dynasty.houseName,
      year,
      current?.id,
      undefined
    );
    dynasty.rulers.push(heir);
    dynasty.heirIds = [heir.id];
  }

  private archiveHeirs(dynasty: Dynasty, year: number, reason: string) {
    dynasty.heirIds.forEach((heirId) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === heirId);
      if (!heir || heir.reignOrdinal !== undefined || heir.status === "dead") {
        return;
      }
      heir.status = "dead";
      heir.politicalEndYear = year;
      heir.endReason = reason;
    });
    dynasty.heirIds = [];
  }

  private archiveNaturallyDeadHeirs(dynasty: Dynasty, year: number) {
    dynasty.heirIds.forEach((heirId) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === heirId);
      if (
        !heir ||
        heir.status === "dead" ||
        heir.reignOrdinal !== undefined ||
        !isNaturallyDeadByMonth(heir.naturalDeathYear ?? heir.plannedEndYear, year)
      ) {
        return;
      }
      heir.status = "dead";
      heir.politicalEndYear = year;
      heir.endYear = year;
      heir.endReason = "自然去世";
    });
    dynasty.heirIds = dynasty.heirIds.filter((heirId) => {
      const heir = dynasty.rulers.find((ruler) => ruler.id === heirId);
      return Boolean(heir && heir.status !== "dead");
    });
  }

  private consumeHeir(dynasty: Dynasty, year: number) {
    while (dynasty.heirIds.length > 0) {
      const heirId = dynasty.heirIds.shift();
      const heir = dynasty.rulers.find((ruler) => ruler.id === heirId);
      if (
        heir &&
        heir.status !== "dead" &&
        !isNaturallyDeadByMonth(heir.naturalDeathYear ?? heir.plannedEndYear, year)
      ) {
        return heir;
      }
      if (heir && heir.status !== "dead") {
        heir.status = "dead";
        heir.politicalEndYear = year;
        heir.endYear = year;
        heir.endReason = "自然去世";
      }
    }
    return undefined;
  }

  getRulerTitleDisplay(factionId: string, monthIndex: number) {
    const ruler = this.getCurrentRuler(factionId);
    const team = Game.Core?.teams.find((item) => item.name === factionId);
    if (!ruler || !team) {
      return this.getRulerDisplay(factionId);
    }
    return this.getRulerTitle(team, ruler, monthIndex);
  }

  private getRulerTitle(team: Team, ruler: Ruler, monthIndex: number) {
    return formatRulerTitleAtMonth(
      team,
      this.getRulerPersonalName(ruler),
      monthIndex
    );
  }

  private getRulerPersonalName(ruler: Ruler) {
    return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
  }

  private observeRuler(team: Team, ruler: Ruler, year: number) {
    if (ruler.chronicle) {
      observeRulerPeak(ruler.chronicle, createRulerSnapshot(team, year));
    }
  }

  private findRulerById(rulerId: string) {
    for (const dynasty of this.dynasties.values()) {
      const ruler = dynasty.rulers.find((item) => item.id === rulerId);
      if (ruler) {
        return ruler;
      }
    }
    return undefined;
  }

  getAll() {
    return [...this.dynasties.values()];
  }
}

function getRulerUserId(rulerId: string) {
  let hash = 0;
  for (let i = 0; i < rulerId.length; i++) {
    hash = (hash * 31 + rulerId.charCodeAt(i)) >>> 0;
  }
  return 1800000000 + (hash % 100000000);
}

const DynastyRegistry = new DynastyRegistryStore();

export default DynastyRegistry;

function createRulerSnapshot(team: Team, month: number): RulerReignSnapshot {
  const totalCells = Math.max(Game.Core?.totalCells ?? 1, 1);
  return {
    month,
    population: team.users.size,
    territoryShare: team.blocks.children.size / totalCells,
    cityCount: team.cities.length,
    stability: getFactionStability(team) ?? 0,
  };
}

export function createTerminalRulerSnapshot(month: number): RulerReignSnapshot {
  return { month, population: 0, territoryShare: 0, cityCount: 0, stability: 0 };
}
