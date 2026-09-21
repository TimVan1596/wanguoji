import type Core from "../Game/Core";
import { validateDynastyInvariants } from "../Politics/DynastyInvariant";
import ArchivedCities from "./ArchivedCities";
import { getCityInteractionGridKey } from "./CityInteractionIndex";
import { validateFactionIdentities } from "./FactionIdentity";

interface CityZoneLike {
  id?: string;
  name: string;
  block: unknown;
  ownerFactionId: string;
  fortifiedCells: Array<{
    x?: number;
    y?: number;
    city?: unknown;
    team?: { name: string };
  }>;
}

interface InteractionIndexLike {
  resolveGrid: (gridX: number, gridY: number) => string | undefined;
  entries: () => Array<[string, string]>;
}

export function validateWorldState(core: Core) {
  const issues: string[] = [];
  const teams = core.teams;
  const teamNames = new Set<string>();

  teams.forEach((team) => {
    if (teamNames.has(team.name)) {
      issues.push(`duplicated faction id: ${team.name}`);
    }
    teamNames.add(team.name);
  });

  teams.forEach((team) => {
    if (team.status === "ACTIVE" && team.cities.length === 0) {
      issues.push(`ACTIVE faction has no city: ${team.name}`);
    }
    if (team.status === "EXTINCT" && team.rulerUser) {
      issues.push(`EXTINCT faction still has ruler unit: ${team.name}`);
    }
    if (team.status === "EXTINCT" && team.cities.length > 0) {
      issues.push(`EXTINCT faction still owns active city: ${team.name}`);
    }
  });
  core.allDynasties.forEach((dynasty) => {
    const team = teams.find((item) => item.name === dynasty.factionId);
    if (team?.status === "EXTINCT" && dynasty.currentRulerId) {
      issues.push(`EXTINCT faction still has current ruler: ${team.name}`);
    }
  });
  issues.push(...validateFactionIdentities(teams));

  core.allCities.forEach((city) => {
    if (!teamNames.has(city.ownerFactionId)) {
      issues.push(`city owner missing: ${city.name} -> ${city.ownerFactionId}`);
    }
    if (!teamNames.has(city.founderFactionId)) {
      issues.push(`city founder missing from runtime teams: ${city.name} -> ${city.founderFactionId}`);
    }
  });
  issues.push(...validateCityNameUniqueness(core.allCities, ArchivedCities.list()));
  issues.push(...validateCityZoneMappings(core.allCities));
  issues.push(
    ...validateCityInteractionIndex(
      core.allCities,
      core.cityInteractionIndex,
      32
    )
  );
  issues.push(
    ...validateDynastyInvariants(core.allDynasties, (factionId) =>
      core.teams.find((team) => team.name === factionId)?.status
    )
  );

  if (issues.length > 0) {
    console.error("[Wanguoji] World invariant violation", issues);
  }
  return issues;
}

export function validateCityNameUniqueness(
  activeCities: Array<{ id?: string; name: string; foundedYear?: number }>,
  archivedCities: Array<{ id?: string; name: string; foundedMonth?: number }>
) {
  const issues: string[] = [];
  const activeByName = new Map<string, Array<{ id?: string; foundedYear?: number }>>();
  activeCities.forEach((city) => {
    const list = activeByName.get(city.name) ?? [];
    list.push({ id: city.id, foundedYear: city.foundedYear });
    activeByName.set(city.name, list);
  });
  activeByName.forEach((cities, name) => {
    if (cities.length > 1) {
      issues.push(
        `duplicate city name: ${name} active=${cities
          .map((city) => `${city.id ?? "unknown"}@${city.foundedYear ?? "?"}`)
          .join(",")}`
      );
    }
  });

  const archivedNames = new Map<string, Array<{ id?: string; foundedMonth?: number }>>();
  archivedCities.forEach((city) => {
    const list = archivedNames.get(city.name) ?? [];
    list.push({ id: city.id, foundedMonth: city.foundedMonth });
    archivedNames.set(city.name, list);
  });
  activeCities.forEach((city) => {
    const archived = archivedNames.get(city.name);
    if (archived && archived.length > 0) {
      issues.push(
        `duplicate city name with archive: ${city.name} active=${city.id ?? "unknown"} archived=${archived
          .map((item) => `${item.id ?? "unknown"}@${item.foundedMonth ?? "?"}`)
          .join(",")}`
      );
    }
  });
  return issues;
}

export function validateCityInteractionIndex(
  cities: CityZoneLike[],
  index: InteractionIndexLike,
  blockSize: number
) {
  const issues: string[] = [];
  const activeCityIds = new Set(cities.map((city) => city.id ?? city.name));
  cities.forEach((city) => {
    const cityId = city.id ?? city.name;
    city.fortifiedCells.forEach((cell) => {
      if (cell.x === undefined || cell.y === undefined) {
        return;
      }
      const gridX = Math.round(cell.x / blockSize);
      const gridY = Math.round(cell.y / blockSize);
      const indexedCityId = index.resolveGrid(gridX, gridY);
      if (indexedCityId !== cityId) {
        issues.push(
          `city interaction index mismatch: ${city.name} ${getCityInteractionGridKey(gridX, gridY)} -> ${indexedCityId ?? "none"}`
        );
      }
    });
  });
  index.entries().forEach(([key, cityId]) => {
    if (!activeCityIds.has(cityId)) {
      issues.push(`city interaction index stale city: ${key} -> ${cityId}`);
    }
  });
  return issues;
}

export function validateCityZoneMappings(cities: CityZoneLike[]) {
  const issues: string[] = [];
  const blockOwners = new Map<unknown, string>();
  cities.forEach((city) => {
    if (city.fortifiedCells.length === 0) {
      issues.push(`city has empty fortified zone: ${city.name}`);
    }
    if (!city.fortifiedCells.some((cell) => cell === city.block)) {
      issues.push(`city center block not in fortified zone: ${city.name}`);
    }
    city.fortifiedCells.forEach((cell) => {
      const existingOwner = blockOwners.get(cell);
      if (existingOwner && existingOwner !== city.name) {
        issues.push(`block belongs to multiple cities: ${existingOwner}/${city.name}`);
      }
      blockOwners.set(cell, city.name);
      if (cell.city !== city) {
        issues.push(`fortified cell city ref mismatch: ${city.name}`);
      }
      if (cell.team?.name !== city.ownerFactionId) {
        issues.push(
          `fortified zone owner mismatch: ${city.name} cell=${cell.team?.name ?? "none"} owner=${city.ownerFactionId}`
        );
      }
    });
  });
  return issues;
}
