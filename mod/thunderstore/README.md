# R.E.P.O. Field Guide Companion

An **optional**, **read-only**, **client-side** companion for the [R.E.P.O. Field Guide](https://repoguide.pages.dev) website. It fills the guide in for you, so you don't have to type anything.

- **Monsters you've met:** a monster is recorded once it has been on *your* screen or has spotted *you*. Monsters you haven't met are never revealed.
- **Shop reader:** in the Service Station it reads every copy on the shelf with its real price, your surplus, and everyone's upgrades.
- **Respawn timers:** the real time until a monster you've met comes back.
- **Live link:** the website reads the data from `http://127.0.0.1:47380/state` on your own PC. Nothing leaves your computer, and only the guide's address may read it.
- **Copy code:** press **F8** and paste the code into the website.

It never changes gameplay. Teammates don't need it, and players who don't have it see no difference.

## Hotkeys
| Key | Action |
|---|---|
| F7 | Show or hide the companion panel |
| F8 | Copy a game code for the website |
| F9 | Write a data dump (items, prices, monsters, spawn curves) to `BepInEx/config/RepoFieldGuide.dump.json` |

Every feature can be switched off in the config, or in-game with REPOConfig.

Unofficial fan project, not affiliated with semiwork.
