import {
  CITY_BASE_MAX_DEFENSE,
  CITY_CAPTURED_DEFENSE_RATIO,
  CITY_DEVASTATION_RECOVERY_INTERVAL_MONTHS,
  CITY_DESTRUCTION_THRESHOLD,
  CITY_CAPTURE_GRACE_MONTHS,
  CITY_CAPITAL_DEFENSE_BONUS,
  CITY_DEVELOPMENT_SCORE_THRESHOLDS,
  CITY_DEVELOPMENT_TERRITORY_STEP,
  CITY_FOREIGN_CAPTURE_LOYALTY,
  CITY_INITIAL_LOYALTY,
  CITY_LOYALTY_RECOVERY_INTERVAL_MONTHS,
  CITY_MAX_STABLE_LOYALTY,
  CITY_RECOVERED_LOYALTY,
  CITY_REPAIR_INTERVAL_MONTHS,
  CITY_SIEGE_DAMAGE_INTERVAL_MONTHS,
  CITY_SIEGE_DEVASTATION,
  CITY_SIEGE_DEVASTATION_INTERVAL_MONTHS,
  CITY_SIEGE_DAMAGE_PER_TICK,
  IMPERIAL_STRAIN_LOYALTY_DECAY_THRESHOLD,
  FORTIFIED_ZONE_TIERS,
} from "../config/simulation";
import Game from "../Game/Game";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import FactionEffects from "../Simulation/FactionEffects";
import ArchivedCities from "../Simulation/ArchivedCities";
import CityNameRegistry from "../Simulation/CityNameRegistry";
import {
  canPermanentlyDestroyCity,
  getCaptureDevastationIncrease,
  recoverDevastation,
} from "../Simulation/CityLifecycle";
import {
  getCityZoneOutlineStyle,
  getCityZoneVisualState,
  getExteriorZoneEdges,
} from "../Simulation/CityZoneVisual";
import { calculateImperialStrain, getCityDistanceFromCapital } from "../Simulation/ImperialStrain";
import { shouldApplySiegeDamage } from "../Simulation/SiegeRules";
import { store } from "../store";
import Block from "./Block";
import Team from "./Team";

export type CityHistoryType =
  | "founded"
  | "capital-started"
  | "captured"
  | "recovered"
  | "capital-lost"
  | "capital-relocated";

export interface CityHistoryEvent {
  year: number;
  type: CityHistoryType;
  title: string;
  previousOwnerFactionId?: string;
  newOwnerFactionId?: string;
  wasCapital?: boolean;
  rulerId?: string;
}

interface SiegeContact {
  team: Team;
  count: number;
  year: number;
  rulerId?: string;
}

export default class City {
  ownerFactionId: string;
  defense: number;
  maxDefense: number;
  loyalty = CITY_INITIAL_LOYALTY;
  fortifiedCells: Block[] = [];
  captureCount = 0;
  lastCapturedYear: number | undefined;
  history: CityHistoryEvent[] = [];
  private lastRepairYear: number;
  private lastLoyaltyYear: number;
  private lastSiegeDamageYear = -1;
  private siegeDamageRemainder = 0;
  private siegeContacts = new Map<string, SiegeContact>();
  underSiege = false;
  attackingFactionId: string | undefined;
  zoneHighlighted = false;
  private zoneOutline: Phaser.GameObjects.Graphics | undefined;
  devastation = 0;
  destroyed = false;
  private lastDevastationRecoveryYear: number;
  private lastSiegeDevastationYear = -1;

  constructor(
    public id: string,
    public name: string,
    public founderFactionId: string,
    public block: Block,
    public foundedYear: number,
    public isCapital = false,
    public isHistoricCity = false,
    public isIndestructible = false
  ) {
    CityNameRegistry.reserve(name, id, foundedYear);
    this.ownerFactionId = founderFactionId;
    this.maxDefense = this.calculateMaxDefense();
    this.defense = this.maxDefense;
    this.lastRepairYear = foundedYear;
    this.lastLoyaltyYear = foundedYear;
    this.lastDevastationRecoveryYear = foundedYear;
    this.addHistory(foundedYear, "founded", `${founderFactionId}建立${name}`);
    if (isCapital) {
      this.addHistory(
        foundedYear,
        "capital-started",
        `${founderFactionId}定都${name}`
      );
    }
    this.ownerTeam?.addCity(this);
    if (this.isCapital || !this.ownerTeam?.capitalCity) {
      this.ownerTeam?.setCapitalCity(this);
    }
    this.rebuildFortifiedZone();
    if (this.ownerTeam) {
      this.claimFortifiedZone(this.ownerTeam);
    }
    this.refreshZoneVisual();
  }

  registerSiegeContact(attacker: Team, year: number, rulerId?: string) {
    const owner = this.ownerTeam;
    if (!owner || owner === attacker || attacker.isDie) {
      return;
    }
    if (
      this.lastCapturedYear !== undefined &&
      year - this.lastCapturedYear < CITY_CAPTURE_GRACE_MONTHS
    ) {
      return;
    }

    const contact = this.siegeContacts.get(attacker.name);
    this.siegeContacts.set(attacker.name, {
      team: attacker,
      count: (contact?.count ?? 0) + 1,
      year,
      rulerId: contact?.rulerId ?? rulerId,
    });
  }

  capture(newOwner: Team, year: number, rulerId?: string) {
    const oldOwner = this.ownerTeam;
    if (!oldOwner || oldOwner === newOwner) {
      return;
    }

    const previousOwnerName = oldOwner.name;
    const wasCapital = this.isCapital;
    const recovered = newOwner.name === this.founderFactionId;
    const cityDefenseBefore = this.defense;
    const founderFactionId = this.founderFactionId;
    const founderCapital = this.isFounderCapital;

    const monthsSinceLastCapture =
      this.lastCapturedYear === undefined ? undefined : year - this.lastCapturedYear;
    oldOwner.removeCity(this);
    const collapseGroupId =
      oldOwner.cities.length === 0
        ? getCollapseHistoryGroupId(previousOwnerName, year, this.id)
        : undefined;
    newOwner.addCity(this);
    newOwner.markActive(year);
    this.ownerFactionId = newOwner.name;
    this.captureCount += 1;
    this.devastation = Phaser.Math.Clamp(
      this.devastation + getCaptureDevastationIncrease(monthsSinceLastCapture),
      0,
      100
    );
    this.lastCapturedYear = year;
    this.isCapital = false;
    this.maxDefense = this.calculateMaxDefense();
    this.defense = Math.max(
      1,
      Math.floor(this.maxDefense * CITY_CAPTURED_DEFENSE_RATIO)
    );
    this.loyalty = recovered
      ? CITY_RECOVERED_LOYALTY
      : Phaser.Math.Clamp(
          CITY_FOREIGN_CAPTURE_LOYALTY +
            FactionEffects.getCaptureLoyaltyBonus(newOwner.name),
          0,
          CITY_MAX_STABLE_LOYALTY
        );
    this.lastRepairYear = year;
    this.lastLoyaltyYear = year;
    this.clearSiegeState();

    this.rebuildFortifiedZone();
    this.claimFortifiedZone(newOwner);
    this.refreshZoneVisual();

    if (wasCapital) {
      this.addHistory(year, "capital-lost", `${previousOwnerName}失去${this.name}`, {
        previousOwnerFactionId: previousOwnerName,
        newOwnerFactionId: newOwner.name,
        wasCapital,
        rulerId,
      });
      WorldHistory.addCapitalFallen(
        year,
        newOwner.name,
        previousOwnerName,
        founderFactionId,
        this.name,
        this.id,
        wasCapital,
        cityDefenseBefore,
        rulerId ? DynastyRegistry.getRulerTitleDisplay(newOwner.name, year) : undefined,
        rulerId,
        collapseGroupId
      );
    }

    if (recovered) {
      const title = `${newOwner.name}从${previousOwnerName}手中收复${
        founderCapital ? "故都" : ""
      }${this.name}`;
      this.addHistory(year, "recovered", title, {
        previousOwnerFactionId: previousOwnerName,
        newOwnerFactionId: newOwner.name,
        wasCapital,
        rulerId,
      });
      WorldHistory.addCityRecovered(
        year,
        newOwner.name,
        previousOwnerName,
        founderFactionId,
        this.name,
        this.id,
        founderCapital,
        cityDefenseBefore
      );
    } else {
      const title = buildCityCaptureTitle({
        attackerName: newOwner.name,
        previousOwnerName,
        founderFactionId,
        cityName: this.name,
        wasCapital,
        founderCapital,
        rulerName: rulerId ? DynastyRegistry.getRulerTitleDisplay(newOwner.name, year) : undefined,
      });
      this.addHistory(year, "captured", title, {
        previousOwnerFactionId: previousOwnerName,
        newOwnerFactionId: newOwner.name,
        wasCapital,
        rulerId,
      });
      if (!wasCapital) {
        WorldHistory.addCityCaptured(
          year,
          newOwner.name,
          previousOwnerName,
          founderFactionId,
          this.name,
          this.id,
          wasCapital,
          founderCapital,
          cityDefenseBefore,
          rulerId ? DynastyRegistry.getRulerTitleDisplay(newOwner.name, year) : undefined,
          rulerId,
          collapseGroupId
        );
      }
    }

    DynastyRegistry.recordCityCaptured(rulerId, this.id);
    DynastyRegistry.recordCityLost(previousOwnerName);

    if (wasCapital) {
      this.handleCapitalLoss(oldOwner, year, newOwner, collapseGroupId);
    } else if (oldOwner.cities.length === 0) {
      Game.Core.handleFactionExtinction(oldOwner, newOwner, this, year, collapseGroupId);
    }
  }

  revoltTo(newOwner: Team, year: number) {
    const oldOwner = this.ownerTeam;
    if (!oldOwner || oldOwner === newOwner) {
      return false;
    }

    const wasCapital = this.isCapital;
    const restoredFromExile = newOwner.status === "EXILED";
    oldOwner.removeCity(this);
    const historyGroupId = restoredFromExile
      ? getRestorationHistoryGroupId(newOwner.name, year, this.id)
      : newOwner.origin?.foundedMonth === year
      ? getFoundingHistoryGroupId(newOwner.name, year)
      : oldOwner.cities.length === 0
      ? getCollapseHistoryGroupId(oldOwner.name, year, this.id)
      : undefined;
    newOwner.addCity(this);
    newOwner.markActive(year);
    this.ownerFactionId = newOwner.name;
    this.captureCount += 1;
    this.lastCapturedYear = year;
    this.isCapital = false;
    this.maxDefense = this.calculateMaxDefense();
    this.defense = Math.max(
      1,
      Math.floor(this.maxDefense * CITY_CAPTURED_DEFENSE_RATIO)
    );
    this.loyalty =
      newOwner.name === this.founderFactionId
        ? CITY_RECOVERED_LOYALTY
        : Phaser.Math.Clamp(
            CITY_FOREIGN_CAPTURE_LOYALTY +
              FactionEffects.getCaptureLoyaltyBonus(newOwner.name),
            0,
            CITY_MAX_STABLE_LOYALTY
          );
    this.lastRepairYear = year;
    this.lastLoyaltyYear = year;
    this.clearSiegeState();

    this.rebuildFortifiedZone();
    this.claimFortifiedZone(newOwner);
    this.refreshZoneVisual();
    this.addHistory(year, "recovered", `${this.name}起义并归附${newOwner.name}`);
    WorldHistory.addCityRevolt(
      year,
      this.name,
      oldOwner.name,
      newOwner.name,
      this.id,
      historyGroupId
    );

    if (!newOwner.capitalCity) {
      newOwner.setCapitalCity(this, year);
    }
    if (restoredFromExile) {
      DynastyRegistry.markRestored(newOwner, year, this.name);
    }
    if (wasCapital) {
      this.handleCapitalLoss(oldOwner, year, newOwner, historyGroupId);
    } else if (oldOwner.cities.length === 0) {
      Game.Core.handleFactionExtinction(oldOwner, newOwner, this, year, historyGroupId);
    }
    return true;
  }

  updateDefense(year: number) {
    if (this.destroyed) {
      return;
    }
    this.updateLoyalty(year);
    this.updateSiege(year);
    this.updateDevastation(year);
    const nextMaxDefense = this.calculateMaxDefense();
    const previousZoneSize = getFortifiedZoneSize(this.maxDefense);
    this.maxDefense = nextMaxDefense;
    if (getFortifiedZoneSize(this.maxDefense) !== previousZoneSize) {
      this.rebuildFortifiedZone();
      if (this.ownerTeam) {
        this.claimFortifiedZone(this.ownerTeam);
      }
      this.refreshZoneVisual();
    }
    if (this.defense > this.maxDefense) {
      this.defense = this.maxDefense;
      this.block.updateCityDisplay();
      return;
    }
    if (year - this.lastRepairYear < CITY_REPAIR_INTERVAL_MONTHS) {
      return;
    }
    this.lastRepairYear = year;
    if (this.defense < this.maxDefense) {
      this.defense += 1;
      this.block.updateCityDisplay();
    }
  }

  setCapital(isCapital: boolean, year: number) {
    if (this.isCapital === isCapital) {
      return;
    }
    this.isCapital = isCapital;
    this.maxDefense = this.calculateMaxDefense();
    if (!isCapital && this.defense > this.maxDefense) {
      this.defense = this.maxDefense;
      this.addHistory(year, "capital-lost", `${this.name}失去首都身份`);
    }
    if (isCapital) {
      this.addHistory(year, "capital-relocated", `${this.ownerFactionId}迁都${this.name}`);
    }
    this.block.updateCityDisplay();
    this.refreshZoneVisual();
  }

  addHistory(
    year: number,
    type: CityHistoryType,
    title: string,
    data: Partial<Omit<CityHistoryEvent, "year" | "type" | "title">> = {}
  ) {
    this.history.push({
      year,
      type,
      title,
      ...data,
    });
  }

  get ownerTeam() {
    return Game.Core?.teams.find((team) => team.name === this.ownerFactionId);
  }

  get founderTeam() {
    return Game.Core?.teams.find((team) => team.name === this.founderFactionId);
  }

  get isFounderCapital() {
    return this.history.some((event) => event.type === "capital-started");
  }

  get loyaltyStatus() {
    if (this.loyalty >= 80) {
      return "稳定";
    }
    if (this.loyalty >= 60) {
      return "平稳";
    }
    if (this.loyalty >= 40) {
      return "不满";
    }
    if (this.loyalty >= 20) {
      return "动荡";
    }
    return "高危";
  }

  claimFortifiedZone(owner: Team) {
    this.fortifiedCells.forEach((cell) => {
      cell.claimForTeam(owner);
      cell.updateCityDisplay();
    });
    this.refreshZoneVisual();
  }

  rebuildFortifiedZone() {
    this.fortifiedCells.forEach((cell) => {
      if (cell !== this.block) {
        cell.clearCity(this);
      }
    });
    this.fortifiedCells = getFortifiedCells(this.block, this.maxDefense, this);
    this.fortifiedCells.forEach((cell) => {
      cell.setCity(this, cell === this.block);
    });
    Game.Core?.registerCityInteraction(this);
    this.refreshZoneVisual();
  }

  setZoneHighlight(highlighted: boolean) {
    this.zoneHighlighted = highlighted;
    this.refreshZoneVisual();
  }

  refreshZoneVisual() {
    if (!this.zoneOutline) {
      this.zoneOutline = this.block.scene.add.graphics().setDepth(this.block.depth + 4);
      this.zoneOutline.disableInteractive();
    }
    this.zoneOutline.clear();
    if (this.destroyed || this.fortifiedCells.length === 0) {
      return;
    }
    const selected = store.getState().root.selectedCityId === this.id;
    const state = getCityZoneVisualState({
      underSiege: this.underSiege,
      selected,
      hovered: this.zoneHighlighted,
    });
    const style = getCityZoneOutlineStyle(state);
    this.zoneOutline.lineStyle(style.width, style.color, style.alpha);
    getExteriorZoneEdges(this.fortifiedCells, Game.BlockSize).forEach((edge) => {
      this.zoneOutline?.lineBetween(edge.x1, edge.y1, edge.x2, edge.y2);
    });
  }

  isInCaptureGrace(year: number) {
    return (
      this.lastCapturedYear !== undefined &&
      year - this.lastCapturedYear < CITY_CAPTURE_GRACE_MONTHS
    );
  }

  private handleCapitalLoss(
    oldOwner: Team,
    year: number,
    conqueror: Team,
    historyGroupId?: string
  ) {
    if (oldOwner.cities.length === 0) {
      Game.Core.handleFactionExtinction(oldOwner, conqueror, this, year, historyGroupId);
      return;
    }

    const newCapital = oldOwner.chooseCapitalCandidate();
    if (!newCapital) {
      return;
    }
    oldOwner.setCapitalCity(newCapital, year);
    WorldHistory.addCapitalRelocated(
      year,
      oldOwner.name,
      newCapital.name,
      newCapital.id
    );
  }

  private calculateMaxDefense() {
    const owner = this.ownerTeam;
    const developmentLevel = owner ? getFactionDevelopmentLevel(owner) : 1;
    return (
      CITY_BASE_MAX_DEFENSE +
      developmentLevel +
      (this.isCapital ? CITY_CAPITAL_DEFENSE_BONUS : 0)
    );
  }

  private updateLoyalty(year: number) {
    if (year - this.lastLoyaltyYear < CITY_LOYALTY_RECOVERY_INTERVAL_MONTHS) {
      return;
    }
    this.lastLoyaltyYear = year;
    if (
      this.ownerFactionId &&
      Math.random() >
        FactionEffects.getLoyaltyRecoveryMultiplier(this.ownerFactionId)
    ) {
      return;
    }
    const owner = this.ownerTeam;
    const strain = owner
      ? calculateImperialStrain(owner, Game.Core?.totalCells ?? 1, 0)
      : 0;
    const distance = owner ? getCityDistanceFromCapital(owner, this) : 0;
    if (
      owner &&
      !this.isCapital &&
      strain >= IMPERIAL_STRAIN_LOYALTY_DECAY_THRESHOLD &&
      distance >= 8
    ) {
      this.loyalty = Math.max(0, this.loyalty - 1);
      return;
    }
    if (!this.isCapital && strain >= 50 && distance >= 6 && Math.random() < 0.5) {
      return;
    }
    if (this.loyalty < CITY_MAX_STABLE_LOYALTY) {
      this.loyalty = Math.min(CITY_MAX_STABLE_LOYALTY, this.loyalty + 1);
    }
  }

  private updateSiege(year: number) {
    const contacts = [...this.siegeContacts.values()].filter(
      (contact) => year - contact.year <= 1
    );
    const mainAttacker = contacts.sort((a, b) => b.count - a.count)[0];
    this.underSiege = Boolean(mainAttacker);
    this.attackingFactionId = mainAttacker?.team.name;
    this.refreshZoneVisual();
    this.siegeContacts.clear();
    if (!mainAttacker) {
      return;
    }
    if (
      this.lastSiegeDevastationYear < 0 ||
      year - this.lastSiegeDevastationYear >= CITY_SIEGE_DEVASTATION_INTERVAL_MONTHS
    ) {
      this.lastSiegeDevastationYear = year;
      this.devastation = Phaser.Math.Clamp(
        this.devastation + CITY_SIEGE_DEVASTATION,
        0,
        100
      );
    }
    if (
      !shouldApplySiegeDamage(
        year,
        this.lastSiegeDamageYear,
      CITY_SIEGE_DAMAGE_INTERVAL_MONTHS
      )
    ) {
      return;
    }
    this.lastSiegeDamageYear = year;
    const rawSiegeDamage =
      CITY_SIEGE_DAMAGE_PER_TICK *
        FactionEffects.getSiegeMultiplier(mainAttacker.team.name) +
      this.siegeDamageRemainder;
    const siegeDamage = Math.max(1, Math.floor(rawSiegeDamage));
    this.siegeDamageRemainder = rawSiegeDamage - siegeDamage;
    this.defense -= siegeDamage;
    this.ownerTeam?.removeOneUser();
    this.block.updateCityDisplay();
    if (this.defense <= 0) {
      this.capture(mainAttacker.team, year, mainAttacker.rulerId);
    }
  }

  private clearSiegeState() {
    this.underSiege = false;
    this.attackingFactionId = undefined;
    this.siegeContacts.clear();
    this.lastSiegeDamageYear = -1;
    this.siegeDamageRemainder = 0;
    this.refreshZoneVisual();
  }

  private updateDevastation(year: number) {
    if (
      canPermanentlyDestroyCity(
        Game.Core?.teams.flatMap((team) => team.cities).length ?? 0,
        this.devastation,
        this.isIndestructible
      )
    ) {
      this.destroyPermanently(year);
      return;
    }
    if (this.isIndestructible && this.devastation >= CITY_DESTRUCTION_THRESHOLD) {
      this.devastation = Math.min(99, this.devastation);
    }
    if (
      this.underSiege ||
      this.isInCaptureGrace(year) ||
      year - this.lastDevastationRecoveryYear < CITY_DEVASTATION_RECOVERY_INTERVAL_MONTHS
    ) {
      return;
    }
    this.lastDevastationRecoveryYear = year;
    this.devastation = recoverDevastation(this.devastation);
  }

  destroyPermanently(year: number) {
    if (this.destroyed || this.devastation < CITY_DESTRUCTION_THRESHOLD) {
      return false;
    }
    if (
      !canPermanentlyDestroyCity(
        Game.Core?.teams.flatMap((team) => team.cities).length ?? 0,
        this.devastation,
        this.isIndestructible
      )
    ) {
      if (this.isIndestructible) {
        this.devastation = Math.min(99, this.devastation);
      }
      return false;
    }
    const owner = this.ownerTeam;
    const wasCapital = this.isCapital;
    this.destroyed = true;
    Game.Core?.unregisterCityInteraction(this.id);
    const archived = ArchivedCities.archive(this, year);
    owner?.removeCity(this);
    this.fortifiedCells.forEach((cell) => {
      cell.clearCity(this);
      if (owner) {
        cell.claimForTeam(owner);
      }
    });
    this.fortifiedCells = [];
    this.refreshZoneVisual();
    WorldHistory.addCityDestroyed(year, archived);
    this.zoneOutline?.destroy();
    this.zoneOutline = undefined;
    if (owner && wasCapital) {
      const newCapital = owner.chooseCapitalCandidate();
      if (newCapital) {
        owner.setCapitalCity(newCapital, year);
        WorldHistory.addCapitalRelocated(year, owner.name, newCapital.name, newCapital.id);
      } else {
        owner.markExtinct(year);
        DynastyRegistry.markExtinct(owner, year);
        WorldHistory.addFactionExtinct(
          year,
          owner.name,
          `${owner.name}失去最后一座城市，${owner.name}国彻底灭亡`
        );
      }
    }
    return true;
  }
}

export function getFactionDevelopmentLevel(team: Team) {
  const score =
    team.users.size +
    Math.floor(team.blocks.children.size / CITY_DEVELOPMENT_TERRITORY_STEP);
  let level = 1;
  CITY_DEVELOPMENT_SCORE_THRESHOLDS.forEach((threshold, index) => {
    if (score >= threshold) {
      level = index + 1;
    }
  });
  return Math.max(1, Math.min(5, level));
}

export function getFactionStability(team: Team) {
  if (team.cities.length === 0) {
    return undefined;
  }
  const total = team.cities.reduce((sum, city) => sum + city.loyalty, 0);
  return Math.round(total / team.cities.length);
}

function getFortifiedCells(center: Block, maxDefense: number, city: City) {
  const map = Game.Core?.map;
  if (!map) {
    return [center];
  }
  const centerX = Math.round(center.x / Game.BlockSize);
  const centerY = Math.round(center.y / Game.BlockSize);
  const offsets = getFortifiedOffsets(maxDefense);
  const cells: Block[] = [];
  for (const [dx, dy] of offsets) {
    const block = map.getBlock(centerX + dx, centerY + dy);
    if (!block) {
      continue;
    }
    if (block.city && block.city !== city) {
      continue;
    }
    cells.push(block);
  }
  return cells.includes(center) ? cells : [center, ...cells];
}

function buildCityCaptureTitle({
  attackerName,
  previousOwnerName,
  founderFactionId,
  cityName,
  wasCapital,
  founderCapital,
  rulerName,
}: {
  attackerName: string;
  previousOwnerName: string;
  founderFactionId: string;
  cityName: string;
  wasCapital: boolean;
  founderCapital: boolean;
  rulerName?: string;
}) {
  const prefix = rulerName ? `${rulerName}亲征，` : "";
  if (previousOwnerName === founderFactionId) {
    return `${prefix}${attackerName}攻陷${founderFactionId}${
      wasCapital ? "都" : "城"
    }${cityName}`;
  }
  return `${prefix}${attackerName}攻陷${previousOwnerName}国控制的${cityName}（${
    founderCapital ? `${founderFactionId}国故都` : `原属${founderFactionId}`
  }）`;
}

function getCollapseHistoryGroupId(factionId: string, year: number, cityId: string) {
  return `collapse-${factionId}-${year}-${cityId}`;
}

function getFoundingHistoryGroupId(factionId: string, year: number) {
  return `founding-${factionId}-${year}`;
}

function getRestorationHistoryGroupId(factionId: string, year: number, cityId: string) {
  return `restoration-${factionId}-${year}-${cityId}`;
}

function getFortifiedOffsets(maxDefense: number) {
  const tier = FORTIFIED_ZONE_TIERS.find(
    (item) => maxDefense >= item.minDefense && maxDefense <= item.maxDefense
  );
  if (tier?.shape === "cross") {
    return [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
  }
  if (tier?.shape === "square") {
    return [
      [0, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
  }
  if (tier?.shape === "diamond") {
    return [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ];
  }
  return [[0, 0]];
}

function getFortifiedZoneSize(maxDefense: number) {
  return getFortifiedOffsets(maxDefense).length;
}
