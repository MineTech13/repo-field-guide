# R.E.P.O. Field Guide Companion

An **optional**, **read-only**, **client-side** companion for the [R.E.P.O. Field Guide](https://repo-field-guide.pages.dev) website. It fills the guide in for you, so you don't have to type anything.

- **Monsters you've met:** a monster is recorded once it has been on *your* screen or has spotted *you*. Monsters you haven't met are never revealed.
- **Shop reader:** in the Service Station it reads every copy on the shelf with its real price, your surplus, and everyone's upgrades.
- **Respawn timers:** the real time until a monster you've met comes back.
- **Live link:** the website gets the data from your own PC as a live stream (`http://127.0.0.1:47380/events`, updates only when something changes; `/state` for a one-off read). Nothing leaves your computer, and only the guide's address may read it.
- **Copy code:** press **Ctrl+F10** and paste the code into the website.

It never changes gameplay. Teammates don't need it, and players who don't have it see no difference.

## Hotkeys
| Key | Action |
|---|---|
| F10 | Show or hide the companion panel |
| Ctrl+F10 | Copy a game code for the website |
| Ctrl+Shift+F10 | Write a data dump (items, prices, monsters, spawn curves) to `BepInEx/config/RepoFieldGuide.dump.json` |

All keys can be changed under **[Keys]** in the config or in-game with REPOConfig, in case another mod uses the same ones.

Every feature can be switched off in the config, or in-game with REPOConfig.

Unofficial fan project, not affiliated with semiwork.
