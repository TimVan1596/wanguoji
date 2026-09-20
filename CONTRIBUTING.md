# Contributing to Wanguoji

Wanguoji is a personal open-source sandbox project. Small, focused changes are preferred.

## Local setup

- Node.js: 18+ recommended.
- Package manager: pnpm 8.x (`package.json` currently pins `pnpm@8.5.1`).
- Recommended browser for manual checks: Chrome / Chromium.

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Development principles

- Keep gameplay balance frozen unless a version explicitly targets balance.
- Prefer reusing existing Phaser / simulation authority instead of replacing it with simplified logic.
- Run `pnpm test` and `pnpm build` before handing off.
- Treat long-run real Chrome testing as required for simulation lifecycle changes.
- Do not add save / seed / economy / diplomacy / technology systems as incidental changes.

## Current known limits

- Background progression is session-only return-time catch-up; refresh / close does not continue a world.
- Full world save / continue is not implemented.
- Stable seed / replay is not implemented.
- Some legacy names and live-stream-era folders remain from the original project lineage.
