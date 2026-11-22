import type { LiveLayout, Vec3 } from '../live/schema';

/**
 * Extraction planner: biggest discovered valuables first, each to its closest found
 * extraction point. Uses only what the game has disclosed (discovered valuables,
 * found extraction points). Distances are straight lines, with height counted double
 * because stairs and floors make vertical distance slower than it looks.
 */
export interface PlannedItem {
  name: string;
  value: number;
  size?: string;
  distance: number;
  at: Vec3;
}

export interface PlannedPoint {
  index: number;
  at: Vec3;
  state?: string;
  current: boolean;
  done: boolean;
  goal: number | null;
  /** Discovered value planned for this point. */
  planned: number;
  items: PlannedItem[];
}

export interface ExtractionPlan {
  points: PlannedPoint[];
  /** Valuables already sitting in an extraction zone. */
  inHaul: number;
  /** Discovered but there's no found extraction point yet. */
  unassigned: PlannedItem[];
  discoveredValue: number;
}

const DONE_STATES = new Set(['Complete', 'Surplus', 'TaxReturn', 'Extracting']);

export function distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = (a[1] - b[1]) * 2;
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function planExtraction(layout: LiveLayout | undefined): ExtractionPlan {
  const goal = layout?.extraction?.goalPerPoint ?? null;
  const points: PlannedPoint[] = (layout?.extraction?.points ?? []).map((p, index) => ({
    index,
    at: p.at,
    state: p.state,
    current: !!p.current,
    done: DONE_STATES.has(p.state ?? ''),
    goal,
    planned: 0,
    items: [],
  }));
  const open = points.filter((p) => !p.done);
  const valuables = layout?.valuables ?? [];
  let inHaul = 0;
  const unassigned: PlannedItem[] = [];

  // Biggest first, so the valuable ones get the shortest trip.
  for (const v of [...valuables].sort((a, b) => b.value - a.value)) {
    if (v.inHaul) {
      inHaul += v.value;
      continue;
    }
    let best: PlannedPoint | null = null;
    let bestD = Infinity;
    for (const p of open) {
      const d = distance(v.at, p.at);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const item: PlannedItem = { name: v.name, value: v.value, size: v.size, at: v.at, distance: Math.round(bestD) };
    if (!best) {
      unassigned.push({ ...item, distance: 0 });
      continue;
    }
    best.items.push(item);
    best.planned += v.value;
  }

  return {
    points,
    inHaul,
    unassigned,
    discoveredValue: valuables.reduce((a, v) => a + v.value, 0),
  };
}

/** $12,345 → "$12.3K" */
export function dollarsK(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(v)}`;
}
