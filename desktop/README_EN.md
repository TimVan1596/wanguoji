# Wanguoji Desktop Experimental

This directory contains an Electron feasibility probe for Wanguoji desktop background simulation.

It does not copy `src/` or maintain a second gameplay implementation. The Electron renderer loads the existing Vite / React / Phaser frontend.

## Commands

Development:

```bash
pnpm desktop:dev
```

This command:

1. Compiles `desktop/main.ts` and `desktop/preload.ts`.
2. Starts Vite on a fixed port: `--port 5173 --strictPort`.
3. Waits for `http://localhost:5173` and then launches Electron.

If port 5173 is already in use, Vite fails immediately so Electron cannot accidentally connect to an old server.

Local production run:

```bash
pnpm desktop:build
pnpm desktop:start
```

`desktop:build` only runs the normal Web build and compiles Electron main/preload scripts. This probe does not include packaging, signing, notarization, or auto update.

## Mainland China Electron binary download

If downloading the Electron binary fails, you can use a mirror temporarily:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm install
```

Do not commit personal machine environment variables.

## Runtime strategy

- Web browser mode: `WEB_CATCH_UP`
  - Hidden Chrome tabs use v0.9994 return-time catch-up.
- Electron desktop mode: `DESKTOP_CONTINUOUS`
  - The preload bridge exposes `window.gridGodDesktop`.
  - The renderer disables return-time catch-up debt in this mode.
  - `BrowserWindow.webPreferences.backgroundThrottling = false` is used so timers, animation loop, SimulationDriver and Phaser Arcade Physics can continue while minimized or unfocused.

## What counts as success

Continuous Electron background is successful only if all are true:

1. Minimize the Electron window for at least 60 seconds.
2. `catchUpDebtSteps` remains `0`.
3. `fixedSteps` continues increasing while minimized.
4. `physicsSteps` continues increasing while minimized.
5. `worldMonth` continues increasing while minimized.
6. Restoring the window does not show the Web catch-up overlay.
7. The map evolves through the original Phaser collision / occupation / siege semantics.

If the window pauses and then Web catch-up fills the gap after restore, that is not success. Electron mode disables catch-up to avoid this false positive.

## Minimize / hide / close / sleep

- Minimize / unfocus: P0 target for this probe; expected behavior is continuous simulation.
- `BrowserWindow.hide()`: not a P0 target; record separately if tested.
- Close: exits the app. This probe does not implement close-to-tray.
- System sleep / hibernate: continuous CPU execution is not guaranteed. A future desktop build may combine continuous mode with wake-time catch-up, but this probe does not prevent sleep.

## Security defaults

The BrowserWindow uses:

- `nodeIntegration: false`
- `contextIsolation: true`
- `webSecurity: true`
- `backgroundThrottling: false`
- `sandbox: false`

`sandbox` is disabled in this probe so the TypeScript preload can reliably use Electron IPC. The renderer only receives a read-only desktop marker and a low-frequency heartbeat sender; it does not get `require` or filesystem access.
