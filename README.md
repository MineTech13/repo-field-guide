# R.E.P.O. Field Guide

An unofficial, interactive helper for **R.E.P.O.** Keep it open on a second screen or your phone while you play.

- **Round helper**: pick the map and level, tap the monsters you've seen or heard, and get live advice: a threat meter, the rules that matter right now, dangerous combos (like Huntsman + Banger), map hazards for your level, and a spawn check showing which tiers are still unaccounted for.
- **Round memory (optional)**: log team status, quota progress and gear. The advice adapts, for example "quota met, extract now" or "you have a tranq gun, so you can fight this".
- **Shop advisor**: enter your surplus, team size and what's on the shelf to get a ranked shopping list that fits your budget, with the reasoning for each pick.
- **Loadout builder**: plan upgrades and gear, see the cost, stat boosts and which tier-3 monsters you can counter, and share builds by link.
- **Shop tips & tricks**: the upgrade pool trick, price rolls, Tax Token rerolls, and more.
- **Secret shop finder**: tap what you see in the station to find the hidden entrance for your layout.
- **Wiki**: searchable entries for all 30 monsters (incl. the v0.3.0 Monster Update and the v0.5.0 Pony), 5 maps, ~50 items and upgrades, and the spawn and respawn tables.

Built with Vite, TypeScript and Preact. No backend: everything runs in the browser, and your round is saved in `localStorage`.

## Run it locally

Needs Node 20+ (22 recommended, see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run validate` | Checks every JSON data file (ids, references, required fields) |
| `npm test` | Unit tests for the advice, spawn and shop engines |
| `npm run build` | Type-check and build to `dist/` |
| `npm run check` | All of the above |
| `npm run preview` | Serve the built `dist/` |

## Deploy

The build uses relative paths and hash routing (`#/shop`), so the same `dist/` works at a domain root or under a sub-path with no redirect rules.

### Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, then pick the repo.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable (optional): `VITE_REPO_URL` = `https://github.com/<you>/<repo>`. This turns on the "Contribute / Edit on GitHub" links.
   - Cloudflare reads the Node version from `.nvmrc`.
4. Deploy. Every push to `main` redeploys, and pull requests get preview URLs.

`public/_headers` sets long cache headers for hashed assets.

### GitHub Pages (optional)

`.github/workflows/pages.yml` builds and deploys on every push to `main`. Turn it on in **Settings → Pages → Source: GitHub Actions**. If you only use Cloudflare, you can delete that file.

## Project layout

```
src/
  data/            ← all game info lives here (edit these to contribute)
    monsters.json  maps.json  items.json  shop.json  spawns.json  sources.json
  engine/          ← pure logic, unit-tested
    advise.ts      round advice + threat score
    rules/         combos, level phases, optional-memory modifiers
    spawns.ts      spawn table check, respawn timers
    shop.ts        shop advisor, loadout builder, share links
  components/      ← Preact UI
  state/round.ts   round state + localStorage
tests/             ← vitest: engine tests + data validation
```

## Contributing

Spotted wrong or outdated info? See [CONTRIBUTING.md](CONTRIBUTING.md). Most fixes are a small JSON edit.

## Data & accuracy

The game is in Early Access and changes often. Info comes from community guides, cited per entry in `src/data/sources.json` and shown on the site. Where sources disagree, the entry says so. Shaky entries are marked *unconfirmed*. The threat score, level phases and shop priorities are this project's own heuristics, not game data.

## Disclaimer

Fan-made and not affiliated with or endorsed by semiwork. R.E.P.O. and related names belong to their respective owners. This project uses no game assets.

## License

[MIT](LICENSE)
