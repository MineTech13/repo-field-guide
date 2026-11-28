import type { LiveLayout, Vec3 } from '../live/schema';

/**
 * Walking routes over the explored map only (the tiles the in-game Tab map shows), so a
 * route never gives away rooms nobody has explored. Through doors, over stairs, never
 * through walls or blocked doors.
 *
 * The explored floor is rasterised into 1.25 m cells per map layer (4 m of height), walls
 * block the step between two cells, and A* finds the route.
 */
export const TILE = 5; // LevelGenerator.TileSize
export const LAYER_HEIGHT = 4; // Map.LayerHeight
const CELL = 1.25;

export const layerOf = (y: number) => Math.floor((y + 0.1) / LAYER_HEIGHT);

type Floor = NonNullable<LiveLayout['floors']>[number];
type Wall = NonNullable<LiveLayout['walls']>[number];

/** Unity yaw (degrees, clockwise from +z seen from above) → local X axis on the floor plan. */
export function axes(yaw: number): { right: [number, number]; forward: [number, number] } {
  const r = (yaw * Math.PI) / 180;
  return { right: [Math.cos(r), -Math.sin(r)], forward: [Math.sin(r), Math.cos(r)] };
}

/**
 * A wall's two ends on the floor plan [x1, z1, x2, z2]. Like the game's map pieces, a wall
 * starts at its pivot and runs `len` tiles along its local X axis.
 */
export function wallSegment(w: Wall): [number, number, number, number] {
  const [x, z, , yaw, len] = w;
  const { right } = axes(yaw);
  const l = len * TILE;
  return [x, z, x + right[0] * l, z + right[1] * l];
}

/**
 * A floor tile's size in tiles [along X, along Z]. The pieces are squares (1x1, 0.5x0.5,
 * 0.25x0.25); companion 0.2.6–0.2.7 sent the small ones as 1 by 0.5, so square those up.
 */
export function floorSize(f: Floor): [number, number] {
  const [, , , , sx, sz, kind] = f;
  return kind !== 3 && sz < sx ? [sz, sz] : [sx, sz];
}

/** A floor tile's four corners on the floor plan. Pieces are anchored at a corner and extend along local +X and +Z. */
export function floorCorners(f: Floor): [number, number][] {
  const [x, z, , yaw] = f;
  const [sx, sz] = floorSize(f);
  const { right, forward } = axes(yaw);
  const a = sx * TILE;
  const b = sz * TILE;
  return [
    [x, z],
    [x + right[0] * a, z + right[1] * a],
    [x + right[0] * a + forward[0] * b, z + right[1] * a + forward[1] * b],
    [x + forward[0] * b, z + forward[1] * b],
  ];
}

function insideTile(f: Floor, px: number, pz: number): boolean {
  const [x, z, , yaw] = f;
  const [sx, sz] = floorSize(f);
  const { right, forward } = axes(yaw);
  const dx = px - x;
  const dz = pz - z;
  const u = dx * right[0] + dz * right[1];
  const v = dx * forward[0] + dz * forward[1];
  return u >= -0.01 && u <= sx * TILE + 0.01 && v >= -0.01 && v <= sz * TILE + 0.01;
}

function segmentsCross(a: number[], b: number[]): boolean {
  const [x1, y1, x2, y2] = a;
  const [x3, y3, x4, y4] = b;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export interface NavGrid {
  cells: Map<string, { x: number; z: number; layer: number; stairs: boolean }>;
  blockers: Map<string, number[][]>; // layer|bucket → wall segments that block
  /** Staircases: walk from one cell to a cell on another floor (cost in metres). */
  links: Map<string, { to: string; cost: number }[]>;
}

/**
 * Staircases from the map's "Stairs" pieces. Each piece climbs one storey (4 m) along its
 * forward axis over about 4 m, starting at its pivot edge; a staircase can be several pieces
 * (the "Top" piece starts where the bottom one ends, possibly turning a corner). We chain the
 * pieces and connect both ends to the nearest explored floor, so a route can use them.
 */
function stairLinks(cells: NavGrid['cells'], walls: Wall[]): NavGrid['links'] {
  const links: NavGrid['links'] = new Map();
  type End = { x: number; z: number; layer: number };
  const pieces = walls
    .filter((w) => w[5] === 3)
    .map((w) => {
      const { right, forward } = axes(w[3]);
      const half = (w[4] * TILE) / 2;
      const ax = w[0] + right[0] * half;
      const az = w[1] + right[1] * half;
      const run = LAYER_HEIGHT; // ~45° stairs
      const lo: End = { x: ax - forward[0] * 0.5, z: az - forward[1] * 0.5, layer: w[2] };
      const hi: End = { x: ax + forward[0] * (run + 0.5), z: az + forward[1] * (run + 0.5), layer: w[2] + 1 };
      return { lo, hi };
    });
  if (!pieces.length) return links;

  // Endpoints graph: each piece joins its two ends; ends of different pieces that meet are joined.
  const ends: End[] = pieces.flatMap((p) => [p.lo, p.hi]);
  const adj: [number, number][][] = ends.map(() => []);
  pieces.forEach((_, i) => {
    adj[2 * i].push([2 * i + 1, run(pieces[i])]);
    adj[2 * i + 1].push([2 * i, run(pieces[i])]);
  });
  for (let a = 0; a < ends.length; a++)
    for (let b = a + 1; b < ends.length; b++)
      if (Math.floor(a / 2) !== Math.floor(b / 2) && ends[a].layer === ends[b].layer && Math.hypot(ends[a].x - ends[b].x, ends[a].z - ends[b].z) <= 6) {
        adj[a].push([b, 2]);
        adj[b].push([a, 2]);
      }

  // Where each end meets explored floor (if it does).
  const floorAt = ends.map((e) => nearestOnLayer(cells, e.x, e.z, e.layer, 4));
  for (let a = 0; a < ends.length; a++) {
    const from = floorAt[a];
    if (!from) continue;
    // Cheapest way along the stairs to every other end (tiny Dijkstra).
    const dist = new Map<number, number>([[a, 0]]);
    const todo = [a];
    while (todo.length) {
      todo.sort((p, q) => dist.get(p)! - dist.get(q)!);
      const n = todo.shift()!;
      for (const [m, c] of adj[n]) {
        const d = dist.get(n)! + c;
        if (d < (dist.get(m) ?? Infinity)) {
          dist.set(m, d);
          todo.push(m);
        }
      }
    }
    for (const [b, d] of dist) {
      const to = floorAt[b];
      if (b === a || !to || ends[b].layer === ends[a].layer) continue;
      if (!links.has(from)) links.set(from, []);
      links.get(from)!.push({ to, cost: d });
    }
  }
  return links;

  function run(p: { lo: End; hi: End }) {
    return Math.hypot(p.hi.x - p.lo.x, p.hi.z - p.lo.z, LAYER_HEIGHT);
  }
}

function nearestOnLayer(cells: NavGrid['cells'], x: number, z: number, layer: number, maxR: number): string | null {
  const i0 = Math.floor(x / CELL);
  const j0 = Math.floor(z / CELL);
  for (let r = 0; r <= maxR; r++)
    for (let i = i0 - r; i <= i0 + r; i++)
      for (let j = j0 - r; j <= j0 + r; j++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
        const k = key(i, j, layer);
        if (cells.has(k)) return k;
      }
  return null;
}

const key = (i: number, j: number, l: number) => `${l}|${i}|${j}`;
const bucket = (x: number, z: number, l: number) => `${l}|${Math.floor(x / TILE)}|${Math.floor(z / TILE)}`;

export function buildGrid(layout: LiveLayout): NavGrid | null {
  const floors = layout.floors ?? [];
  if (!floors.length) return null;
  const cells: NavGrid['cells'] = new Map();
  for (const f of floors) {
    const pts = floorCorners(f);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.ceil(Math.max(...xs) / CELL); i++) {
      for (let j = Math.floor(Math.min(...zs) / CELL); j <= Math.ceil(Math.max(...zs) / CELL); j++) {
        const cx = (i + 0.5) * CELL;
        const cz = (j + 0.5) * CELL;
        if (!insideTile(f, cx, cz)) continue;
        const k = key(i, j, f[2]);
        const prev = cells.get(k);
        cells.set(k, { x: cx, z: cz, layer: f[2], stairs: (prev?.stairs ?? false) || f[6] === 2 });
      }
    }
  }
  const blockers: NavGrid['blockers'] = new Map();
  for (const w of layout.walls ?? []) {
    if (w[5] === 1 || w[5] === 3) continue; // doors and stairs are walkable
    const seg = wallSegment(w);
    const minX = Math.min(seg[0], seg[2]);
    const maxX = Math.max(seg[0], seg[2]);
    const minZ = Math.min(seg[1], seg[3]);
    const maxZ = Math.max(seg[1], seg[3]);
    for (let bx = Math.floor((minX - CELL) / TILE); bx <= Math.floor((maxX + CELL) / TILE); bx++) {
      for (let bz = Math.floor((minZ - CELL) / TILE); bz <= Math.floor((maxZ + CELL) / TILE); bz++) {
        const k = `${w[2]}|${bx}|${bz}`;
        if (!blockers.has(k)) blockers.set(k, []);
        blockers.get(k)!.push(seg);
      }
    }
  }
  return { cells, blockers, links: stairLinks(cells, layout.walls ?? []) };
}

function blocked(g: NavGrid, layer: number, ax: number, az: number, bx: number, bz: number): boolean {
  const segs = g.blockers.get(bucket((ax + bx) / 2, (az + bz) / 2, layer));
  if (!segs) return false;
  const step = [ax, az, bx, bz];
  return segs.some((s) => segmentsCross(step, s));
}

function nearestCell(g: NavGrid, at: Vec3): string | null {
  const l = layerOf(at[1]);
  const i0 = Math.floor(at[0] / CELL);
  const j0 = Math.floor(at[2] / CELL);
  for (let r = 0; r <= 4; r++) {
    for (const dl of [0, -1, 1]) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        for (let j = j0 - r; j <= j0 + r; j++) {
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
          const k = key(i, j, l + dl);
          if (g.cells.has(k)) return k;
        }
      }
    }
  }
  return null;
}

/** Can you walk straight from a to b on one floor: explored floor all the way, no wall in between? */
function clearLine(g: NavGrid, a: Vec3, b: Vec3): boolean {
  const layer = Math.round(a[1] / LAYER_HEIGHT);
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const steps = Math.max(1, Math.ceil(len / (CELL / 2)));
  let px = a[0];
  let pz = a[2];
  for (let s = 1; s <= steps; s++) {
    const x = a[0] + ((b[0] - a[0]) * s) / steps;
    const z = a[2] + ((b[2] - a[2]) * s) / steps;
    if (!g.cells.has(key(Math.floor(x / CELL), Math.floor(z / CELL), layer))) return false;
    if (blocked(g, layer, px, pz, x, z)) return false;
    px = x;
    pz = z;
  }
  return true;
}

export interface Route {
  /** Waypoints [x, y, z] from you to the target. */
  points: Vec3[];
  /** Walking metres. */
  length: number;
  /** Number of floor changes along the way. */
  floorChanges: number;
}

/** Shortest walk over explored floor, or null when the explored map doesn't connect the two. */
export function findRoute(g: NavGrid, from: Vec3, to: Vec3): Route | null {
  const start = nearestCell(g, from);
  const goal = nearestCell(g, to);
  if (!start || !goal) return null;
  const parse = (k: string) => k.split('|').map(Number) as [number, number, number];
  const [, gi, gj] = parse(goal);
  const gl = parse(goal)[0];
  const h = (i: number, j: number, l: number) => Math.hypot(i - gi, j - gj) * CELL + Math.abs(l - gl) * LAYER_HEIGHT;

  const open = new Map<string, number>([[start, 0]]);
  const gScore = new Map<string, number>([[start, 0]]);
  const came = new Map<string, string>();
  let guard = 0;
  while (open.size && guard++ < 60000) {
    let cur = '';
    let best = Infinity;
    for (const [k, f] of open) if (f < best) [best, cur] = [f, k];
    if (cur === goal) break;
    open.delete(cur);
    const [l, i, j] = parse(cur);
    const c = g.cells.get(cur)!;
    const steps: [number, number, number, number][] = [];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (di || dj) steps.push([i + di, j + dj, l, Math.hypot(di, dj) * CELL]);
        if (c.stairs) {
          steps.push([i + di, j + dj, l + 1, Math.hypot(di, dj) * CELL + 2]);
          steps.push([i + di, j + dj, l - 1, Math.hypot(di, dj) * CELL + 2]);
        }
      }
    for (const l2 of g.links.get(cur) ?? []) {
      const [nl, ni, nj] = parse(l2.to);
      steps.push([ni, nj, nl, l2.cost]);
    }
    for (const [ni, nj, nl, cost] of steps) {
      const nk = key(ni, nj, nl);
      const n = g.cells.get(nk);
      if (!n) continue;
      if (nl === l) {
        if (blocked(g, l, c.x, c.z, n.x, n.z)) continue;
        // no corner cutting
        if (ni !== i && nj !== j && (!g.cells.has(key(ni, j, l)) || !g.cells.has(key(i, nj, l)))) continue;
      }
      const t = gScore.get(cur)! + cost;
      if (t < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, t);
        came.set(nk, cur);
        open.set(nk, t + h(ni, nj, nl));
      }
    }
  }
  if (!gScore.has(goal)) return null;

  const keys: string[] = [goal];
  while (keys[0] !== start) keys.unshift(came.get(keys[0])!);
  const pts: Vec3[] = keys.map((k) => {
    const c = g.cells.get(k)!;
    return [c.x, c.layer * LAYER_HEIGHT, c.z];
  });
  // Smooth: from each point, jump to the farthest later point you can walk to in a straight
  // line (same floor, over explored floor, not through a wall).
  const simple: Vec3[] = [from];
  let n = 0;
  while (n < pts.length - 1) {
    let next = n + 1;
    for (let m = pts.length - 1; m > n + 1; m--) {
      if (pts[m][1] === pts[n][1] && clearLine(g, pts[n], pts[m])) {
        next = m;
        break;
      }
    }
    simple.push(pts[next]);
    n = next;
  }
  simple[simple.length - 1] = to;
  let length = 0;
  let floorChanges = 0;
  for (let n = 1; n < pts.length; n++) {
    length += Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][2] - pts[n - 1][2]);
    if (pts[n][1] !== pts[n - 1][1]) floorChanges++;
  }
  return { points: simple, length: Math.round(length), floorChanges };
}
