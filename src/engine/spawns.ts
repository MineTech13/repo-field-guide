import { MONSTERS, SPAWNS, monsterById } from '../data';
import type { Monster, SpawnBand } from '../data/types';
import type { Spotted } from './types';

export type TierKey = 't1' | 't2' | 't3';
const KEY: Record<1 | 2 | 3, TierKey> = { 1: 't1', 2: 't2', 3: 't3' };

export function bandFor(level: number): SpawnBand {
  const lvl = Math.max(1, Math.round(level));
  return SPAWNS.bands.find((b) => lvl >= b.from && (b.to == null || lvl <= b.to)) ?? SPAWNS.bands[SPAWNS.bands.length - 1];
}

export const bandTotal = (b: SpawnBand) => b.t1 + b.t2 + b.t3;
export const bandLabel = (b: SpawnBand) => (b.to == null ? `Level ${b.from}+` : b.from === b.to ? `Level ${b.from}` : `Levels ${b.from}–${b.to}`);

export interface TierCheck {
  tier: 1 | 2 | 3;
  expected: number;
  found: number;
  /** How many are probably still out there unseen. */
  missing: number;
  /** Monster types of this tier you haven't logged yet (what the missing ones could be). */
  candidates: Monster[];
}

export interface SpawnCheck {
  band: SpawnBand;
  tiers: TierCheck[];
  totalExpected: number;
  totalFound: number;
  missing: number;
  /** More logged than the table allows, so likely a group swap or respawns. */
  overflow: boolean;
  /** Next level's band if it changes, so you can prepare at the shop. */
  nextJump: { level: number; band: SpawnBand } | null;
}

/**
 * Compares logged monster *types* against the per-level spawn table. Every
 * distinct logged monster counts as one slot of its tier, killed ones included
 * (they still spawned). Groups (e.g. 10 Gnomes) are one slot.
 */
export function spawnCheck(level: number, spotted: Spotted[]): SpawnCheck {
  const band = bandFor(level);
  const ids = new Set(spotted.map((s) => s.id));
  const tiers: TierCheck[] = ([3, 2, 1] as const).map((tier) => {
    const expected = band[KEY[tier]];
    const found = [...ids].filter((id) => monsterById.get(id)?.tier === tier).length;
    return {
      tier,
      expected,
      found,
      missing: Math.max(0, expected - found),
      candidates: MONSTERS.filter((m) => m.tier === tier && !ids.has(m.id)),
    };
  });
  const totalFound = tiers.reduce((a, t) => a + t.found, 0);
  const next = bandFor(level + 1);
  return {
    band,
    tiers,
    totalExpected: bandTotal(band),
    totalFound,
    missing: tiers.reduce((a, t) => a + t.missing, 0),
    overflow: tiers.some((t) => t.found > t.expected),
    nextJump: next !== band ? { level: level + 1, band: next } : null,
  };
}

export function respawnTimeAt(minutes: number): string {
  const row = SPAWNS.respawn.find((r) => minutes >= r.fromMin && (r.toMin == null || minutes < r.toMin));
  return row?.time ?? SPAWNS.respawn[SPAWNS.respawn.length - 1].time;
}
