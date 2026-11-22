# Handoff: Field Guide v2

Notes for continuing work (by a person or a new Claude Code session) inside the dev container.

## Where things stand
- **v1 is live**: website with round helper, shop advisor and builder, secret shop finder and wiki. Currently on GitHub Pages: https://minetech13.github.io/repo-field-guide/
- **v2 plan** (approved): a hybrid website plus an *optional* companion mod. Phases:
  0. **Dev container**: this folder's `.devcontainer/`. ✅
  1. **Check site data against the game**: decompile `/game/Managed/Assembly-CSharp.dll` with `ilspycmd` (`ShopManager`, `StatsManager`, `LevelGenerator.EnemySetup`, `EnemyDirector`, `ItemAttributes`, the `ItemUpgrade*` classes). Add the missing **Throw** upgrade, the real price formula, stock rules and the spawn curve. Decompiled output stays out of the repo.
  2. **Website redesign**: Round page "Focus view" (compact bar, threat card with top 3, monster chips with type-ahead add, collapsible sections). Shop advisor with a preference profile (playstyle preset, per-upgrade nudge −2..+2, pin/ban, upgrades↔gear slider), a per-copy shelf (cheapest copy first), and a team split.
  3. **Live link + copy code**: `src/live/` (GameState v1 schema). Opt-in polling of `http://127.0.0.1:47380/state`, an `RFG1:` paste code, and `scripts/mock-game.mjs` for testing.
  4. **Companion mod** in `mod/` (BepInEx 5, netstandard2.1): seen monsters via `EnemyOnScreen.OnScreenLocal`, a shop reader, teammates' upgrades, a read-only 127.0.0.1 server, an F8 copy code, an F7 IMGUI panel, and an opt-in data dump. CI builds it against NuGet `R.E.P.O.GameLibs.Steam`.
  5. **Hosting + releases**: move the site to Cloudflare Pages at **repoguide.pages.dev** (the owner connects it in the Cloudflare dashboard). Turn the GitHub Pages URL into a redirect that keeps the `#/route`. Add a `release.yml` that builds a GitHub Release with the mod zip on `v*` tags.

## Hard rules
- **The mod is 100% optional.** Every site feature works with manual entry. The site never contacts localhost unless the user turns on "Connect to game". The mod only reads, is client-side only, and doesn't need the website.
- Never commit game files or decompiled code.
- Ask before pushing, tagging or publishing anything.

## Useful commands
```bash
npm run check                   # validate data + tests + type-check + build
npm run dev                     # website on :5173
ilspycmd -t ShopManager /game/Managed/Assembly-CSharp.dll
```
