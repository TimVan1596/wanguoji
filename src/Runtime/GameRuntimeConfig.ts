import type Phaser from "phaser";
import type { GridGodDesktopBridge } from "./DesktopRuntime";

export const PHASER_AUDIO_CONFIG = { noAudio: true } as const;

/** Only launch metadata from the Desktop preload can select the experimental scheduler.
 * Applied once, before Phaser.Game constructs its TimeStep. Web/query parameters cannot enable it. */
export function withDesktopSchedulerConfig(
  config: Phaser.Types.Core.GameConfig,
  bridge?: Pick<GridGodDesktopBridge, "isDesktop" | "debugLaunchOptions">
): Phaser.Types.Core.GameConfig {
  if (bridge?.isDesktop !== true || bridge.debugLaunchOptions?.debug !== true ||
      bridge.debugLaunchOptions.forceTimeoutLoop !== true) return config;
  return { ...config, fps: { target: 60, ...config.fps, forceSetTimeOut: true } };
}
