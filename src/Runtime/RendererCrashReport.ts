export interface RendererCrashContext {
  source: string; appVersion: string; worldMonth: number; errorName: string; message: string; stack: string;
  rightPanelTab: string; factionTab: string; selectedFactionName: string | null; worldRunning: boolean;
  simulationSpeed: number; lastSimulationSubsystem: string; runtimeUnits: unknown; worldScale: unknown;
  genealogy: unknown;
}

export function formatRendererCrashReport(context: RendererCrashContext) {
  return [
    `[Wanguoji] FATAL RENDERER (${context.source})`,
    `APP_VERSION=${context.appVersion} worldMonth=${context.worldMonth}`,
    `error=${context.errorName}: ${context.message}`,
    `panel=${context.rightPanelTab}/${context.factionTab} faction=${context.selectedFactionName ?? "—"}`,
    `running=${context.worldRunning} speed=${context.simulationSpeed}x lastCompletedSimulationSubsystem=${context.lastSimulationSubsystem} (context only; not a React crash-source attribution)`,
    `runtimeUnits=${JSON.stringify(context.runtimeUnits)}`,
    `worldScale=${JSON.stringify(context.worldScale)}`,
    `genealogy=${JSON.stringify(context.genealogy)}`,
    context.stack,
  ].join("\n");
}
