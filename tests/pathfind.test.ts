import { describe, expect, it } from 'vitest';
import { buildGrid, findRoute, floorCorners, wallSegment } from '../src/engine/pathfind';
import { demoState } from '../src/live/demo';
import type { LiveLayout } from '../src/live/schema';

type F = NonNullable<LiveLayout['floors']>[number];
type W = NonNullable<LiveLayout['walls']>[number];
// Map pieces are anchored at a corner (like the game's DirtFinderMapFloor).
const tile = (i: number, j: number, layer = 0, kind = 0): F => [i * 5, j * 5, layer, 0, 1, 1, kind];

describe('route over the explored map', () => {
  // Two rooms side by side (x 0..10 and 10..20, z 0..5), wall between them at x = 10.
  const floors = [tile(0, 0), tile(1, 0), tile(2, 0), tile(3, 0)];
  const wallAt = (kind: number): W => [10, 5, 0, 90, 1, kind]; // runs from z 5 to z 0

  it('wall segments start at the pivot and follow the yaw', () => {
    expect(wallSegment([10, 5, 0, 90, 1, 0]).map((n) => Math.round(n * 10) / 10)).toEqual([10, 5, 10, 0]);
    expect(wallSegment([0, 5, 0, 0, 1, 0]).map((n) => Math.round(n * 10) / 10)).toEqual([0, 5, 5, 5]);
    // Real Museum wall: Wall_1x1 at (22.5, 20), yaw 270 → runs north from z 20 to z 25.
    expect(wallSegment([22.5, 20, 0, 270, 1, 0]).map((n) => Math.round(n * 10) / 10)).toEqual([22.5, 20, 22.5, 25]);
  });

  it('floor pieces are squares anchored at a corner', () => {
    const r = (c: [number, number][]) => c.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    // Real Museum 1x1 at (2.5, -5), yaw 180 → covers x -2.5..2.5, z -10..-5.
    expect(r(floorCorners([2.5, -5, 0, 180, 1, 1, 0]))).toEqual([
      [2.5, -5],
      [-2.5, -5],
      [-2.5, -10],
      [2.5, -10],
    ]);
    // Companion 0.2.7 sent a 0.5x0.5 piece as 1 by 0.5: drawn as a 2.5 m square.
    expect(r(floorCorners([-2.5, 17.5, 0, 0, 1, 0.5, 0]))).toEqual([
      [-2.5, 17.5],
      [0, 17.5],
      [0, 20],
      [-2.5, 20],
    ]);
    // The truck floor keeps its real proportions.
    expect(r(floorCorners([2.3, -26.59, 0, 270, 2.84, 0.9, 3]))).toEqual([
      [2.3, -26.6],
      [2.3, -12.4],
      [-2.2, -12.4],
      [-2.2, -26.6],
    ]);
  });

  it('goes through a door', () => {
    const g = buildGrid({ floors, walls: [wallAt(1)] })!;
    const r = findRoute(g, [2, 0, 2], [18, 0, 2]);
    expect(r).not.toBeNull();
    expect(r!.length).toBeLessThan(20);
  });

  it('never goes through a wall or a blocked door', () => {
    for (const kind of [0, 2]) {
      const g = buildGrid({ floors, walls: [wallAt(kind)] })!;
      const r = findRoute(g, [2, 0, 2], [18, 0, 2]);
      // Only as far as the wall, then straight on: never a full route through it.
      expect(r === null || r.partial).toBe(true);
      if (r) expect(r.points[r.points.length - 2][0]).toBeLessThan(10);
    }
  });

  it('only uses explored floor', () => {
    // Gap at tile 2 (unexplored): no route.
    const g = buildGrid({ floors: [tile(0, 0), tile(1, 0), tile(3, 0)] })!;
    const r = findRoute(g, [2, 0, 2], [18, 0, 2]);
    expect(r === null || r.partial).toBe(true);
  });

  it('takes the stairs to another floor', () => {
    const g = buildGrid({ floors: [tile(0, 0), tile(1, 0, 0, 2), tile(1, 0, 1), tile(2, 0, 1)] })!;
    const r = findRoute(g, [2, 0, 2], [13, 4.5, 2]);
    expect(r).not.toBeNull();
    expect(r!.floorChanges).toBe(1);
  });

  it('climbs a staircase made of "Stairs" map pieces (bottom + top, like the Museum)', () => {
    // Ground floor x 0..15, upper floor (y 8, layer 2) x 20..30. Stairs climb +x from x 10 to 18.
    const floors = [tile(0, 0), tile(1, 0), tile(2, 0), tile(4, 0, 2), tile(5, 0, 2)];
    const walls: W[] = [
      [10, 5, 0, 90, 1, 3], // bottom piece: pivot edge at x 10, 5 m wide (right = -z), climbs +x
      [14, 5, 1, 90, 1, 3], // top piece: starts 4 m on, one storey up
    ];
    const g = buildGrid({ floors, walls })!;
    const r = findRoute(g, [2, 0, 2], [27, 8, 2]);
    expect(r).not.toBeNull();
    expect(r!.floorChanges).toBe(1);
    // The route heads for the foot of the stairs first.
    expect(r!.points[1][0]).toBeGreaterThan(8);
    expect(r!.points[1][1]).toBe(0);
  });

  it('steps between map floors that meet edge to edge (ramps the map does not mark)', () => {
    // Ground floor x 0..10, a lower floor x 10..20 (layer -1), ground again x 20..25.
    const floors = [tile(0, 0), tile(1, 0), tile(2, 0, -1), tile(3, 0, -1), tile(4, 0)];
    const r = findRoute(buildGrid({ floors })!, [2, 0, 2], [23, 0, 2]);
    expect(r).not.toBeNull();
    expect(r!.partial).toBeFalsy();
    expect(r!.floorChanges).toBe(2);
  });

  it('a balcony over a room is not a way down', () => {
    // Room x 0..10 on the ground; a balcony (layer 1) over x 5..10. The balcony edge lies over the room.
    const floors = [tile(0, 0), tile(1, 0), tile(1, 0, 1)];
    const r = findRoute(buildGrid({ floors })!, [7, 4.5, 2], [2, 0, 2]);
    expect(r === null || r.partial).toBe(true);
  });

  it('gets as close as it can when the way is not explored', () => {
    const floors = [tile(0, 0), tile(1, 0)];
    const r = findRoute(buildGrid({ floors })!, [2, 0, 2], [30, 0, 2]);
    expect(r?.partial).toBe(true);
    expect(r!.points[r!.points.length - 1]).toEqual([30, 0, 2]);
  });

  it('demo level: walks from the truck upstairs once it is explored', () => {
    const layout = demoState(110).layout!;
    const g = buildGrid(layout)!;
    const r = findRoute(g, [0, 0, -5], [-33, 4.5, 2]);
    expect(r).not.toBeNull();
    expect(r!.floorChanges).toBeGreaterThan(0);
  });
});
