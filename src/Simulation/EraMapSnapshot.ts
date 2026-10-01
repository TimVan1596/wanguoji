import type Team from "../Components/Team";
import { getFactionDisplayNameAtMonth } from "./FactionIdentity";

export interface EraMapSnapshotV1 {
  version: 1;
  capturedMonth: number;
  widthCells: number;
  heightCells: number;
  factionPalette: Array<{ factionId: string; displayName: string; color: number }>;
  ownerRuns: Array<{ paletteIndex: number; length: number }>;
  cities: Array<{
    cityId: string;
    name: string;
    gridX: number;
    gridY: number;
    ownerFactionId?: string;
    founderFactionId?: string;
    isCapital: boolean;
  }>;
}

export interface EraMapCaptureInput {
  capturedMonth: number;
  widthCells: number;
  heightCells: number;
  factions: Team[];
  ownerAt: (gridX: number, gridY: number) => string | undefined;
}

export function captureEraMapSnapshot(input: EraMapCaptureInput): EraMapSnapshotV1 {
  const factionById = new Map(input.factions.map((faction) => [faction.name, faction]));
  const ownerIds: Array<string | undefined> = [];
  for (let y = 0; y < input.heightCells; y += 1) {
    for (let x = 0; x < input.widthCells; x += 1) ownerIds.push(input.ownerAt(x, y));
  }

  const referencedIds = new Set(ownerIds.filter((id): id is string => Boolean(id)));
  const unknownOwner = [...referencedIds].find((id) => !factionById.has(id));
  if (unknownOwner) throw new Error(`Era Atlas owner faction is missing from runtime factions: ${unknownOwner}`);
  input.factions.forEach((faction) => {
    if (faction.cities.length > 0) referencedIds.add(faction.name);
  });
  const factionPalette = [...referencedIds]
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
    .flatMap((factionId) => {
      const faction = factionById.get(factionId);
      return faction ? [{
        factionId,
        displayName: getFactionDisplayNameAtMonth(faction, input.capturedMonth),
        color: faction.color,
      }] : [];
    });
  const paletteIndexByFaction = new Map(factionPalette.map((entry, index) => [entry.factionId, index + 1]));
  const encoded = encodeOwnerRuns(ownerIds.map((ownerId) => ownerId ? paletteIndexByFaction.get(ownerId) ?? 0 : 0));
  const cities = input.factions.flatMap((faction) => faction.cities.map((city) => ({
    cityId: city.id,
    name: city.name,
    gridX: Math.round(city.block.x / city.block.width),
    gridY: Math.round(city.block.y / city.block.height),
    ownerFactionId: city.ownerFactionId,
    founderFactionId: city.founderFactionId,
    isCapital: city.isCapital,
  }))).sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX || (a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0));

  return {
    version: 1,
    capturedMonth: input.capturedMonth,
    widthCells: input.widthCells,
    heightCells: input.heightCells,
    factionPalette,
    ownerRuns: encoded,
    cities,
  };
}

export function encodeOwnerRuns(indices: number[]) {
  const runs: EraMapSnapshotV1["ownerRuns"] = [];
  for (const paletteIndex of indices) {
    const last = runs[runs.length - 1];
    if (last && last.paletteIndex === paletteIndex) last.length += 1;
    else runs.push({ paletteIndex, length: 1 });
  }
  return runs;
}

export function decodeOwnerRuns(snapshot: Pick<EraMapSnapshotV1, "ownerRuns" | "widthCells" | "heightCells">) {
  const expectedLength = snapshot.widthCells * snapshot.heightCells;
  const owners: number[] = [];
  for (const run of snapshot.ownerRuns) {
    for (let i = 0; i < run.length && owners.length < expectedLength; i += 1) owners.push(run.paletteIndex);
  }
  while (owners.length < expectedLength) owners.push(0);
  return owners;
}

export function getEraAtlasDiagnostics(eras: Array<{ mapSnapshot?: EraMapSnapshotV1 }>) {
  const snapshots = eras.flatMap((era) => era.mapSnapshot ? [era.mapSnapshot] : []);
  const rawCells = snapshots.reduce((sum, snapshot) => sum + snapshot.widthCells * snapshot.heightCells, 0);
  const rleRuns = snapshots.reduce((sum, snapshot) => sum + snapshot.ownerRuns.length, 0);
  const estimatedJsonBytes = new TextEncoder().encode(JSON.stringify(snapshots)).length;
  return { snapshotCount: snapshots.length, rawCells, rleRuns, estimatedJsonBytes };
}

export function isEraMapSnapshotV1(value: unknown): value is EraMapSnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<EraMapSnapshotV1>;
  if (snapshot.version !== 1 || !Number.isInteger(snapshot.capturedMonth) || !Number.isInteger(snapshot.widthCells) || !Number.isInteger(snapshot.heightCells)) return false;
  if ((snapshot.widthCells ?? -1) < 0 || (snapshot.heightCells ?? -1) < 0 || !Array.isArray(snapshot.factionPalette) || !Array.isArray(snapshot.ownerRuns) || !Array.isArray(snapshot.cities)) return false;
  const palette = snapshot.factionPalette as unknown[];
  if (palette.some((entry) => !entry || typeof entry !== "object" || typeof (entry as any).factionId !== "string" || typeof (entry as any).displayName !== "string" || !Number.isInteger((entry as any).color))) return false;
  const runs = snapshot.ownerRuns as unknown[];
  if (runs.some((entry) => !entry || typeof entry !== "object" || !Number.isInteger((entry as any).paletteIndex) || (entry as any).paletteIndex < 0 || (entry as any).paletteIndex > palette.length || !Number.isInteger((entry as any).length) || (entry as any).length <= 0)) return false;
  if (runs.reduce((sum, entry) => sum + (entry as any).length, 0) !== (snapshot.widthCells ?? 0) * (snapshot.heightCells ?? 0)) return false;
  return (snapshot.cities as unknown[]).every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const city = entry as any;
    return typeof city.cityId === "string" && typeof city.name === "string" && Number.isInteger(city.gridX) && Number.isInteger(city.gridY) && city.gridX >= 0 && city.gridX < (snapshot.widthCells ?? 0) && city.gridY >= 0 && city.gridY < (snapshot.heightCells ?? 0) && typeof city.isCapital === "boolean" && (city.ownerFactionId === undefined || typeof city.ownerFactionId === "string") && (city.founderFactionId === undefined || typeof city.founderFactionId === "string");
  });
}
