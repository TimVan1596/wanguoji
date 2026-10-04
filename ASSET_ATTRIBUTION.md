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

## Ambient Music I candidates (not bundled)

These OpenGameArt pages were inspected for the page-listed author, track title, and CC0 designation. Audio binaries could not be retrieved in the current restricted-network environment, and the candidates have not been auditioned or assigned to an in-game mood. No candidate is currently referenced by the runtime track catalog.

| Track | Author | Source | License shown on source page | Bundled file | Notes |
| --- | --- | --- | --- | --- | --- |
| Asianoriental1 | Tozan | https://opengameart.org/content/asianoriental1 | CC0 | None | Page describes koto, shakuhachi, and ensemble strings; pending retrieval and audition. |
| Asianoriental2 | Tozan | https://opengameart.org/content/asianoriental2 | CC0 | None | Page describes a Chinese-style koto/strings piece; pending retrieval and audition. |
| Menu Music | wipics | https://opengameart.org/content/menu-music-2 | CC0; page copyright notice says Public Domain | None | Page tags include erhu, traditional, ancient, and loop; pending retrieval and audition. |

Retrieval/source note (2026-10-04): the OpenGameArt pages exposed their audio file links and license labels, but the web reader rejected audio MIME responses and direct repository-network access could not resolve `opengameart.org`. No placeholder or synthetic audio has been created.

The repository currently includes an MIT `LICENSE` copyright notice for KeJun (2023). The codebase and NOTICE identify Wanguoji as derived from `KeJunMao/open-block-war`, originally MIT licensed. Asset-level provenance still needs manual verification before Public Alpha promotion.
