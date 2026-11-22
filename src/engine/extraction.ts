import type { LiveLayout, Vec3 } from '../live/schema';

/**
 * Extraction planner, the way teams actually play it (not just "nearest point"):
 *
 * 1. **Order:** finished points first, then the active one (you don't pick the first),
 *    then the rest by shortest hop, and the point closest to the truck **last**, so the
 *    final run ends next to the exit.
 * 2. **Big items** (bulky or valuable) go to their closest open extraction: short carries.
 * 3. **Small items** are grab-on-the-way top-ups. They fill whatever an extraction still
 *    needs (nearest first), and the rest go to the last extraction.
 *
 * Uses only what the game has disclosed: discovered valuables and found extraction points.
 * Distances are straight lines, with height counted double (stairs are slow).
 */
export interface PlannedItem {
  name: string;
  value: number;
  size?: string;
  /** Straight-line metres to the extraction it's planned for. */
  distance: number;
  at: Vec3;
}

export type PointRole = 'done' | 'now' | 'next' | 'last';

export interface PlannedPoint {
  /** Index in the game's list, for the "E1/E2" labels. */
  index: number;
  /** 1-based position in the planned order. */
  order: number;
  role: PointRole;
  at: Vec3;
  state?: string;
  current: boolean;
  done: boolean;
  goal: number | null;
  /** Discovered value planned for this point (big + top-ups). */
  planned: number;
  /** Still missing after the plan (0 = covered). */
  shortfall: number;
  big: PlannedItem[];
  topUp: PlannedItem[];
}

export interface ExtractionPlan {
  /** In planned order. */
  points: PlannedPoint[];
  /** Valuables already sitting in an extraction zone. */
  inHaul: number;
  /** Discovered but there's no open extraction point found yet. */
  unassigned: PlannedItem[];
  discoveredValue: number;
  /** Points the level has that nobody found yet. */
  notFound: number;
  /** True when the truck position is known, so "last = closest to the truck" applies. */
  truckKnown: boolean;
}

const DONE_STATES = new Set(['Complete', 'Surplus', 'TaxReturn', 'Extracting']);
const BULKY = new Set(['Big', 'Wide', 'Tall', 'VeryTall']);
/** At or above this value an item counts as "big" even when it's easy to carry. */
export const BIG_VALUE = 5000;

export const isBig = (v: { value: number; size?: string }) => BULKY.has(v.size ?? '') || v.value >= BIG_VALUE;

export function distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = (a[1] - b[1]) * 2;
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

type Draft = Omit<PlannedPoint, 'order' | 'role'>;

/** done → active → shortest hops → closest-to-truck last. */
function orderPoints(points: Draft[], truck: Vec3 | undefined): { list: Draft[]; roles: PointRole[] } {
  const done = points.filter((p) => p.done);
  const open = points.filter((p) => !p.done);
  const now = open.find((p) => p.current) ?? null;
  let rest = open.filter((p) => p !== now);
  let last: Draft | null = null;
  if (truck && rest.length > 0) {
    last = rest.reduce((a, b) => (distance(b.at, truck) < distance(a.at, truck) ? b : a));
    rest = rest.filter((p) => p !== last);
  }
  // Shortest hop from wherever you are in the plan.
  const middle: Draft[] = [];
  let from = now?.at ?? done[done.length - 1]?.at ?? truck;
  while (rest.length) {
    const here = from;
    const next = here ? rest.reduce((a, b) => (distance(b.at, here) < distance(a.at, here) ? b : a)) : rest[0];
    middle.push(next);
    rest = rest.filter((p) => p !== next);
    from = next.at;
  }
  const list = [...done, ...(now ? [now] : []), ...middle, ...(last ? [last] : [])];
  const roles: PointRole[] = list.map((p, i) => {
    if (p.done) return 'done';
    if (p === now) return 'now';
    if (p === last || (i === list.length - 1 && !truck)) return 'last';
    return 'next';
  });
  return { list, roles };
}

export function planExtraction(layout: LiveLayout | undefined): ExtractionPlan {
  const goal = layout?.extraction?.goalPerPoint ?? null;
  const truck = layout?.truck;
  const drafts: Draft[] = (layout?.extraction?.points ?? []).map((p, index) => ({
    index,
    at: p.at,
    state: p.state,
    current: !!p.current,
    done: DONE_STATES.has(p.state ?? ''),
    goal,
    planned: 0,
    shortfall: 0,
    big: [],
    topUp: [],
  }));
  const { list, roles } = orderPoints(drafts, truck);
  const points: PlannedPoint[] = list.map((p, i) => ({ ...p, order: i + 1, role: roles[i] }));
  const open = points.filter((p) => !p.done);

  const valuables = layout?.valuables ?? [];
  let inHaul = 0;
  const unassigned: PlannedItem[] = [];
  const smalls: (typeof valuables)[number][] = [];
  const closest = (at: Vec3, among: PlannedPoint[]) => among.reduce((a, b) => (distance(at, b.at) < distance(at, a.at) ? b : a));
  const item = (v: (typeof valuables)[number], p: PlannedPoint): PlannedItem => ({ name: v.name, value: v.value, size: v.size, at: v.at, distance: Math.round(distance(v.at, p.at)) });

  // 1. Big items: biggest first, each to its closest open extraction.
  for (const v of [...valuables].sort((a, b) => b.value - a.value)) {
    if (v.inHaul) {
      inHaul += v.value;
      continue;
    }
    if (!open.length) {
      unassigned.push({ name: v.name, value: v.value, size: v.size, at: v.at, distance: 0 });
      continue;
    }
    if (!isBig(v)) {
      smalls.push(v);
      continue;
    }
    const p = closest(v.at, open);
    p.big.push(item(v, p));
    p.planned += v.value;
  }

  // 2. Small items top up each extraction in order (nearest first); the rest go to the last one.
  let pool = [...smalls];
  for (const p of open) {
    if (goal == null) break;
    pool.sort((a, b) => distance(a.at, p.at) - distance(b.at, p.at));
    while (p.planned < goal && pool.length && p !== open[open.length - 1]) {
      const v = pool.shift()!;
      p.topUp.push(item(v, p));
      p.planned += v.value;
    }
  }
  const lastOpen = open[open.length - 1];
  if (lastOpen) {
    for (const v of pool) {
      lastOpen.topUp.push(item(v, lastOpen));
      lastOpen.planned += v.value;
    }
    lastOpen.topUp.sort((a, b) => b.value - a.value);
  }
  for (const p of points) p.shortfall = p.done || goal == null ? 0 : Math.max(0, goal - p.planned);

  const total = layout?.extraction?.total ?? points.length;
  return {
    points,
    inHaul,
    unassigned,
    discoveredValue: valuables.reduce((a, v) => a + v.value, 0),
    notFound: Math.max(0, total - points.length),
    truckKnown: !!truck,
  };
}

/** $12,345 → "$12K" */
export function dollarsK(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(v)}`;
}
