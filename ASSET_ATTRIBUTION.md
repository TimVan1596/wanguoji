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

The repository currently includes an MIT `LICENSE` copyright notice for KeJun (2023). The codebase and NOTICE identify Wanguoji as derived from `KeJunMao/open-block-war`, originally MIT licensed. Asset-level provenance still needs manual verification before Public Alpha promotion.
