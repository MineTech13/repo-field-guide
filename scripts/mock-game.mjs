#!/usr/bin/env node
// Fake companion mod for testing the website without the game.
//   node scripts/mock-game.mjs            → cycles level → shop every 20 s
//   node scripts/mock-game.mjs level|shop → stays on one phase
//   add --no-stream to act like an older mod without the event stream
// Serves http://127.0.0.1:47381/state with the same CORS rules as the mod.
// To test the site against it, set the port to 47381 in the Game companion section.
import { createServer } from 'node:http';

// 47381, not 47380: the real companion mod owns 47380 on your PC.
const PORT = Number(process.env.PORT ?? 47381);
const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?repoguide\.pages\.dev$/, /^https:\/\/minetech13\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
const args = process.argv.slice(2);
const fixed = args.find((a) => a === 'level' || a === 'shop');
// --no-stream: behave like companion 0.1.x (no /events), to test the polling fallback.
const noStream = args.includes('--no-stream');
const start = Date.now();

const level = () => {
  const t = (Date.now() - start) / 1000;
  return {
    v: 1,
    mod: 'mock',
    phase: 'level',
    map: 'Museum of Human Art',
    levelsCompleted: 5,
    haul: { goal: 18000, current: Math.min(18000, Math.round(t * 400)), extractionPoints: 3, extractionPointsCompleted: 1 },
    surplusK: 42,
    seen: [
      { key: 'ENEMY.HUNTER', name: 'Huntsman', tier: 3, firstSeenAt: 12, onScreen: true, spottedYou: false, killed: false },
      ...(t > 6 ? [{ key: 'ENEMY.BANG', name: 'Banger', tier: 2, firstSeenAt: 40, onScreen: true, spottedYou: true, killed: t > 12, ...(t > 12 ? { respawnInSec: Math.max(0, 240 - (t - 12)) } : {}) }] : []),
      ...(t > 9 ? [{ key: 'ENEMY.FREDDY', name: 'Freddy', tier: 3, firstSeenAt: 55, onScreen: true }] : []),
    ],
    players: [
      { name: 'You', isLocal: true, upgrades: { Health: 2, Stamina: 3, Strength: 1 } },
      { name: 'Alex', isLocal: false, upgrades: { Strength: 3, Range: 1 } },
    ],
  };
};

const shop = () => ({
  v: 1,
  mod: 'mock',
  phase: 'shop',
  map: 'Service Station',
  levelsCompleted: 6,
  surplusK: 42,
  shelf: [
    { item: 'Item Upgrade Player Energy', name: 'Stamina Upgrade', type: 'item_upgrade', priceK: 6 },
    { item: 'Item Upgrade Player Energy', name: 'Stamina Upgrade', type: 'item_upgrade', priceK: 6 },
    { item: 'Item Upgrade Player Health', name: 'Health Upgrade', type: 'item_upgrade', priceK: 8 },
    { item: 'Item Gun Tranq', name: 'Tranq Gun', type: 'gun', priceK: 19 },
    { item: 'Item Health Pack Medium', name: 'Medium Health Pack', type: 'healthPack', priceK: 7 },
    { item: 'Item Femboy Rifle', name: 'Modded Rifle', type: 'gun', priceK: 25 },
  ],
  players: level().players,
});

const state = () => {
  if (fixed === 'level') return level();
  if (fixed === 'shop') return shop();
  return Math.floor((Date.now() - start) / 20000) % 2 === 0 ? level() : shop();
};

createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.some((r) => r.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.url?.startsWith('/events') && !noStream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    let last = '';
    const tick = () => {
      const json = JSON.stringify(state());
      if (json !== last) res.write(`data: ${(last = json)}\n\n`);
    };
    tick();
    const t = setInterval(tick, 500);
    req.on('close', () => clearInterval(t));
    return;
  }
  if (req.url?.startsWith('/state')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(state()));
  }
  res.writeHead(404).end('not found');
}).listen(PORT, '127.0.0.1', () => console.log(`mock companion on http://127.0.0.1:${PORT}/state (${fixed ?? 'cycling'}${noStream ? ', no stream' : ''})`));
