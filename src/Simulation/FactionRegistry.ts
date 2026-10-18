import { assessPopularSupport, hasPopularPoliticalCrisis } from "./PopularRebellionSupport";
import { calculateImperialStrain } from "./ImperialStrain";
import { destroyRuntimeGroupAtSafeBoundary } from "./RuntimeGroupDisposal";
import MilitaryCommandRegistry from "../Politics/MilitaryCommandRegistry";
import { getLocalRestorationClaimant, getLocalRestorationSupporters, LOCAL_RESTORATION_RADIUS_CELLS, LOCAL_RESTORATION_ZONE_MAX_CELLS } from "./LocalRestorationSupport";
import { deriveHistoricalCityRules, getHistoricalRestorationBasis, getWarTornCityEvidence } from "./HistoricalRestorationRules";
import { getFactionStability } from "../Components/City";
import type User from "../Components/User";
import type { RestorationBasis } from "./HistoricalRestorationRules";
import FactionLifetimeRecords from "./FactionLifetimeRecord";
import City from "../Components/City";
import Block from "../Components/Block";
import Team, { FactionType } from "../Components/Team";
import Game from "../Game/Game";
import Danmu from "../Live/Danmu";
import { createLocalDanmu } from "../Live/LocalDanmaku";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import { canRestoreExiledFaction } from "../Politics/ExileRules";
import WorldExiles from "./WorldExiles";
import WorldRemnants from "./WorldRemnants";
import {
  EMPIRE_SPLIT_MIN_CITIES, EMPIRE_SPLIT_LOW_LOYALTY, EMPIRE_SPLIT_STABILITY_THRESHOLD, EMPIRE_SPLIT_STRAIN_THRESHOLD,
  REBEL_INITIAL_POPULATION_MAX,
  REBEL_INITIAL_POPULATION_MIN,
  USER_RESTORED_LOYALTY_MAX,
  USER_RESTORED_LOYALTY_MIN,
} from "../config/simulation";
import { createRebelFactionName, createRebelHouseName } from "./RebelNameGenerator";
import { hasFormalStateIdentity } from "./FactionIdentity";
import { EMPIRE_SPLIT_REGION_RADIUS_CELLS } from "./EmpireSplitRules";
import CityNameRegistry from "./CityNameRegistry";
import { getNewCityInitialDefense } from "./CityLifecycle";
import type { PopulationMutationContext } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";

interface RebelFactionOptions {
  city: City;
  year: number;
  factionType: FactionType;
  godDriven?: boolean;
}

class FactionRegistryStore {
  private sequence = 0;
  private foundingTransactions = new WeakSet<User>();

  reset() {
    this.sequence = 0;
  }

  exportState() {
    return { sequence: this.sequence };
  }

  importState(state: { sequence: number }) {
    this.sequence = state.sequence;
  }

  canRestoreFaction(team: Team, worldMonth?: number) {
    if (!hasFormalStateIdentity(team) || team.status !== "EXILED" || team.terminationReason) {
      return false;
    }
    const exile = WorldExiles.get(team.name);
    if (!exile) return false;
    return canRestoreExiledFaction(
      WorldRemnants.get(team.name)?.population ?? 0,
      worldMonth === undefined ? DynastyRegistry.hasClaimant(team.name) : DynastyRegistry.hasClaimantAtMonth(team.name, worldMonth),
      exile.legitimacy
    );
  }

  restoreFaction(
    team: Team,
    city: City,
    year: number,
    remnantPopulation: number,
    populationCause: "RESTORATION" | "GOD_ACTION" = "RESTORATION",
    historicalBasis?: { basis: RestorationBasis; heldMonths: number; trigger?: "WAR_TORN_HISTORICAL_CITY" },
    claimantMonth?: number
  ) {
    if (!this.canRestoreFaction(team, claimantMonth ?? year) || city.destroyed ||
        !Number.isSafeInteger(remnantPopulation) || remnantPopulation <= 0 ||
        remnantPopulation > (WorldRemnants.get(team.name)?.population ?? 0)) {
      return false;
    }
    const exile = WorldExiles.get(team.name);
    if (
      !canRestoreExiledFaction(
        remnantPopulation,
        claimantMonth === undefined ? DynastyRegistry.hasClaimant(team.name) : DynastyRegistry.hasClaimantAtMonth(team.name, claimantMonth),
        exile?.legitimacy ?? 100
      )
    ) {
      return false;
    }
    if (city.revoltTo(team, year)) {
      team.markActive(year);
      WorldExiles.restore(team.name);
      const historyGroupId = getRestorationHistoryGroupId(team.name, year, city.id);
      const spawned = this.spawnMembers(
        team,
        Math.max(1, remnantPopulation),
        "Restoration",
        year,
        { cause: populationCause, month: year, context: populationCause === "GOD_ACTION" ? "god-supported restoration" : "exile restoration" }
      );
      const eventId = WorldHistory.addFactionRestored(
        year,
        team.name,
        city.name,
        spawned,
        city.id,
        historyGroupId,
        historicalBasis ? { ...historicalBasis, rulerId: DynastyRegistry.getCurrentRuler(team.name)?.id } : undefined
      );
      DynastyRegistry.recordRestoration(team.name, eventId);
      WorldExiles.recordRestoration(team.name, year, populationCause === "GOD_ACTION" ? "OTHER" : "REMNANT");
      return true;
    }
    return false;
  }

  /** One real resident transfers. No remnant substitution and no spawnMembers call. */
  restoreThroughLocalSupport(team: Team, city: City, worldMonth: number, supporter: User) {
    const owner = city.ownerTeam, claimant = getLocalRestorationClaimant(team, worldMonth);
    const core = Game.Core;
    if (!core || !owner || owner === team || !claimant || city.destroyed || city.lastCapturedYear === worldMonth ||
        city.isInCaptureGrace(worldMonth) || !getLocalRestorationSupporters(city).includes(supporter)) return "INVALID" as const;
    const rules = deriveHistoricalCityRules(city, worldMonth,
      new Map(core.teams.filter(t => t.stateFoundedMonth !== undefined).map(t => [t.name,t.stateFoundedMonth!])));
    const rule = rules?.find(r => r.factionId === team.name), basis = rule && getHistoricalRestorationBasis(rule);
    const stability = getFactionStability(owner) ?? 100;
    const war = getWarTornCityEvidence(city, worldMonth, stability);
    if (!rule || !basis || !(city.loyalty <= 28 || war.eligible)) return "INVALID" as const;
    const unitId = supporter.player.logicalUnitId!;
    const unit = core.logicalUnitRegistry.get(unitId)!;
    const position = { x: unit.logicalX, y: unit.logicalY };
    const spatialEvidence = Math.hypot(position.x-(city.block.x+Game.BlockSize/2),position.y-(city.block.y+Game.BlockSize/2)) <= Game.BlockSize*LOCAL_RESTORATION_RADIUS_CELLS
      ? {responseRadiusCells:LOCAL_RESTORATION_RADIUS_CELLS}
      : {responseRadiusCells:LOCAL_RESTORATION_ZONE_MAX_CELLS,responseArea:"CONTROLLED_CITY_ZONE" as const,responseNeighborLayers:2,
        responseCenterX:city.block.x+Game.BlockSize/2,responseCenterY:city.block.y+Game.BlockSize/2};
    const formationSnapshots=MilitaryCommandRegistry.getFormations().filter(f=>f.status==="ACTIVE" && f.memberUnitIds.includes(unitId))
      .map(formation=>({formation,memberUnitIds:[...formation.memberUnitIds]}));
    const crisis = { cityLoyalty: city.loyalty, cityDevastation: city.devastation, ownerStability: stability, recentTransfers: war.recentTransfers };
    const historyGroupId = getRestorationHistoryGroupId(team.name, worldMonth, city.id);
    const beforeOwnerCount = owner.users.size, beforeNewCount = team.users.size;
    WorldHistory.beginBatchNotifications();
    try {
      // Resolve a genuinely due death through the existing succession path, only
      // once a successful restoration has been selected. Never resurrect the predecessor.
      if (DynastyRegistry.getCurrentRuler(team.name)?.id !== claimant.id) DynastyRegistry.update(worldMonth, [team]);
      if (!getLocalRestorationClaimant(team, worldMonth)) return "INVALID" as const;
      let transferAttempted = false;
      const transferred = city.revoltTo(team, worldMonth, () => {
        transferAttempted = true;
        try {
          supporter.setTeam(team, { cause: "RESTORATION", month: worldMonth,
            relatedFactionId: owner.name, context: `local resident response ${city.id}/${unitId}` });
          if (supporter.team === team && team.users.has(supporter) && !owner.users.has(supporter) &&
              supporter.player.team === team && core.logicalUnitRegistry.get(unitId)?.factionId === team.name &&
              owner.users.size === beforeOwnerCount - 1 && team.users.size === beforeNewCount + 1) return true;
        } catch { /* Roll back only the prepared transfer; no city mutation has begun. */ }
        if (supporter.team !== owner) supporter.setTeam(owner, { cause: "RESTORATION", month: worldMonth, context: "local response transfer rollback" });
        for(const snapshot of formationSnapshots) snapshot.formation.memberUnitIds=snapshot.memberUnitIds;
        return false;
      });
      if (!transferred) return transferAttempted ? "TRANSFER_FAILED" as const : "INVALID" as const;
      WorldExiles.restore(team.name);
      const rulerId = DynastyRegistry.getCurrentRuler(team.name)!.id;
      const dynasty = DynastyRegistry.get(team.name)!;
      const epoch = dynasty.houseEpochs![dynasty.houseEpochs!.length - 1];
      const eventId = WorldHistory.addLocalResidentRestoration(worldMonth, team, owner, city, {
        rulerId, claimantName: `${DynastyRegistry.getCurrentRuler(team.name)!.houseName.replace(/氏$/, "")}${DynastyRegistry.getCurrentRuler(team.name)!.givenName}`, supporterUserId: supporter.id, supporterName: supporter.name, supporterBornMonth: supporter.bornMonth,
        supporterLogicalUnitId: unitId, supporterX: position.x, supporterY: position.y,
        houseName: epoch.houseName, houseEpochStartMonth: epoch.startMonth,
        restorationBasis: basis, historicalHeldMonths: rule.heldMonths,
        restorationTrigger: war.eligible ? "WAR_TORN_HISTORICAL_CITY" : "LOW_LOYALTY",
        ...crisis,
        ...spatialEvidence,
      }, historyGroupId);
      DynastyRegistry.recordRestoration(team.name, eventId);
      WorldExiles.recordRestoration(team.name, worldMonth, "LOCAL_RESIDENT");
      FactionLifetimeRecords.observe(team, worldMonth);
      return "RESTORED" as const;
    } finally { WorldHistory.endBatchNotifications(); }
  }

  private discardUnregisteredFaction(team: Team) {
    const groups = [team.players, team.blocks, team.farms];
    for (const group of groups) if (group) { group.active = false; group.runChildUpdate = false; }
    Game.Core?.scene?.sys?.events?.once("postupdate", () => groups.forEach(g => { if (g?.scene) destroyRuntimeGroupAtSafeBoundary(g, true); }));
  }

  /** Population preparation precedes city consequences and runtime registration. */
  private prepareFoundingPopulation(team: Team, owner: Team, users: User[], month: number, cause: "REBELLION_TRANSFER" | "EMPIRE_SPLIT_TRANSFER") {
    if(users.some(u=>this.foundingTransactions.has(u))) return false;
    users.forEach(u=>this.foundingTransactions.add(u));
    const memberships = MilitaryCommandRegistry.getFormations().filter(f => f.status === "ACTIVE").map(f => ({f,members:[...f.memberUnitIds]}));
    try {
      for (const user of users) {
        if (user.team !== owner || user.isDestroyed) throw new Error("founding supporter identity changed");
        user.setTeam(team, { cause, month, context: "真实既有人口支持新政权" });
        if (user.team !== team) throw new Error("founding supporter transfer failed");
      }
      if (Game.Core.addRuntimeTeam(team)) {users.forEach(u=>this.foundingTransactions.delete(u));return true;}
    } catch { /* Roll back while no city has changed owner. */ }
    for (const user of users) if (user.team === team) user.setTeam(owner, { cause, month, context: "建势人口转属回退" });
    for (const {f,members} of memberships) f.memberUnitIds = members;
    users.forEach(u=>this.foundingTransactions.delete(u));
    return false;
  }

  createRebelFaction(options: RebelFactionOptions) {
    const core = Game.Core;
    if (!core?.map) {
      return undefined;
    }
    const { city, year, factionType } = options;
    const previousOwner = city.ownerTeam;
    if (!previousOwner || city.destroyed || previousOwner.status !== "ACTIVE") return undefined;
    if (!options.godDriven && (!hasPopularPoliticalCrisis(city,year,core.totalCells) || city.isInCaptureGrace(year))) return undefined;
    const candidates = assessPopularSupport(city, year).users.filter(u=>!this.foundingTransactions.has(u));
    if (!candidates.length && !options.godDriven) return undefined;
    const targetPopulation = worldRandom.int(REBEL_INITIAL_POPULATION_MIN, REBEL_INITIAL_POPULATION_MAX);
    const lowLoyaltyUsers = candidates.slice(0, targetPopulation);

    const name = createRebelFactionName(city, factionType, this.getExistingNames());
    const color = this.createRebelColor();
    const team = new Team(
      core.scene,
      name,
      color,
      Math.round(city.block.x / Game.BlockSize),
      Math.round(city.block.y / Game.BlockSize),
      [],
      undefined,
      city.name,
      createRebelHouseName(
        city,
        factionType,
        undefined,
        undefined,
        this.getExistingHouseNames()
      ),
      undefined,
      undefined,
      undefined,
      undefined,
      false
    );
    team.factionType = factionType;
    team.initializeLifecycle(year);
    team.initializeIdentity(year);
    team.setOrigin({
      type: factionType === "FRONTIER" ? "FRONTIER" : "REBEL",
      foundedMonth: year,
      parentFactionId: previousOwner.name,
      foundingCityIds: [city.id],
    });
    if (!city.revoltTo(team, year, () => this.prepareFoundingPopulation(team, previousOwner, lowLoyaltyUsers, year, "REBELLION_TRANSFER"))) {
      this.discardUnregisteredFaction(team); return undefined;
    }
    DynastyRegistry.initializeFaction(team, year);
    team.setOrigin({ ...team.origin, foundingRulerId: DynastyRegistry.getCurrentRuler(team.name)?.id });
    const external = options.godDriven ? this.spawnMembers(team, Math.max(0, targetPopulation-lowLoyaltyUsers.length), "Rebel", year,
      { cause: "GOD_ACTION", month: year, context: "神力建势的特殊外源人口，非转属" }) : 0;
    const populationSource = { transferredPopulation: lowLoyaltyUsers.length, externalPopulation: external };
    const historyGroupId = getFoundingHistoryGroupId(team.name, year);

    if (factionType === "FRONTIER") {
      WorldHistory.addFrontierFactionFounded(
        year,
        team.name,
        previousOwner.name,
        city.name,
        city.id,
        DynastyRegistry.getRulerDisplay(team.name),
        DynastyRegistry.getCurrentRuler(team.name)?.id,
        historyGroupId,
        populationSource
      );
    } else {
      WorldHistory.addRebelFactionFounded(
        year,
        team.name,
        previousOwner.name,
        city.name,
        city.id,
        DynastyRegistry.getRulerDisplay(team.name),
        DynastyRegistry.getCurrentRuler(team.name)?.id,
        historyGroupId,
        populationSource
      );
    }
    DynastyRegistry.recordRebellion(previousOwner.name);
    FactionLifetimeRecords.observe(team, year);
    return team;
  }

  createSplitFaction(previousOwner: Team, cities: City[], year: number, politicalStrain = calculateImperialStrain(previousOwner,Game.Core?.totalCells ?? 1)) {
    const core = Game.Core;
    const coreCity = cities[0];
    if (!core?.map || !coreCity || !previousOwner) {
      return undefined;
    }
    if (previousOwner.status !== "ACTIVE" || coreCity.destroyed || cities.some(c => c.ownerFactionId !== previousOwner.name || c.destroyed)) return undefined;
    if (previousOwner.cities.length < EMPIRE_SPLIT_MIN_CITIES || coreCity.loyalty > EMPIRE_SPLIT_LOW_LOYALTY ||
      ((getFactionStability(previousOwner) ?? 100) >= EMPIRE_SPLIT_STABILITY_THRESHOLD && politicalStrain < EMPIRE_SPLIT_STRAIN_THRESHOLD) || coreCity.isInCaptureGrace(year)) return undefined;
    const candidates = assessPopularSupport(coreCity, year).users.filter(u=>!this.foundingTransactions.has(u));
    if (!candidates.length) return undefined;
    const lowLoyaltyUsers = candidates.slice(0, worldRandom.int(REBEL_INITIAL_POPULATION_MIN, REBEL_INITIAL_POPULATION_MAX));
    const name = createRebelFactionName(coreCity, "REBEL", this.getExistingNames());
    const color = this.createRebelColor();
    const team = new Team(
      core.scene,
      name,
      color,
      Math.round(coreCity.block.x / Game.BlockSize),
      Math.round(coreCity.block.y / Game.BlockSize),
      [],
      undefined,
      coreCity.name,
      createRebelHouseName(
        coreCity,
        "SPLIT",
        undefined,
        undefined,
        this.getExistingHouseNames()
      ),
      undefined,
      undefined,
      undefined,
      undefined,
      false
    );
    team.factionType = "SPLIT";
    team.initializeLifecycle(year);
    team.initializeIdentity(year);
    team.setOrigin({
      type: "SPLIT",
      foundedMonth: year,
      parentFactionId: previousOwner.name,
      foundingCityIds: cities.map((city) => city.id),
    });
    if (!coreCity.revoltTo(team, year, () => this.prepareFoundingPopulation(team, previousOwner, lowLoyaltyUsers, year, "EMPIRE_SPLIT_TRANSFER"))) {
      this.discardUnregisteredFaction(team); return undefined;
    }
    const transferredCities = [coreCity, ...cities.slice(1).filter(city => city.revoltTo(team, year))];
    this.transferNearbyTerritory(previousOwner, team, coreCity);
    DynastyRegistry.initializeFaction(team, year);
    team.setOrigin({ ...team.origin, foundingRulerId: DynastyRegistry.getCurrentRuler(team.name)?.id });
    FactionLifetimeRecords.observe(team, year);
    return { team, transferredCities, transferredPopulation: lowLoyaltyUsers.length, externalPopulation: 0 };
  }

  foundCity(team: Team, block: Block, cityName: string | undefined, year: number) {
    const id = `${team.name}-city-${year}-${this.sequence++}`;
    const resolvedCityName = cityName ?? CityNameRegistry.allocateCityName(undefined, id, year);
    const city = new City(id, resolvedCityName, team.name, block, year, false);
    city.defense = getNewCityInitialDefense(city.maxDefense);
    city.loyalty = worldRandom.int(80, 90);
    city.claimFortifiedZone(team);
    WorldHistory.addCityFounded(year, team.name, city.name, city.id);
    return city;
  }

  private spawnMembers(team: Team, count: number, prefix: string, year: number, populationMutation: PopulationMutationContext) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      this.sequence += 1;
      const name = `${prefix}-${team.name}-${year}-${String(this.sequence).padStart(4, "0")}`;
      const before = team.users.size;
      const joinedTeam = Danmu.Apply(
        createLocalDanmu(
          name,
          team.name,
          worldRandom.int(USER_RESTORED_LOYALTY_MIN, USER_RESTORED_LOYALTY_MAX)
        ),
        populationMutation
      );
      if (joinedTeam === team && team.users.size > before) {
        spawned += team.users.size - before;
      }
    }
    return spawned;
  }

  private createRebelColor() {
    const hue = worldRandom.int(0, 360);
    const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.65, 0.48);
    return color.color;
  }

  private getExistingNames() {
    return Game.Core?.teams.flatMap((team) => [team.name, team.displayName]) ?? [];
  }

  private getExistingHouseNames() {
    return Game.Core?.teams.map((team) => team.houseName) ?? [];
  }

  private transferNearbyTerritory(previousOwner: Team, nextOwner: Team, coreCity: City) {
    const blocks = [...previousOwner.blocks.children.entries] as Block[];
    blocks.forEach((block) => {
      if (block.city && block.city.ownerTeam !== nextOwner) {
        return;
      }
      const distance =
        Math.abs(block.x - coreCity.block.x) + Math.abs(block.y - coreCity.block.y);
      if (distance <= Game.BlockSize * EMPIRE_SPLIT_REGION_RADIUS_CELLS) {
        block.claimForTeam(nextOwner);
      }
    });
  }
}

const FactionRegistry = new FactionRegistryStore();

export default FactionRegistry;

function getFoundingHistoryGroupId(factionId: string, year: number) {
  return `founding-${factionId}-${year}`;
}

function getRestorationHistoryGroupId(factionId: string, year: number, cityId: string) {
  return `restoration-${factionId}-${year}-${cityId}`;
}
