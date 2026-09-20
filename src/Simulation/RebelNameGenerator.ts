import City from "../Components/City";
import { FactionType } from "../Components/Team";
import { createRuntimeDynastyHouseName } from "../Politics/DynastySurnameGenerator";

interface RebelNameCityLike {
  name: string;
  founderTeam?: {
    houseName?: string;
  };
  block: {
    x: number;
    y: number;
    scene: {
      renderer: {
        width: number;
        height: number;
      };
    };
  };
}

const frontierNames = {
  north: "北境军",
  south: "南疆军",
  west: "西陲军",
  east: "东原军",
};

const rebelDirections = [
  "",
  "东",
  "西",
  "南",
  "北",
  "中",
  "左",
  "右",
  "前",
  "后",
  "山",
  "河",
  "关",
  "野",
  "城",
];
const rebelSuffixes = ["义军", "义师", "义众", "义旅", "义营", "义兵", "民军", "乡军"];
const frontierQualifiers = [
  "",
  "玄",
  "赤",
  "青",
  "白",
  "义",
  "镇",
  "护",
  "远",
  "安",
  "平",
  "定",
];

export function createRebelFactionName(
  city: City | RebelNameCityLike,
  factionType: FactionType,
  existingNames: Iterable<string> = []
) {
  const used = new Set(existingNames);
  if (factionType === "FRONTIER") {
    return pickFirstUnused(createFrontierNameCandidates(city), used);
  }
  return pickFirstUnused(createRebelNameCandidates(city.name), used);
}

export function createRebelHouseName(
  city: City | RebelNameCityLike,
  factionType: FactionType,
  pickIndex = (max: number) => Phaser.Math.Between(0, max - 1),
  compoundRoll = () => Phaser.Math.Between(1, 100),
  existingHouseNames: Iterable<string | undefined> = []
) {
  return createRuntimeDynastyHouseName({
    factionType,
    existingHouseNames,
    recentHouseNames: city.founderTeam?.houseName ? [city.founderTeam.houseName] : [],
    pickIndex,
    compoundRoll,
  });
}

function createRebelNameCandidates(cityName: string) {
  const names: string[] = [];
  rebelSuffixes.forEach((suffix) => {
    rebelDirections.forEach((direction) => {
      names.push(`${cityName}${direction}${suffix}`);
    });
  });
  return names;
}

function createFrontierNameCandidates(city: City | RebelNameCityLike) {
  const base = getFrontierName(city);
  return frontierQualifiers.map((qualifier) =>
    qualifier ? `${qualifier}${base}` : base
  );
}

function pickFirstUnused(candidates: string[], used: Set<string>) {
  const name = candidates.find((candidate) => !used.has(candidate));
  if (name) {
    return name;
  }
  throw new Error("RebelNameGenerator exhausted: no non-numeric faction name available");
}

function getFrontierName(city: City | RebelNameCityLike) {
  const xRatio = city.block.x / Math.max(1, city.block.scene.renderer.width);
  const yRatio = city.block.y / Math.max(1, city.block.scene.renderer.height);
  if (yRatio < 0.25) {
    return frontierNames.north;
  }
  if (yRatio > 0.75) {
    return frontierNames.south;
  }
  if (xRatio < 0.5) {
    return frontierNames.west;
  }
  return frontierNames.east;
}
