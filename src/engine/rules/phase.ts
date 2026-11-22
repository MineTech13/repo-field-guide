import type { Phase } from '../../data/types';

/**
 * Phase buckets follow the game's own difficulty steps (checked with a data dump, v0.5.2):
 * levels 1–5 have at most one big (tier-3) monster, 6–9 have two, and from 10 on three or more.
 */
export const PHASES: { phase: Phase; from: number; label: string }[] = [
  { phase: 'early', from: 1, label: 'Early (levels 1–5)' },
  { phase: 'mid', from: 6, label: 'Mid (levels 6–9)' },
  { phase: 'late', from: 10, label: 'Late (level 10+)' },
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
