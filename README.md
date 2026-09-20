# 万国纪 · Wanguoji

**一个会自己书写历史的架空世界沙盘。**

你不控制任何国家。

世界会自行战争、扩张、建城、亡国、复国；义军可能建立新的国家，诸侯可能称王，强权可能称帝建立王朝，而王朝也可能衰落、分裂和再次统一。

城市、政权、君主、王朝与时代，都会留下可以回看的历史。

[English](README_EN.md)

在线试玩：即将开放

<!-- Demo GIF placeholder: docs/media/wanguoji-demo.gif -->

## 30 秒怎么玩

《万国纪》不是传统的“选择一个国家然后微操”的策略游戏。

它是自主运行的观察型历史沙盘。

1. 选择一个世界场景。
2. 点击开始，让诸国自行发展。
3. 使用 1× / 2× / 4× 调节时间。
4. 点击国家、城市和君主查看其状态与历史。
5. 打开历史卷轴，观察争霸、统一、分裂和复国。

建议第一次至少观察 50～100 年。

## 核心特色

- 自动领土战争与扩张。
- 城市、围城、城市易主与首都迁移。
- 建城与历史城市档案。
- 叛乱与义军势力。
- `REBEL -> STATE` 的政权形成。
- 亡国、流亡、残部与复国。
- `KING` / `EMPEROR` 王权与帝权。
- Dynasty、王室继承与复辟。
- ruler chronicle 君主传记与统治摘要。
- temple / posthumous names：庙号与谥号。
- WorldEra：长期天下时代与格局章节。
- HistoryScroll：可回看的历史卷轴。
- faction archive：灭亡、流亡、复国政权档案。
- Web Background Progression：浏览器 tab 切回前台后按真实离开时间补算历史。
- Experimental Electron Desktop：桌面后台连续运行可行性实验。

## 当前 Alpha 状态

当前版本是 Public Alpha 发布候选。

已经存在：

- Web 版核心玩法。
- 城市、王朝、政权生命周期和历史卷轴。
- Chrome Web Background Progression return-time catch-up。
- Electron Desktop Experimental probe。

不会在本 Alpha 中承诺：

- 完整 Save / Continue World。
- deterministic seed / replay。
- 经济系统。
- 外交系统。
- 科技树。
- 完整桌面安装包、签名或自动更新。

## 在线试玩

在线试玩：即将开放

当前 Web 应用是 Vite 静态应用，可以部署到任意静态托管服务。CloudBase 部署说明见 [docs/DEPLOY_CLOUDBASE.md](./docs/DEPLOY_CLOUDBASE.md)。

## 本地运行

推荐环境：

- Node.js 20 LTS（Node 18+ 应可运行；当前本机和 CI 使用 Node 20）。
- pnpm 8.x（项目当前 `packageManager` 为 `pnpm@8.5.1`）。
- Chrome / Edge 等现代 Chromium 浏览器。

```bash
pnpm install
pnpm dev
```

浏览器打开：

```text
http://localhost:5173/
```

## Build

```bash
pnpm test
pnpm build
```

生产构建产物输出到 `dist/`。

## Web Background Progression

普通浏览器模式使用 `WEB_CATCH_UP` 策略。

当 Chrome tab 被切到后台时，《万国纪》不试图强迫浏览器持续 30Hz 渲染。页面回到前台后，系统会根据真实离开时间、暂停状态和 1× / 2× / 4× 速度，把欠下的时间转换为同一套 authoritative Phaser Arcade Physics + SimulationDriver fixed steps，并分块追赶。

这不是只快进 `worldMonth`。城市围攻、领土变化、死亡、继承、建国、称帝、WorldEra 和 HistoryScroll 都通过真实模拟路径推进。

关闭或刷新页面后不会继续当前世界，因为完整 Save / Continue World 尚未实现。

## Electron Desktop Experimental

v0.9995 增加了一个独立 Electron probe，目录见 [desktop/](./desktop/)。

```bash
pnpm desktop:dev
```

Electron renderer 直接加载当前 React + Phaser frontend，不复制 gameplay 源码。Desktop 模式使用 `DESKTOP_CONTINUOUS` 策略，并禁用 Web return-time catch-up debt，用来验证窗口最小化 / 失焦后是否能真正持续运行 simulation。

更多说明见 [desktop/README.md](./desktop/README.md)。

## 当前 Known Issues

- 尚无完整 Save / Continue World。
- 刷新或关闭页面会失去当前完整世界。
- 尚无完整 deterministic seed / replay。
- Web Background Progression 是 return-time catch-up，不是 hidden tab 持续渲染。
- Electron Desktop 仍为 Experimental。
- Electron continuous background 尚未完成用户最终验证。
- Electron 在中国大陆网络下下载 binary 可能需要镜像，例如 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
- long-run balance 仍持续调整。
- Vite build 目前会出现 large chunk warning，但不是构建失败。

## 技术栈

- React 18
- Phaser 3.55 Arcade Physics
- Redux Toolkit
- Vite
- TypeScript
- Vitest
- Electron（experimental desktop probe）

## 项目来源 / Credits

《万国纪 · Wanguoji》源自 [KeJunMao/open-block-war](https://github.com/KeJunMao/open-block-war)，原项目使用 MIT License。

《万国纪 · Wanguoji》在此基础上加入了大量新的 autonomous simulation、city systems、faction lifecycle、dynasties、rulers、historical archives、WorldEra、background progression 和 desktop experimentation 工作。详见 [NOTICE.md](./NOTICE.md)。

资产来源和待确认项见 [ASSET_ATTRIBUTION.md](./ASSET_ATTRIBUTION.md)。

## License

MIT License。详见 [LICENSE](./LICENSE)。

原始版权声明保留在 LICENSE 中。

## Contributing

欢迎 issue、bug report、长局 balance feedback 和小型 PR。

请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。
