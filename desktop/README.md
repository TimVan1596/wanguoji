# 万国纪桌面实验版

这是《万国纪 · Wanguoji》的 Electron 桌面后台运行可行性实验。

它不会复制 `src/`，也不会维护第二份 gameplay。Electron renderer 直接加载当前 Vite / React / Phaser 前端。

## 运行方式

开发模式：

```bash
pnpm desktop:dev
```

该命令会：

1. 编译 `desktop/main.ts` 和 `desktop/preload.ts`。
2. 以固定端口启动 Vite：`--port 5173 --strictPort`。
3. 等待 `http://localhost:5173` 可用后启动 Electron。

如果 5173 已被占用，Vite 会直接失败，避免 Electron 误连到旧服务或其它端口。

本地 production 运行：

```bash
pnpm desktop:build
pnpm desktop:start
```

`desktop:build` 只做 Web build + Electron main/preload 编译；本实验不包含安装包、签名、notarization 或 auto update。

## 中国大陆 Electron binary 下载

如果安装 Electron 时下载二进制失败，可以临时使用镜像：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm install
```

不要把个人机器环境变量写入仓库。

## Runtime strategy

- Web browser mode：`WEB_CATCH_UP`
  - Chrome hidden tab 使用 v0.9994 return-time catch-up。
- Electron desktop mode：`DESKTOP_CONTINUOUS`
  - preload 暴露 `window.gridGodDesktop`。
  - renderer 在该模式下禁用 return-time catch-up debt。
  - `BrowserWindow.webPreferences.backgroundThrottling = false`，目标是在最小化 / 失焦时继续 timers、animation loop、SimulationDriver 和 Phaser Arcade Physics。

## 什么才算真正成功

Continuous Electron background 必须同时满足：

1. Electron 窗口最小化至少 60 秒。
2. `catchUpDebtSteps` 保持 `0`。
3. 最小化期间 `fixedSteps` 持续增加。
4. 最小化期间 `physicsSteps` 持续增加。
5. 最小化期间 `worldMonth` 持续增加。
6. 恢复窗口后不出现 Web catch-up overlay。
7. 地图通过原本 Phaser collision / occupation / siege 语义真实演化。

如果窗口其实暂停，但恢复后依靠 Web catch-up 补算，不算成功。本实验专门禁用 Electron 模式 catch-up 来避免误判。

## Minimize / hide / close / sleep

- Minimize / unfocus：本实验的 P0 验证目标，期望 continuous simulation。
- `BrowserWindow.hide()`：不是本实验 P0；如果测试，请单独记录。
- Close：关闭窗口即退出 app。本实验不实现 close-to-tray。
- System sleep / hibernate：不能保证持续 CPU 执行。未来可以考虑 sleep wake 后 catch-up，本实验不阻止系统睡眠。

## Security defaults

BrowserWindow 使用：

- `nodeIntegration: false`
- `contextIsolation: true`
- `webSecurity: true`
- `backgroundThrottling: false`
- `sandbox: false`

`sandbox` 在本实验中保持关闭，以便当前 TypeScript preload 稳定使用 Electron IPC。Renderer 只得到只读 desktop marker 和低频 heartbeat sender，不获得 `require` 或文件系统访问。
