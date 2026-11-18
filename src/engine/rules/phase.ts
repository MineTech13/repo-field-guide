import type { Phase } from '../../data/types';

/**
 * Rough phase buckets. The game doesn't publish exact thresholds: hazards
 * (pits, lava, bigger monster groups) ramp up as the level/quota climbs.
 * These are guide approximations; tweak here if the community finds better ones.
 */
export const PHASES: { phase: Phase; from: number; label: string }[] = [
  { phase: 'early', from: 1, label: 'Early (levels 1–3)' },
  { phase: 'mid', from: 4, label: 'Mid (levels 4–7)' },
  { phase: 'late', from: 8, label: 'Late (level 8+)' },
];

export const PHASE_MULTIPLIER: Record<Phase, number> = { early: 1, mid: 1.15, late: 1.3 };

export function phaseFor(level: number): Phase {
  let current: Phase = 'early';
  for (const p of PHASES) if (level >= p.from) current = p.phase;
  return current;
}

export function phaseLabel(phase: Phase): string {
  return PHASES.find((p) => p.phase === phase)!.label;
}
