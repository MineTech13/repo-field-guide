import { describe, expect, it } from 'vitest';
import { buildGrid, findRoute, wallSegment } from '../src/engine/pathfind';
import { demoState } from '../src/live/demo';
import type { LiveLayout } from '../src/live/schema';

type F = NonNullable<LiveLayout['floors']>[number];
type W = NonNullable<LiveLayout['walls']>[number];
const tile = (i: number, j: number, layer = 0, kind = 0): F => [i * 5 + 2.5, j * 5 + 2.5, layer, 0, 1, 1, kind];

describe('route over the explored map', () => {
  // Two rooms side by side (x 0..10 and 10..20, z 0..5), wall between them at x = 10.
  const floors = [tile(0, 0), tile(1, 0), tile(2, 0), tile(3, 0)];
  const wallAt = (kind: number): W => [10, 2.5, 0, 90, 1, kind];

  it('wall segments follow the yaw', () => {
    expect(wallSegment([10, 2.5, 0, 90, 1, 0]).map((n) => Math.round(n * 10) / 10)).toEqual([10, 5, 10, 0]);
    expect(wallSegment([2.5, 5, 0, 0, 1, 0]).map((n) => Math.round(n * 10) / 10)).toEqual([0, 5, 5, 5]);
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
      expect(findRoute(g, [2, 0, 2], [18, 0, 2])).toBeNull();
    }
  });

  it('only uses explored floor', () => {
    // Gap at tile 2 (unexplored): no route.
    const g = buildGrid({ floors: [tile(0, 0), tile(1, 0), tile(3, 0)] })!;
    expect(findRoute(g, [2, 0, 2], [18, 0, 2])).toBeNull();
  });

  it('takes the stairs to another floor', () => {
    const g = buildGrid({ floors: [tile(0, 0), tile(1, 0, 0, 2), tile(1, 0, 1), tile(2, 0, 1)] })!;
    const r = findRoute(g, [2, 0, 2], [13, 4.5, 2]);
    expect(r).not.toBeNull();
    expect(r!.floorChanges).toBe(1);
  });

  it('demo level: walks from the truck upstairs once it is explored', () => {
    const layout = demoState(110).layout!;
    const g = buildGrid(layout)!;
    const r = findRoute(g, [0, 0, -5], [-33, 4.5, 2]);
    expect(r).not.toBeNull();
    expect(r!.floorChanges).toBeGreaterThan(0);
  });
});
