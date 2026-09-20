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
  REBEL_INITIAL_POPULATION_MAX,
  REBEL_INITIAL_POPULATION_MIN,
  REBEL_LOW_LOYALTY_USER_THRESHOLD,
  USER_RESTORED_LOYALTY_MAX,
  USER_RESTORED_LOYALTY_MIN,
} from "../config/simulation";
import { createRebelFactionName, createRebelHouseName } from "./RebelNameGenerator";
import { hasFormalStateIdentity } from "./FactionIdentity";

interface RebelFactionOptions {
  city: City;
  year: number;
  factionType: FactionType;
  godDriven?: boolean;
}

class FactionRegistryStore {
  private sequence = 0;

  reset() {
    this.sequence = 0;
  }

  canRestoreFaction(team: Team) {
    if (!hasFormalStateIdentity(team)) {
      return false;
    }
    const exile = WorldExiles.get(team.name);
    return canRestoreExiledFaction(
      WorldRemnants.get(team.name)?.population ?? 0,
      DynastyRegistry.hasClaimant(team.name),
      exile?.legitimacy ?? 100
    );
  }

  restoreFaction(team: Team, city: City, year: number, remnantPopulation: number) {
    if (!hasFormalStateIdentity(team)) {
      return false;
    }
    const exile = WorldExiles.get(team.name);
    if (
      !canRestoreExiledFaction(
        remnantPopulation,
        DynastyRegistry.hasClaimant(team.name),
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
        year
      );
      WorldHistory.addFactionRestored(
        year,
        team.name,
        city.name,
        spawned,
        city.id,
        historyGroupId
      );
      DynastyRegistry.recordRestoration(team.name);
      return true;
    }
    return false;
  }

  createRebelFaction(options: RebelFactionOptions) {
    const core = Game.Core;
    if (!core?.map) {
      return undefined;
    }
    const { city, year, factionType } = options;
    const previousOwner = city.ownerTeam;
    if (!previousOwner) {
      return undefined;
    }

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
    if (!core.addRuntimeTeam(team)) {
      return undefined;
    }
    DynastyRegistry.initializeFaction(team, year);
    team.setOrigin({
      ...team.origin,
      foundingRulerId: DynastyRegistry.getCurrentRuler(team.name)?.id,
    });

    const lowLoyaltyUsers = [...previousOwner.users]
      .filter((user) => user.loyalty < REBEL_LOW_LOYALTY_USER_THRESHOLD)
      .slice(0, Phaser.Math.Between(REBEL_INITIAL_POPULATION_MIN, REBEL_INITIAL_POPULATION_MAX));

    lowLoyaltyUsers.forEach((user) => user.obedience(team));
    city.revoltTo(team, year);

    const targetPopulation = Phaser.Math.Between(
      REBEL_INITIAL_POPULATION_MIN,
      REBEL_INITIAL_POPULATION_MAX
    );
    const needed = Math.max(1, targetPopulation - lowLoyaltyUsers.length);
    this.spawnMembers(team, needed, "Rebel", year);
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
        historyGroupId
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
        historyGroupId
      );
    }
    DynastyRegistry.recordRebellion(previousOwner.name);
    return team;
  }

  createSplitFaction(previousOwner: Team, cities: City[], year: number) {
    const core = Game.Core;
    const coreCity = cities[0];
    if (!core?.map || !coreCity || !previousOwner) {
      return undefined;
    }
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
    if (!core.addRuntimeTeam(team)) {
      return undefined;
    }
    DynastyRegistry.initializeFaction(team, year);
    team.setOrigin({
      ...team.origin,
      foundingRulerId: DynastyRegistry.getCurrentRuler(team.name)?.id,
    });

    const lowLoyaltyUsers = [...previousOwner.users]
      .filter((user) => user.loyalty < REBEL_LOW_LOYALTY_USER_THRESHOLD)
      .slice(0, Phaser.Math.Between(REBEL_INITIAL_POPULATION_MIN, REBEL_INITIAL_POPULATION_MAX));
    lowLoyaltyUsers.forEach((user) => user.obedience(team));

    cities.forEach((city) => city.revoltTo(team, year));
    this.transferNearbyTerritory(previousOwner, team, coreCity);

    const targetPopulation = Phaser.Math.Between(3, 8);
    const needed = Math.max(1, Math.min(2, targetPopulation - lowLoyaltyUsers.length));
    this.spawnMembers(team, needed, "Split", year);
    return team;
  }

  foundCity(team: Team, block: Block, cityName: string, year: number) {
    const id = `${team.name}-city-${year}-${this.sequence++}`;
    const city = new City(id, cityName, team.name, block, year, false);
    city.defense = Math.max(1, Math.floor(city.maxDefense * 0.6));
    city.loyalty = Phaser.Math.Between(80, 90);
    city.claimFortifiedZone(team);
    WorldHistory.addCityFounded(year, team.name, city.name, city.id);
    return city;
  }

  private spawnMembers(team: Team, count: number, prefix: string, year: number) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      this.sequence += 1;
      const name = `${prefix}-${team.name}-${year}-${String(this.sequence).padStart(4, "0")}`;
      const joinedTeam = Danmu.Apply(
        createLocalDanmu(
          name,
          team.name,
          Phaser.Math.Between(USER_RESTORED_LOYALTY_MIN, USER_RESTORED_LOYALTY_MAX)
        )
      );
      if (joinedTeam) {
        spawned += 1;
      }
    }
    return spawned;
  }

  private createRebelColor() {
    const hue = Phaser.Math.Between(0, 360);
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
      if (distance <= Game.BlockSize * 8) {
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
