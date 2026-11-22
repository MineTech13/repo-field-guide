import { MONSTERS } from '../data';
import type { GameStateV1, Vec3 } from '../live/schema';
import { dollarsK, type ExtractionPlan } from './extraction';

/** Something discovered you can navigate to. */
export interface NavTarget {
  id: string;
  kind: 'extraction' | 'truck' | 'head' | 'valuable' | 'monster';
  icon: string;
  label: string;
  at: Vec3;
}

const monsterByKey = new Map(MONSTERS.map((m) => [m.gameKey, m]));

/** Everything on the map you could want to find again. Only discovered things. */
export function navTargets(live: GameStateV1, plan: ExtractionPlan): NavTarget[] {
  const L = live.layout;
  if (!L) return [];
  const out: NavTarget[] = [];
  for (const p of plan.points) {
    if (p.done) continue;
    out.push({ id: `ext-${p.index}`, kind: 'extraction', icon: '■', label: `Extraction ${p.order}${p.role === 'now' ? ' (now)' : p.role === 'last' ? ' (last)' : ''}`, at: p.at });
  }
  if (L.truck) out.push({ id: 'truck', kind: 'truck', icon: '🚚', label: 'Truck', at: L.truck });
  for (const p of live.team ?? []) {
    if (p.dead && p.head && !p.isLocal && p.headIn !== 'truck') out.push({ id: `head-${p.name}`, kind: 'head', icon: '💀', label: `${p.name}'s head`, at: p.head });
  }
  for (const v of [...(L.valuables ?? [])].filter((v) => !v.inHaul).sort((a, b) => b.value - a.value)) {
    out.push({ id: `val-${v.name}-${v.at.join(',')}`, kind: 'valuable', icon: '💰', label: `${v.name} ${dollarsK(v.value)}`, at: v.at });
  }
  for (const m of L.monsters ?? []) {
    if (m.killed) continue;
    const info = m.key ? monsterByKey.get(m.key) : undefined;
    out.push({ id: `mon-${m.key ?? m.name}`, kind: 'monster', icon: info?.emoji ?? '❓', label: `${info?.name ?? m.name ?? 'Monster'} (last seen)`, at: m.at });
  }
  return out;
}

export interface Heading {
  /** Straight-line metres on the floor plan. */
  distance: number;
  /** Degrees to turn: 0 = straight ahead, 90 = to your right, -90 = to your left. */
  turn: number;
  /** Metres above (+) or below (-) you. */
  dy: number;
}

/** Direction from you to a target, relative to where you're looking. */
export function headingTo(me: Vec3, yaw: number, at: Vec3): Heading {
  const dx = at[0] - me[0];
  const dz = at[2] - me[2];
  const bearing = (Math.atan2(dx, dz) * 180) / Math.PI; // 0 = north (+z), clockwise
  let turn = bearing - yaw;
  turn = ((((turn + 180) % 360) + 360) % 360) - 180;
  return { distance: Math.round(Math.hypot(dx, dz)), turn: Math.round(turn), dy: Math.round((at[1] - me[1]) * 10) / 10 };
}

export function turnText(turn: number): string {
  const a = Math.abs(turn);
  if (a <= 15) return 'straight ahead';
  if (a >= 160) return 'behind you';
  const side = turn > 0 ? 'right' : 'left';
  return a <= 60 ? `ahead, ${side}` : a <= 120 ? `to your ${side}` : `behind, ${side}`;
}

export function floorText(dy: number): string | null {
  if (Math.abs(dy) < 2.5) return null;
  const floors = Math.max(1, Math.round(Math.abs(dy) / 4));
  return `${floors === 1 ? 'one floor' : `${floors} floors`} ${dy > 0 ? 'up' : 'down'}`;
}
