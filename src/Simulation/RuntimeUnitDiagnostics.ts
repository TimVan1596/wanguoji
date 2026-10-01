export interface RuntimeUnitDiagnosticsInput {
  logicalUsers: number;
  rootPlayers: number;
  playerChildren: number;
  activePhaserPlayers: number;
  missingTextureKeys: string[];
}

export function createRuntimeUnitDiagnostics(input: RuntimeUnitDiagnosticsInput) {
  return { ...input, missingTextureKeys: [...input.missingTextureKeys].sort() };
}
