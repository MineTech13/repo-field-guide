import type { GameStateV1, LiveLayout, Vec3 } from './schema';

/**
 * A made-up level for the "Try the demo" button: shows what the Live page does with the
 * companion mod, without the game. Loops every LOOP seconds. Nothing here is real data.
 */
export const DEMO_LOOP = 120;

type Room = [number, number, number, number, number, number];
const ROOMS: Room[] = [
  [0, 0, -4, 10, 4, 8], // truck bay
  [0, 0, 8, 8, 4, 16],
  [12, 0, 18, 16, 4, 10],
  [-12, 0, 18, 14, 4, 12],
  [26, 0, 10, 12, 4, 14],
  [26, 0, 30, 14, 4, 12],
  [-24, 0, 30, 12, 4, 12],
  [0, 0, 34, 12, 4, 14],
  [-12, 4.5, 6, 12, 4, 12], // upstairs
  [-26, 4.5, 8, 14, 4, 10],
];

// Where "you" walk, in seconds → position.
const PATH: [number, Vec3][] = [
  [0, [0, 0, -4]],
  [8, [0, 0, 10]],
  [18, [12, 0, 18]],
  [28, [26, 0, 12]],
  [38, [26, 0, 30]],
  [48, [12, 0, 20]],
  [56, [0, 0, 32]],
  [66, [-12, 0, 20]],
  [76, [-24, 0, 30]],
  [84, [-12, 0, 16]],
  [92, [-12, 4.5, 6]],
  [102, [-26, 4.5, 8]],
  [110, [-12, 4.5, 6]],
  [120, [0, 0, -2]],
];

const EXTRACTIONS: { at: Vec3; doneAt?: number; activeFrom?: number }[] = [
  { at: [26, 0, 14], activeFrom: 0, doneAt: 45 }, // the game's first one
  { at: [2, 0, 36], activeFrom: 45 },
  { at: [-26, 4.5, 9] },
  { at: [2, 0, 4] }, // closest to the truck
];

const VALUABLES: { name: string; value: number; at: Vec3; size: string; inHaulAt?: number }[] = [
  { name: 'Grandfather Clock', value: 8800, at: [10, 0, 20], size: 'VeryTall' },
  { name: 'Diamond', value: 4100, at: [14, 0, 15], size: 'Tiny' },
  { name: 'Golden Statue', value: 6300, at: [24, 0, 6], size: 'Big', inHaulAt: 40 },
  { name: 'Vase', value: 1300, at: [28, 0, 32], size: 'Small' },
  { name: 'Painting', value: 2500, at: [22, 0, 28], size: 'Medium' },
  { name: 'Music Box', value: 900, at: [-2, 0, 30], size: 'Small' },
  { name: 'Piano', value: 11200, at: [-14, 0, 22], size: 'Wide' },
  { name: 'Ring', value: 700, at: [-22, 0, 32], size: 'Tiny' },
  { name: 'Chandelier', value: 5400, at: [-10, 4.5, 8], size: 'Wide' },
  { name: 'Teapot', value: 600, at: [-28, 4.5, 6], size: 'Small' },
  { name: 'Globe', value: 1800, at: [4, 0, 6], size: 'Medium' },
];

const MONSTERS: { key: string; name: string; tier: number; at: Vec3; seenAt: number; killedAt?: number }[] = [
  { key: 'ENEMY.HUNTER', name: 'Huntsman', tier: 3, at: [30, 0, 26], seenAt: 34 },
  { key: 'ENEMY.BANG', name: 'Banger', tier: 2, at: [8, 0, 20], seenAt: 16, killedAt: 22 },
  { key: 'ENEMY.CEILING_EYE', name: 'Peeper', tier: 1, at: [-24, 0, 30], seenAt: 74 },
  { key: 'ENEMY.ROBE', name: 'Robe', tier: 3, at: [-24, 4.5, 8], seenAt: 100 },
];

function posAt(t: number): Vec3 {
  for (let i = 1; i < PATH.length; i++) {
    const [t1, b] = PATH[i];
    const [t0, a] = PATH[i - 1];
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
const roomFound = ROOMS.map((r) => firstNear([r[0], r[1], r[2]], Math.max(r[3], r[5]) / 2 + 4));
const valFound = VALUABLES.map((v) => firstNear(v.at, 11));
const extFound = EXTRACTIONS.map((e) => firstNear(e.at, 12));

const r1 = (n: number) => Math.round(n * 2) / 2;

export function demoState(seconds: number): GameStateV1 {
  const t = ((seconds % DEMO_LOOP) + DEMO_LOOP) % DEMO_LOOP;
  const me = posAt(t);
  const ahead = posAt(Math.min(DEMO_LOOP, t + 1));
  const yaw = Math.round(((Math.atan2(ahead[0] - me[0], ahead[2] - me[2]) * 180) / Math.PI + 360) % 360);
  const goal = 24000;
  const haulNow = 2500 + (t > 40 ? 6300 : 0) + (t > 45 ? 0 : Math.min(2000, t * 40));

  const layout: LiveLayout = {
    me: [r1(me[0]), r1(me[1]), r1(me[2])],
    yaw,
    truck: [0, 0, -6],
    rooms: ROOMS.filter((_, i) => roomFound[i] <= t),
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
      { name: 'Alex', dead: false },
      samDown && samHeadFound ? { name: 'Sam', dead: true, head: [-20, 0, 26] as Vec3 } : { name: 'Sam', dead: false },
    ],
    layout,
  };
}
