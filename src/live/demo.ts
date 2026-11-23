import type { GameStateV1, LiveLayout, LivePing, Vec3 } from './schema';

/**
 * A made-up level for the "Try the demo" button: shows what the Live page does with the
 * companion mod, without the game. Built on the game's 5 m tile grid with doors and a
 * staircase, like a real level. Loops every DEMO_LOOP seconds. Nothing here is real data.
 */
export const DEMO_LOOP = 120;
const T = 5; // tile size (m)
const UP = 4.5; // height of the upper floor

// Rooms in tiles: [i0, j0, i1, j1) on a layer. Tile (i, j) covers x i*5..i*5+5, z j*5..j*5+5.
const ROOMS: { name: string; i0: number; j0: number; i1: number; j1: number; layer: number; truck?: boolean; stairs?: [number, number] }[] = [
  { name: 'Truck', i0: -1, j0: -2, i1: 1, j1: 0, layer: 0, truck: true },
  { name: 'Hall', i0: -1, j0: 0, i1: 1, j1: 5, layer: 0 },
  { name: 'East gallery', i0: 1, j0: 2, i1: 5, j1: 5, layer: 0 },
  { name: 'East wing', i0: 5, j0: 0, i1: 8, j1: 4, layer: 0 },
  { name: 'North-east', i0: 5, j0: 4, i1: 8, j1: 7, layer: 0 },
  { name: 'North hall', i0: -1, j0: 5, i1: 3, j1: 8, layer: 0 },
  { name: 'West gallery', i0: -5, j0: 2, i1: -1, j1: 6, layer: 0 },
  { name: 'Far west', i0: -8, j0: 4, i1: -5, j1: 7, layer: 0 },
  { name: 'Stair room', i0: -4, j0: -1, i1: -1, j1: 2, layer: 0, stairs: [-4, 0] },
  { name: 'Upstairs', i0: -5, j0: -1, i1: -1, j1: 2, layer: 1, stairs: [-4, 0] },
  { name: 'Upstairs west', i0: -8, j0: -1, i1: -5, j1: 2, layer: 1 },
];

const c = (i: number) => i * T + T / 2;

// Where "you" walk: seconds → position.
const PATH: [number, Vec3][] = [
  [0, [0, 0, -5]],
  [8, [0, 0, 12]],
  [16, [15, 0, 17]],
  [26, [32, 0, 10]],
  [34, [32, 0, 27]],
  [42, [15, 0, 20]],
  [50, [7, 0, 32]],
  [58, [0, 0, 20]],
  [66, [-15, 0, 20]],
  [74, [-32, 0, 27]],
  [82, [-12, 0, 15]],
  [88, [-2, 0, 4]],
  [92, [-12, 0, 2]],
  [96, [-17.5, 0, 2.5]],
  [99, [-17.5, UP, 2.5]],
  [106, [-33, UP, 2]],
  [112, [-15, UP, 2]],
  [115, [-17.5, UP, 2.5]],
  [117, [-17.5, 0, 2.5]],
  [120, [0, 0, -5]],
];

const EXTRACTIONS: { at: Vec3; doneAt?: number; activeFrom?: number }[] = [
  { at: [33, 0, 4], activeFrom: 0, doneAt: 45 }, // the game's first one
  { at: [5, 0, 36], activeFrom: 45 },
  { at: [-36, UP, 2], activeFrom: undefined },
  { at: [2, 0, 6] }, // closest to the truck
];

const VALUABLES: { name: string; value: number; at: Vec3; size: string; inHaulAt?: number }[] = [
  { name: 'Grandfather Clock', value: 8800, at: [10, 0, 21], size: 'VeryTall' },
  { name: 'Diamond', value: 4100, at: [20, 0, 14], size: 'Tiny' },
  { name: 'Golden Statue', value: 6300, at: [36, 0, 12], size: 'Big', inHaulAt: 40 },
  { name: 'Vase', value: 1300, at: [36, 0, 31], size: 'Small' },
  { name: 'Painting', value: 2500, at: [27, 0, 26], size: 'Medium' },
  { name: 'Music Box', value: 900, at: [12, 0, 34], size: 'Small' },
  { name: 'Piano', value: 11200, at: [-20, 0, 24], size: 'Wide' },
  { name: 'Ring', value: 700, at: [-36, 0, 32], size: 'Tiny' },
  { name: 'Chandelier', value: 5400, at: [-12, UP, 6], size: 'Wide' },
  { name: 'Teapot', value: 600, at: [-38, UP, -2], size: 'Small' },
  { name: 'Globe', value: 1800, at: [-3, 0, 14], size: 'Medium' },
];

const MONSTERS: { key: string; name: string; tier: number; at: Vec3; seenAt: number; killedAt?: number }[] = [
  { key: 'ENEMY.HUNTER', name: 'Huntsman', tier: 3, at: [37, 0, 26], seenAt: 33 },
  { key: 'ENEMY.BANG', name: 'Banger', tier: 2, at: [12, 0, 18], seenAt: 15, killedAt: 22 },
  { key: 'ENEMY.CEILING_EYE', name: 'Peeper', tier: 1, at: [-35, 0, 30], seenAt: 72 },
  { key: 'ENEMY.ROBE', name: 'Robe', tier: 3, at: [-35, UP, 4], seenAt: 104 },
];

// ---- tiles, walls and doors from the rooms (like the game's DirtFinderMapFloor/Wall) ----
type FloorTile = NonNullable<LiveLayout['floors']>[number];
type WallTile = NonNullable<LiveLayout['walls']>[number];
const cellRoom = new Map<string, number>();
ROOMS.forEach((r, ri) => {
  for (let i = r.i0; i < r.i1; i++) for (let j = r.j0; j < r.j1; j++) cellRoom.set(`${r.layer}|${i}|${j}`, ri);
});
const floorsByRoom: FloorTile[][] = ROOMS.map((r) => {
  const out: FloorTile[] = [];
  for (let i = r.i0; i < r.i1; i++) for (let j = r.j0; j < r.j1; j++) out.push([c(i), c(j), r.layer, 0, 1, 1, r.truck ? 3 : r.stairs && r.stairs[0] === i && r.stairs[1] === j ? 2 : 0]);
  return out;
});
// One door per pair of neighbouring rooms, in the middle of their shared wall.
const shared = new Map<string, [number, number, number, number][]>(); // "a|b" → edges [layer, i, j, dir]
const wallsByRoom: WallTile[][] = ROOMS.map(() => []);
ROOMS.forEach((r, ri) => {
  for (let i = r.i0; i < r.i1; i++)
    for (let j = r.j0; j < r.j1; j++)
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const other = cellRoom.get(`${r.layer}|${i + di}|${j + dj}`);
        if (other === ri) continue;
        if (other != null && other > ri) {
          const k = `${ri}|${other}`;
          if (!shared.has(k)) shared.set(k, []);
          shared.get(k)!.push([r.layer, i, j, di !== 0 ? (di > 0 ? 0 : 1) : dj > 0 ? 2 : 3]);
        } else if (other == null) wallsByRoom[ri].push(edge(r.layer, i, j, di, dj, 0));
      }
});
for (const [k, edges] of shared) {
  const [a, b] = k.split('|').map(Number);
  const door = Math.floor(edges.length / 2);
  edges.forEach(([l, i, j, d], n) => {
    const [di, dj] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][d];
    const w = edge(l, i, j, di, dj, n === door ? 1 : 0);
    wallsByRoom[a].push(w);
    wallsByRoom[b].push(w);
  });
}
function edge(layer: number, i: number, j: number, di: number, dj: number, kind: number): WallTile {
  // yaw 0 = runs east-west, 90 = runs north-south
  if (di !== 0) return [i * T + (di > 0 ? T : 0), c(j), layer, 90, 1, kind];
  return [c(i), j * T + (dj > 0 ? T : 0), layer, 0, 1, kind];
}

function posAt(t: number): Vec3 {
  for (let n = 1; n < PATH.length; n++) {
    const [t1, b] = PATH[n];
    const [t0, a] = PATH[n - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return PATH[PATH.length - 1][1];
}

/** First time "you" got within `r` metres of a spot (same floor), or Infinity. */
function firstNear(at: Vec3, r: number): number {
  for (let t = 0; t <= DEMO_LOOP; t += 0.5) {
    const p = posAt(t);
    if (Math.abs(p[1] - at[1]) < 2.5 && Math.hypot(p[0] - at[0], p[2] - at[2]) <= r) return t;
  }
  return Infinity;
}
const roomFound = ROOMS.map((r) => (r.truck ? 0 : firstNear([((r.i0 + r.i1) / 2) * T, r.layer * UP, ((r.j0 + r.j1) / 2) * T], (Math.max(r.i1 - r.i0, r.j1 - r.j0) * T) / 2 + 3)));
const valFound = VALUABLES.map((v) => firstNear(v.at, 11));
const extFound = EXTRACTIONS.map((e) => firstNear(e.at, 12));

const r1 = (n: number) => Math.round(n * 2) / 2;

/** Alex: seen walking with you early on, then pings from the north-east later. */
function alexSeen(t: number): { lastSeen?: Vec3; lastSeenAgo?: number; lastSeenHow?: 'seen' | 'ping' } {
  if (t > 50) return { lastSeen: [33, 0, 22], lastSeenAgo: Math.round(t - 50), lastSeenHow: 'ping' };
  if (t > 4) return { lastSeen: [r1(posAt(Math.min(t, 20) - 2)[0] + 2), 0, r1(posAt(Math.min(t, 20) - 2)[2])], lastSeenAgo: Math.max(0, Math.round(t - 20)), lastSeenHow: 'seen' };
  return {};
}

export function demoState(seconds: number): GameStateV1 {
  const t = ((seconds % DEMO_LOOP) + DEMO_LOOP) % DEMO_LOOP;
  const me = posAt(t);
  const ahead = posAt(Math.min(DEMO_LOOP, t + 1));
  const moving = Math.hypot(ahead[0] - me[0], ahead[2] - me[2]) > 0.01;
  const yaw = moving ? Math.round(((Math.atan2(ahead[0] - me[0], ahead[2] - me[2]) * 180) / Math.PI + 360) % 360) : 0;
  const goal = 24000;
  const haulNow = 2500 + (t > 40 ? 6300 : 0) + (t > 45 ? 0 : Math.min(2000, t * 40));
  const explored = ROOMS.map((_, i) => roomFound[i] <= t);
  const wallSeen = new Set<WallTile>();
  const walls: WallTile[] = [];
  wallsByRoom.forEach((ws, ri) => {
    if (!explored[ri]) return;
    for (const w of ws) if (!wallSeen.has(w)) (wallSeen.add(w), walls.push(w));
  });

  const pings: LivePing[] = [];
  if (t > 50 && t < 110) pings.push({ kind: 'Enemy', at: [36, 0, 18], agoSec: Math.round(t - 50), by: 'Alex' }); // no Ping Info: unknown which
  if (t > 80) pings.push({ kind: 'Valuable', at: [-36, UP, 0], agoSec: Math.round(t - 80), by: 'Sam', name: 'Teapot', value: 600 });

  const layout: LiveLayout = {
    me: [r1(me[0]), r1(me[1]), r1(me[2])],
    yaw,
    truck: [0, 0, -5],
    floors: floorsByRoom.filter((_, i) => explored[i]).flat(),
    walls,
    rooms: ROOMS.filter((_, i) => explored[i]).map((r) => [((r.i0 + r.i1) / 2) * T, r.layer * UP + 2, ((r.j0 + r.j1) / 2) * T, (r.i1 - r.i0) * T, 4, (r.j1 - r.j0) * T]),
    extraction: {
      goalPerPoint: goal / EXTRACTIONS.length,
      total: EXTRACTIONS.length,
      completed: EXTRACTIONS.filter((e) => e.doneAt != null && e.doneAt <= t).length,
      points: EXTRACTIONS.map((e, i) => ({ e, i }))
        .filter(({ e, i }) => extFound[i] <= t || (e.activeFrom != null && e.activeFrom <= t))
        .map(({ e }) => ({
          at: e.at,
          state: e.doneAt != null && e.doneAt <= t ? 'Complete' : e.activeFrom != null && e.activeFrom <= t ? 'Active' : 'Idle',
          current: e.activeFrom != null && e.activeFrom <= t && !(e.doneAt != null && e.doneAt <= t),
        })),
    },
    valuables: VALUABLES.filter((_, i) => valFound[i] <= t).map((v) => ({
      name: v.name,
      value: v.value,
      size: v.size,
      at: v.inHaulAt != null && v.inHaulAt <= t ? EXTRACTIONS[0].at : v.at,
      ...(v.inHaulAt != null && v.inHaulAt <= t ? { inHaul: true } : {}),
    })),
    monsters: MONSTERS.filter((m) => m.seenAt <= t).map((m) => ({ key: m.key, name: m.name, at: m.at, agoSec: Math.round(t - m.seenAt), killed: m.killedAt != null && m.killedAt <= t })),
    pings,
  };

  const samDown = t > 58;
  const samHeadFound = t > 70;
  const health = Math.round(t < 36 ? 100 : t < 60 ? 100 - (t - 36) * 2.5 : t < 80 ? 40 : Math.min(100, 40 + (t - 80) * 3));

  return {
    v: 1,
    mod: 'demo',
    phase: 'level',
    map: 'Museum of Human Art',
    levelsCompleted: 5,
    playerCount: 3,
    haul: { goal, current: haulNow, extractionPoints: EXTRACTIONS.length, extractionPointsCompleted: layout.extraction!.completed },
    surplusK: 38,
    seen: MONSTERS.filter((m) => m.seenAt <= t).map((m) => ({
      key: m.key,
      name: m.name,
      tier: m.tier,
      firstSeenAt: m.seenAt,
      onScreen: true,
      killed: m.killedAt != null && m.killedAt <= t,
      ...(m.killedAt != null && m.killedAt <= t ? { respawnInSec: Math.max(0, 260 - (t - m.killedAt)) } : {}),
    })),
    owned: { 'Item Gun Tranq': 1, 'Item Grenade Explosive': 2, 'Item Health Pack Small': 1 },
    players: [
      { name: 'You', isLocal: true, upgrades: { Health: 2, Stamina: 3, Strength: 1 } },
      { name: 'Alex', upgrades: { Strength: 3, Range: 1 } },
      { name: 'Sam', upgrades: { Stamina: 2 } },
    ],
    me: { dead: false, health, maxHealth: 100 },
    team: [
      { name: 'You', isLocal: true, dead: false },
      { name: 'Alex', dead: false, ...alexSeen(t) },
      samDown && samHeadFound ? { name: 'Sam', dead: true, head: [-22, 0, 14] as Vec3 } : { name: 'Sam', dead: false },
    ],
    layout,
  };
}
