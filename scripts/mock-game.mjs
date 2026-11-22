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
const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?repo-field-guide\.pages\.dev$/, /^https:\/\/minetech13\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
const args = process.argv.slice(2);
const fixed = args.find((a) => ['level', 'shop', 'lobbyMenu', 'mainMenu', 'lobby', 'arena'].includes(a));
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
    playerCount: 3,
    owned: { 'Item Gun Tranq': 1, 'Item Grenade Explosive': 2 },
    me: { dead: false, health: Math.max(20, 100 - Math.round(t * 3)), maxHealth: 100 },
    team: [
      { name: 'You', isLocal: true, dead: false },
      { name: 'Alex', dead: false },
      ...(t > 15 ? [{ name: 'Sam', dead: true, head: [6, 0, 22], headIn: t > 25 ? 'truck' : undefined }] : [{ name: 'Sam', dead: false }]),
    ],
    layout: mockLayout(t),
  };
};

// A small two-floor level: rooms grow as you "explore".
function mockLayout(t) {
  const rooms = [
    [0, 0, 0, 12, 4, 10],
    [0, 0, 12, 6, 4, 14],
    [10, 0, 22, 14, 4, 8],
    [-10, 0, 20, 10, 4, 10],
    [-12, 4.5, 4, 10, 4, 12],
    [18, 0, 8, 8, 4, 14],
    [26, 0, 26, 10, 4, 10],
  ].slice(0, 3 + Math.min(4, Math.floor(t / 4)));
  const meZ = Math.min(24, t * 1.2);
  return {
    me: [Math.sin(t / 3) * 3, 0, meZ],
    yaw: Math.round((t * 25) % 360),
    truck: [0, 0, -6],
    rooms,
    extraction: {
      goalPerPoint: 6000,
      total: 3,
      completed: 1,
      points: [
        { at: [0, 0, -2], state: 'Complete', current: false },
        { at: [12, 0, 24], state: 'Active', current: true },
        ...(t > 10 ? [{ at: [-12, 4.5, 6], state: 'Idle', current: false }] : []),
      ],
    },
    valuables: [
      { name: 'Diamond', value: 4200, at: [-8, 0, 18], size: 'Tiny' },
      { name: 'Grandfather Clock', value: 8800, at: [6, 0, 14], size: 'VeryTall' },
      { name: 'Vase', value: 1300, at: [14, 0, 20], size: 'Small' },
      { name: 'Piano', value: 11200, at: [-14, 4.5, 2], size: 'Wide' },
      { name: 'Painting', value: 2500, at: [11, 0, 25], size: 'Medium', inHaul: true },
      ...(t > 8 ? [{ name: 'Golden Statue', value: 6300, at: [18, 0, 6], size: 'Big' }] : []),
    ],
    monsters: [
      { key: 'ENEMY.HUNTER', name: 'Huntsman', at: [16, 0, 10], agoSec: Math.round(t), killed: false },
      ...(t > 6 ? [{ key: 'ENEMY.BANG', name: 'Banger', at: [-6, 0, 22], agoSec: Math.round(t - 6), killed: t > 12 }] : []),
    ],
  };
}

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
    { item: 'Item Upgrade Player Grab Strength', name: 'Strength Upgrade', type: 'item_upgrade', priceK: 7, haggle: 'Rejected', shown: 1 },
  ],
  basket: [{ item: 'Item Health Pack Medium', priceK: 7 }],
  basketTotalK: 7,
  shopkeeper: { attemptsUsed: 1, attemptsLeft: 2 },
  owned: { 'Item Melee Frying Pan': 1, 'Item Upgrade Player Energy': 1, 'Item Femboy Knife': 1 },
  catalog: [{ item: 'Item Femboy Rifle', name: 'Femboy Rifle', type: 'gun', priceK: [20, 30], maxInShop: 1 }],
  players: level().players,
});

const state = () => {
  if (fixed === 'level') return level();
  if (fixed === 'shop') return shop();
  if (fixed) return { v: 1, mod: 'mock', phase: fixed, playerCount: 3, levelsCompleted: 2, surplusK: 12 };
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
