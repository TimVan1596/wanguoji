# 万国纪 · Wanguoji CloudBase 部署说明

万国纪 · Wanguoji Web 版是 Vite 静态应用。部署不需要 Node server。

当前公开试玩地址是 CloudBase Public Alpha deployment。该地址适合开发与 Public Alpha 测试，不应描述为 production-ready、stable service 或 permanent hosting。

## A. 本地 build 后上传 dist/

```bash
pnpm build
```

构建产物在：

```text
dist/
```

将 `dist/` 构建产物作为静态站点上传到 CloudBase 静态托管即可。

## B. CloudBase CLI（可选）

```bash
npm i -g @cloudbase/cli
tcb login
pnpm install
pnpm test
pnpm build
tcb hosting deploy dist/ -e <ENV_ID>
```

不要把真实 Environment ID、腾讯云账户信息、兑换码或任何私密信息写入仓库。

## 路由 / SPA fallback

当前项目使用 Vite + React Router `BrowserRouter`。

- 部署到域名根路径时，首页 `/` 可直接工作。
- 如果用户直接访问子路由，静态托管需要把未知路径 fallback 到 `index.html`。

CloudBase 静态托管如需支持直接打开子路由，请在控制台或部署配置中添加 SPA fallback / rewrite：

```text
/* -> /index.html
```

如果只公开根路径在线试玩，第一版可以不额外改游戏逻辑。

## 注意

- 不要上传 `node_modules/`。
- 不要上传本地 `.env`。
- 不要把 Electron `desktop/dist/` 当作 Web 部署目录。
- 当前没有 Save / Continue World；刷新页面会重新开始当前世界。
- CloudBase 平台默认域名适合开发 / Public Alpha 测试；后续正式站点建议使用已备案的自定义域名。
