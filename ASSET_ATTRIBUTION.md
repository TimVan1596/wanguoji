# Asset Attribution Inventory

This inventory records assets visible in the current repository. It does not replace a legal review before public release.

Repository history checked with `git log --follow --name-status`.

| Path | Source observed in this repository | From open-block-war? | Known license | Status |
| --- | --- | --- | --- | --- |
| `public/img/no-face.svg` | Added in commit `01e73e1` when the project was renamed to its previous development name and local danmaku support was added. | Not confirmed from local history. | NEEDS VERIFICATION | NEEDS VERIFICATION |
| `public/img/star.png` | Present since initial commit `2101667`. | Likely inherited, but not proven by local history alone. | NEEDS VERIFICATION | NEEDS VERIFICATION |
| `public/theme/minecraft/font.ttf` | Present since initial commit `2101667`. | Likely inherited, but not proven by local history alone. | NEEDS VERIFICATION | NEEDS VERIFICATION |
| `assets/war3.png` | Present since initial commit `2101667`. | Likely inherited, but not proven by local history alone. | NEEDS VERIFICATION | NEEDS VERIFICATION |
| `assets/7guo.png` | Present since initial commit `2101667`. | Likely inherited, but not proven by local history alone. | NEEDS VERIFICATION | NEEDS VERIFICATION |
| `assets/default.png` | Present since initial commit `2101667`. | Likely inherited, but not proven by local history alone. | NEEDS VERIFICATION | NEEDS VERIFICATION |

## Recursive audit notes

The following directories were also checked. The repository does not contain enough provenance to assign a license to these assets:

| Path | Contents observed | Classification | Status |
| --- | --- | --- | --- |
| `public/theme/war3/` | Halls, units / NPCs, icons and terrain tiles with Warcraft III-style naming and presentation. | May be derived from a third-party commercial work; human verification required. | NEEDS VERIFICATION |
| `public/theme/minecraft/` | Font, icons and terrain tiles with Minecraft-style naming and presentation. | Source and redistribution permission cannot be confirmed from local history. | NEEDS VERIFICATION |
| `assets/` | `7guo.png`, `war3.png`, `default.png` scenario / theme images. | Source and license cannot be confirmed from local history. | NEEDS VERIFICATION |

This is a provenance warning, not a claim of infringement. Before wider promotion, verify or replace the `public/theme/war3/` and `public/theme/minecraft/` resource sets, the bundled font, and the files listed above.

## Ambient Music I — Alpha soundtrack candidates

All listed audio remains physically in `public/music/`. Catalog status reflects the user's audition: active tracks are provisional Alpha candidates, not a final OST; reserve tracks are not currently played; rejected tracks are retained for provenance and are not in the runtime catalog.

| Track | Author | Source | License shown on source page | Current file / bundle status | Catalog status | Notes |
| --- | --- | --- | --- | --- | --- |
| Menu Music | wipics | https://opengameart.org/content/menu-music-2 | CC0; page copyright notice says Public Domain | Not bundled (removed; former path `public/music/menu.mp3`) | REJECTED | User found the ~22-second piece too cheerful/comical for the game. |
| Shangri River | Tozan | https://opengameart.org/content/shangri-river | CC0 | Not bundled (removed; former path `public/music/Shangririver.ogg`) | REJECTED | User found it too subdued and lacking a memorable melody. |
| Asianoriental1 | Tozan | https://opengameart.org/content/asianoriental1 | CC0 | `public/music/asianoriental1.ogg` | ACTIVE — ORDER (supporting) | Koto, shakuhachi, and ensemble strings per source description; user considers it fitting but subdued. |
| Asianoriental2 | Tozan | https://opengameart.org/content/asianoriental2 | CC0 | `public/music/asianoriental2.ogg` | ACTIVE — PEACE (pending final audition) | Chinese-style koto/strings per source description; retain its current assignment pending the user's final listening report. |
| Tyhosiasian | Tozan | https://opengameart.org/content/tyhosiasian | CC0 | Not bundled (removed; former path `public/music/tyhosiasian.ogg`) | REJECTED | User auditioned and rejected this track. |
| Ninja Theme | Spring Spring | https://opengameart.org/content/ninja-theme | CC0 | `public/music/ninja theme.ogg` | ACTIVE — TENSION | User found it catchy, memorable, and suitably forceful for TENSION. |
| Treasure Hunter | TAD | https://opengameart.org/content/treasure-hunter | CC0 | `public/music/treasure_hunter.mp3` | ACTIVE — ORDER (primary) | User found it positive, prosperous, and melodic. |
| Hot Springs Town | Kistol | https://opengameart.org/content/hot-springs-town | CC0 | Not bundled (removed; former path `public/music/hot_spring_town.mp3`) | REJECTED | User found its pastoral feel and weak melody unsuitable. Local filename differs slightly from the page title. |
| Night Shift | iamoneabe | https://opengameart.org/content/night-shift | CC0 | `dev-assets/music-candidates/nightshift.mp3` (dev-only; not bundled) | RESERVE — inactive | User found it very tense and severe; it may be reconsidered only if a separate context is designed later. |

Retrieval/source note (2026-10-04): local files and filenames in `public/music/` were checked. Source-page title, author, file association, and license were checked against the corresponding OpenGameArt listings. The files were supplied locally; this change did not download, convert, or modify audio. All tracks remain Alpha candidates subject to manual audition, not final OST selections.

The repository currently includes an MIT `LICENSE` copyright notice for KeJun (2023). The codebase and NOTICE identify Wanguoji as derived from `KeJunMao/open-block-war`, originally MIT licensed. Asset-level provenance still needs manual verification before Public Alpha promotion.
