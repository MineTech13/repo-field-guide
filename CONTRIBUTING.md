# Contributing

Thanks for helping keep the guide accurate. The game changes a lot, so corrections are the most valuable thing you can send.

## Fixing or adding game info

All game info is in `src/data/`:

| File | What's in it |
|---|---|
| `monsters.json` | One entry per monster: tier, threat, detection, tells, do/don't, counters, orb value |
| `maps.json` | Map hazards per phase (early / mid / late) and tips |
| `items.json` | Gear *categories* used by the round helper (tranq, firearm, mine, …) |
| `shop.json` | Upgrades, shop items with prices, shop tips, secret shop layouts |
| `spawns.json` | Monsters-per-level table, group swaps, respawn timers |
| `sources.json` | Every source the data cites |

Rules of thumb:

- **Cite a source.** Add it to `sources.json` and reference its key. Patch notes, a wiki, or a guide all work. "I tested it" is fine for a `note`, but say so.
- **Disagreements go in `notes`.** If sources conflict, mention both and set `"verified": false` if it really matters.
- **Keep text short and actionable.** `golden` is the single most important rule, shown first. Write it like a teammate yelling in voice chat.
- **`aliases` vs `nicknames`.** `aliases` are alternate names that appear in guides or older versions (shown as "aka"). `nicknames` are short callouts players use in voice chat ("ceiling eye", "shotgun guy"). Both are searchable, and the same name can't belong to two monsters.
- **Monster tags drive the combo warnings.** See the comment on `MonsterTag` in `src/data/types.ts`.

Then run:

```bash
npm run validate   # catches typos, bad ids, missing fields
npm test
```

## Adding a combo warning

Combos live in `src/engine/rules/combos.ts`. Each rule has a `test(ctx)` and a `text(ctx)`. Add a test case in `tests/advise.test.ts`.

## Code changes

`npm run check` must pass (validate, test, type-check, build). Keep the engine (`src/engine`) pure and free of UI code so it stays easy to test.
