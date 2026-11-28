# Handoff: Field Guide v2

Notes for continuing work (by a person or a new Claude Code session) inside the dev container.

## Where things stand (2026-11-28)
- **Site**: Cloudflare Pages at https://repo-field-guide.pages.dev. The old GitHub Pages URL redirects there.
- **Branch `live-companion`** holds the second-screen companion work and isn't merged into `main` yet. Preview: https://live-companion.repo-field-guide.pages.dev/#/live
  - Live page: minimap (fills its box, Near/Mid/Far/All), threat, monsters met, extraction planner, Find with walking routes, team status, demo and replay.
  - **Map pieces** (`DirtFinderMapFloor`/`Wall`, checked on real dumps from Museum, Swiftbroom and Manor):
    - Floors are squares (1, 0.5 or 0.25 tiles) anchored at a corner, extending along local +X and +Z.
    - Walls start at their pivot and run along local +X.
  - **Routes** (`src/engine/pathfind.ts`): 1.25 m cells per map layer.
    - **Stairs**: the map's "Stairs" wall pieces each climb one storey along their forward axis. They're chained together, and L-shaped staircases work.
    - **Unmarked floor changes**: links between layers that meet edge to edge without overlapping.
    - **Partial routes**: when the way isn't explored, the route goes to the closest explored spot.
  - **Spectating** (you're dead): the fog relaxes to what the team can see. The map centres on the player you're watching, and your own head is shown.
- **Companion mod v0.3.2** (`mod/dist/`, not in git):
  - The map re-scans until the rooms have spawned.
  - Extractions count as found when they're in an explored room.
  - Map pieces are sent to 5 cm.
  - Debug recorder: one file per level, with a level dump rewritten once the rooms exist.
- **Recordings** from real runs: `/r2modman/profiles/Merged/BepInEx/config/RepoFieldGuide/recordings/` (pruned to the newest 20). Copies of the useful ones (Museum, Swiftbroom, Manor, Sunstone level dumps and layouts, one shop visit) are in `.recordings/` (git-ignored: they contain player names).

## Open
- **Test in game:**
  - Mod 0.3.2.
  - Spectating mode.
  - Stair and ramp routes on more maps. Swiftbroom has no stair pieces at all.
- **The "72K left" report in the shop:** couldn't be reproduced. The recording shows surplus 73 and a $72K basket, and the advisor's math is consistent. Ask the owner which screen showed it.
- **Merge `live-companion` into `main`** once the owner is happy (ask first).
- **Not done yet:**
  - `release.yml`: a `v*` tag makes a GitHub Release with the mod zip.
  - A CI build of the mod.
  - Help-level preset, MenuLib page, Canvas HUD, REPOLib teammate sharing.

## Hard rules
- **The mod is 100% optional.** Every site feature works with manual entry. The site never contacts localhost unless the user turns on "Connect to game". The mod only reads, is client-side only, and doesn't need the website.
- **Fair info only**:
  - Show only what's been discovered: explored rooms, discovered valuables, found heads, monsters seen on screen, pings, and what the Tab map shows.
  - A ping without Ping Info is only a spot on the map.
  - While spectating, show what the team can see.
- Never commit game files or decompiled code.
- **Pushing:** push feature branches like `live-companion` directly. Ask before pushing to `main`, merging, tagging or publishing.
- Each mod build gets a new version number.

## Useful commands
```bash
npm run check                   # validate data + tests + type-check + build
npm run dev                     # website on :5173
cd mod && bash pack.sh          # build the companion zip into mod/dist/
node scripts/mock-game.mjs --replay <file.jsonl>   # replay a recording as a fake game
ilspycmd -t ShopManager /game/Managed/Assembly-CSharp.dll
```
