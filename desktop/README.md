# 万国纪桌面运行时

这是《万国纪 · Wanguoji》的 Electron continuous runtime。系统处于 awake 状态时，最小化、失焦或被遮挡不切换到 Web catch-up；操作系统真正 suspend 的时间则在恢复时通过独立、有上限的 catch-up 补算。

它不会复制 `src/`，也不会维护第二份 gameplay。Electron renderer 直接加载当前 Vite / React / Phaser 前端。

## 运行方式

推荐长期运行与世界演化验收：

```bash
pnpm desktop:start
```

诊断运行（打开 `debug=1` 面板）：

```bash
pnpm desktop:start:debug
```

若需对比普通头像与 rex `CircleMaskImage`，使用 `pnpm desktop:start:debug:plain` 启动 plain-avatar 诊断模式。该启动方式使用 app-private 参数，不占用 Node/Electron 的 `--debug` 参数。

noFace 纹理来源诊断（默认 SVG 对比 PNG）：

```bash
pnpm desktop:start:debug
pnpm desktop:start:debug:png
```

PNG 探针只改变 noFace 纹理加载来源，其他单位和模拟逻辑不变；普通启动仍使用 SVG。

开发模式：

```bash
pnpm desktop:dev
```

诊断开发模式：

```bash
pnpm desktop:dev:debug
```

plain avatar 开发诊断：

```bash
pnpm desktop:dev:debug:plain
```

PNG 纹理探针开发运行：

```bash
pnpm desktop:dev:debug:png
```

该命令会：

1. 编译 `desktop/main.ts` 和 `desktop/preload.ts`。
2. 以固定端口启动 Vite：`--port 5173 --strictPort`。
3. 等待 `http://localhost:5173` 可用后启动 Electron。

这些脚本通过 Electron app 参数传递 Vite 地址，可直接用于 macOS 与 Windows shell。

如果 5173 已被占用，Vite 会直接失败，避免 Electron 误连到旧服务或其它端口。

本地 production 运行：

```bash
pnpm desktop:start
```

## Packaging

生成当前平台的目录包（用于检查 asar 内容和直接启动）：

```bash
pnpm desktop:pack
```

在 Apple Silicon Mac 构建 arm64 `.app`、`.dmg` 与 `.zip`：

```bash
pnpm desktop:dist:mac
```

Windows x64 NSIS `.exe` 必须在 Windows runner/机器构建，不会在 macOS 上通过 Wine 交叉打包：

```powershell
pnpm desktop:dist:win
```

GitHub Actions 的 `Desktop packaging artifacts` workflow 仅手动触发，上传 macOS arm64 与 Windows x64 构建产物，不创建或覆盖 GitHub Release。macOS job 会核验 runner 实际架构。

appId 固定为 `io.github.timvan1596.wanguoji`，userData 固定在系统 appData 下的 `Wanguoji` 目录；安装版 IndexedDB 因而跨重启和同 appId 更新使用稳定 Electron profile。开发环境旧 IndexedDB 不迁移。

当前图标是临时打包图标，源文件为 `build/icon.svg`，后续待正式品牌图标替换。无证书时允许 unsigned 本地产物；macOS Gatekeeper 可能阻止首次打开，需要用户在系统设置中确认。可通过 `CSC_LINK` / `CSC_KEY_PASSWORD` 配置签名；Apple notarization 可选用 Apple API key 或 Apple ID 凭据。Windows Authenticode 同样读取 electron-builder 环境变量。证书与密码只能放在本机安全环境或 GitHub Secrets，禁止提交到仓库。

本版未配置自动发布或自动更新。CSP 仅注入 Desktop production build，Web build 与 Vite development/HMR 不受影响；生产脚本策略不含 `unsafe-eval`，Emotion inline style 仅使用必要的 `style-src 'unsafe-inline'`。BrowserWindow 开启 sandbox，拒绝新窗口和非应用导航。

打包后的 userData 持久性、替换升级和 endurance 仍需人工验收；Windows artifact 生成不等于 Windows 实机验证。

## Development Target Policy

1. Gameplay source 保持单一 React + Phaser codebase。
2. Desktop 是 long-run、background execution 与 persistence 的 primary runtime / 主要长期人工验收环境。
3. Web production build 必须持续通过 `pnpm build`；Web 继续服务 public demo 与兼容性目标。
4. 不维护 Desktop gameplay fork，也不让 Desktop 引入第二套 simulation authority。

## 已知诊断项 / 后续安全工作

- Packaged Electron production 使用受限 CSP；若 Console 仍出现 CSP 警告或资源阻止，应作为打包验收 blocker 回传，不要通过 `unsafe-eval` / wildcard 放宽策略。
- Canvas `willReadFrequently` 提示目前仅作为性能诊断信息，不在本轮改动 renderer。

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
  - `BrowserWindow.webPreferences.backgroundThrottling = false`，awake 状态下继续 timers、animation loop、SimulationDriver 和 Phaser Arcade Physics。
  - 普通最小化/失焦不是 OS suspend；debug diagnostics 分别显示窗口最小化计数、OS suspend 计数，以及 catch-up source。只有真实 OS suspend 的恢复才使用 `DESKTOP_OS_RESUME` 补算来源。
  - Desktop 设置中的“系统休眠期间”默认是“暂停，并在唤醒后等待继续（推荐）”：睡眠时间不进入模拟时间；若休眠前正在运行，唤醒后自动暂停并提示手动继续，原选中速度保留；原本已暂停则继续保持暂停。可选“唤醒后补算离线时间”，仍受 catch-up 安全上限约束。两种策略都不改变普通最小化行为。
  - Electron 每 5 个现实分钟更新 `current` Recovery 恢复档，关闭窗口前也只保存该槽。游戏时间每跨越 200 年边界时，另写入 `autosave-1/2` 双槽轮换自动档；手动档使用独立 UUID 槽位。
  - OS suspend / resume 的 CATCH_UP 策略使用显式恢复补算，最多按现有 2 小时 real-time cap 补算。
  - 每 5 分钟由 main process 请求 renderer 复用 IndexedDB 手动保存 workflow 自动保存；关闭窗口时先保存，失败或超时则取消关闭。
  - 应用使用 single-instance lock，第二实例会将已有窗口恢复并置前。

## Future

- “模拟运行时保持电脑唤醒”只作为未来可选项；必须由用户明确 opt-in，不默认阻止系统睡眠。

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

- Minimize / unfocus / occlusion：Desktop continuous runtime 的预期行为。
- `BrowserWindow.hide()`：不是本实验 P0；如果测试，请单独记录。
- Close：关闭前等待一次安全保存；失败或 10 秒超时会取消退出。本版不实现 close-to-tray。
- System sleep / hibernate：不阻止系统睡眠；恢复后按挂起前运行/暂停状态补算，并显示是否触及 2 小时上限。

## Security defaults

BrowserWindow 使用：

- `nodeIntegration: false`
- `contextIsolation: true`
- `webSecurity: true`
- `backgroundThrottling: false`
- `sandbox: true`

Preload 在 sandbox 下只通过 `contextBridge` 暴露受限的 heartbeat、autosave、close、resume 与 diagnostics IPC 方法；listener 返回 unsubscribe。Renderer 不获得 `require`、原始 `ipcRenderer` 或文件系统访问。
