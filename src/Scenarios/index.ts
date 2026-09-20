import { DEFAULT_INITIAL_POPULATION } from "../config/simulation";
import { TeamConfig } from "../store/configSlice";

export interface ScenarioFaction {
  id: string;
  name: string;
  color: number;
  initialPopulation: number;
  spawnX: number;
  spawnY: number;
  capital?: string;
  capitalIndestructible?: boolean;
  houseName?: string;
  shortName?: string;
  joinCommand?: string[];
}

export interface GameScenario {
  id: string;
  name: string;
  description: string;
  subtitle?: string;
  factions: ScenarioFaction[];
}

export const factionPresets = [
  { id: "qin", name: "秦", color: 0x1b1b1b },
  { id: "chu", name: "楚", color: 0x8e24aa },
  { id: "qi", name: "齐", color: 0x00a6d6 },
  { id: "yan", name: "燕", color: 0xf4d03f },
  { id: "zhao", name: "赵", color: 0x2e7d32 },
  { id: "wei", name: "魏", color: 0xd32f2f },
  { id: "han", name: "韩", color: 0xf57c00 },
  { id: "yue", name: "越", color: 0x607d8b },
];

export const warringStatesScenario: GameScenario = {
  id: "warring-states",
  name: "战国七雄",
  subtitle: "约公元前300年的七雄争霸",
  description: "七雄并立，逐鹿天下。约公元前300年的中国战国格局。",
  factions: [
    {
      id: "qin",
      name: "秦",
      color: 0x1b1b1b,
      capital: "咸阳",
      capitalIndestructible: true,
      houseName: "嬴氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.15,
      spawnY: 0.48,
    },
    {
      id: "zhao",
      name: "赵",
      color: 0x2e7d32,
      capital: "邯郸",
      capitalIndestructible: true,
      houseName: "赵氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.43,
      spawnY: 0.26,
    },
    {
      id: "yan",
      name: "燕",
      color: 0xf4d03f,
      capital: "蓟",
      capitalIndestructible: true,
      houseName: "姬氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.77,
      spawnY: 0.15,
    },
    {
      id: "qi",
      name: "齐",
      color: 0x00a6d6,
      capital: "临淄",
      capitalIndestructible: true,
      houseName: "田氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.82,
      spawnY: 0.42,
    },
    {
      id: "wei",
      name: "魏",
      color: 0xd32f2f,
      capital: "大梁",
      capitalIndestructible: true,
      houseName: "魏氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.57,
      spawnY: 0.45,
    },
    {
      id: "han",
      name: "韩",
      color: 0xf57c00,
      capital: "新郑",
      capitalIndestructible: true,
      houseName: "韩氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.49,
      spawnY: 0.56,
    },
    {
      id: "chu",
      name: "楚",
      color: 0x8e24aa,
      capital: "郢",
      capitalIndestructible: true,
      houseName: "熊氏",
      initialPopulation: DEFAULT_INITIAL_POPULATION,
      spawnX: 0.56,
      spawnY: 0.8,
    },
  ],
};

export const gameScenarios: GameScenario[] = [warringStatesScenario];

export function createCustomFaction(index: number): ScenarioFaction {
  const preset = factionPresets[index % factionPresets.length];
  const position = getEvenPosition(index, 4);
  return {
    id: `custom-${index + 1}`,
    name: preset.name,
    color: preset.color,
    initialPopulation: DEFAULT_INITIAL_POPULATION,
    spawnX: position.x,
    spawnY: position.y,
  };
}

export function createCustomScenario(factions: ScenarioFaction[]): GameScenario {
  return {
    id: "custom",
    name: "自定义世界",
    description: "创建属于自己的势力与初始格局。",
    factions: normalizeCustomFactions(factions),
  };
}

export function scenarioToTeams(scenario: GameScenario): TeamConfig[] {
  return scenario.factions.map((faction) => ({
    homeX: 0,
    homeY: 0,
    spawnX: clampRatio(faction.spawnX),
    spawnY: clampRatio(faction.spawnY),
    name: faction.name,
    color: faction.color,
    capital: faction.capital,
    capitalIndestructible: faction.capitalIndestructible,
    houseName: faction.houseName ?? `${faction.name}氏`,
    joinCommand: faction.joinCommand ?? [],
    shortName: faction.shortName,
  }));
}

export function scenarioToInitialPopulations(scenario: GameScenario) {
  return Object.fromEntries(
    scenario.factions.map((faction) => [
      faction.name,
      Math.max(0, Math.floor(faction.initialPopulation)),
    ])
  );
}

export function redistributeEvenly(factions: ScenarioFaction[]) {
  return factions.map((faction, index) => {
    const position = getEvenPosition(index, factions.length);
    return {
      ...faction,
      spawnX: position.x,
      spawnY: position.y,
    };
  });
}

export function redistributeRandomly(factions: ScenarioFaction[]) {
  return factions.map((faction) => ({
    ...faction,
    ...getRandomPosition(),
  }));
}

function normalizeCustomFactions(factions: ScenarioFaction[]) {
  const usedNames = new Set<string>();
  return factions.map((faction, index) => {
    const fallback = `势力${index + 1}`;
    const rawName = faction.name.trim() || fallback;
    let name = rawName;
    if (usedNames.has(name)) {
      name = `${rawName}${index + 1}`;
    }
    usedNames.add(name);

    return {
      ...faction,
      id: faction.id || `custom-${index + 1}`,
      name,
      initialPopulation: Math.max(
        1,
        Math.min(100, Math.floor(faction.initialPopulation))
      ),
      spawnX: clampRatio(faction.spawnX),
      spawnY: clampRatio(faction.spawnY),
    };
  });
}

function getEvenPosition(index: number, count: number) {
  const radius = 0.38;
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius,
  };
}

function getRandomPosition() {
  return {
    spawnX: 0.12 + Math.random() * 0.76,
    spawnY: 0.12 + Math.random() * 0.76,
  };
}

function clampRatio(value: number) {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}
