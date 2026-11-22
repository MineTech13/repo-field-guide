import { describe, expect, it } from 'vitest';
import { planExtraction } from '../src/engine/extraction';
import { applyLive, emptyMemo, memoryFromGame } from '../src/live/apply';
import { defaultRound } from '../src/state/round';
import type { GameStateV1 } from '../src/live/schema';

describe('extraction planner', () => {
  const V = (x: number, z = 0): [number, number, number] => [x, 0, z];

  it('orders: done, active, shortest hop, closest-to-truck last', () => {
    const plan = planExtraction({
      truck: V(0),
      extraction: {
        goalPerPoint: 5000,
        points: [
          { at: V(10), state: 'Idle' }, // closest to the truck → last
          { at: V(100), state: 'Complete' },
          { at: V(60), state: 'Active', current: true },
          { at: V(40), state: 'Idle' },
        ],
      },
    });
    expect(plan.points.map((p) => [p.index, p.role])).toEqual([
      [1, 'done'],
      [2, 'now'],
      [3, 'next'],
      [0, 'last'],
    ]);
  });

  it('sends big items to their closest open extraction and tops up with small ones', () => {
    const plan = planExtraction({
      truck: V(0),
      extraction: {
        goalPerPoint: 5000,
        points: [
          { at: V(0), state: 'Idle' },
          { at: V(50), state: 'Active', current: true },
        ],
      },
      valuables: [
        { name: 'Piano', value: 3000, size: 'Wide', at: V(5) }, // bulky → big, closest is the last point
        { name: 'Diamond', value: 6000, size: 'Tiny', at: V(45) }, // valuable → big
        { name: 'Cup', value: 400, size: 'Small', at: V(30) },
        { name: 'Ring', value: 800, size: 'Tiny', at: V(48) },
        { name: 'Vase', value: 900, size: 'Small', at: V(20) },
        { name: 'Placed', value: 2000, size: 'Small', at: V(50), inHaul: true },
      ],
    });
    const [now, last] = plan.points;
    expect(now.role).toBe('now');
    expect(now.big.map((i) => i.name)).toEqual(['Diamond']);
    // Active already reaches its $5K goal with the Diamond, so no top-ups there.
    expect(now.topUp).toEqual([]);
    expect(last.big.map((i) => i.name)).toEqual(['Piano']);
    // All small ones end up at the last extraction, biggest first.
    expect(last.topUp.map((i) => i.name)).toEqual(['Vase', 'Ring', 'Cup']);
    expect(last.shortfall).toBe(0); // 3000 + 900 + 800 + 400 covers the 5000 goal
    expect(plan.inHaul).toBe(2000);
  });

  it('tops up an extraction that falls short, nearest small items first', () => {
    const plan = planExtraction({
      truck: V(0),
      extraction: { goalPerPoint: 1000, points: [{ at: V(0) }, { at: V(50), current: true, state: 'Active' }] },
      valuables: [
        { name: 'Near', value: 600, size: 'Small', at: V(48) },
        { name: 'Far', value: 600, size: 'Small', at: V(10) },
        { name: 'Next', value: 600, size: 'Small', at: V(40) },
      ],
    });
    expect(plan.points[0].topUp.map((i) => i.name)).toEqual(['Near', 'Next']);
    expect(plan.points[1].topUp.map((i) => i.name)).toEqual(['Far']);
  });

  it('counts height double (other floors are further than they look)', () => {
    const plan = planExtraction({
      extraction: { points: [{ at: [0, 8, 0] }, { at: [12, 0, 0] }] },
      valuables: [{ name: 'X', value: 9000, at: [0, 0, 0] }],
    });
    expect(plan.points.find((p) => p.index === 1)!.big.length).toBe(1);
  });

  it('holds items when no extraction point has been found', () => {
    const plan = planExtraction({ valuables: [{ name: 'X', value: 5, at: [0, 0, 0] }], extraction: { total: 3 } });
    expect(plan.unassigned.map((u) => u.name)).toEqual(['X']);
    expect(plan.notFound).toBe(3);
  });
});

describe('round memory from the game', () => {
  const live: GameStateV1 = {
    v: 1,
    phase: 'level',
    levelsCompleted: 2,
    map: 'Headman Manor',
    playerCount: 3,
    me: { health: 30, maxHealth: 100 },
    team: [{ name: 'a', isLocal: true }, { name: 'b' }, { name: 'c', dead: true }],
    owned: { 'Item Gun Tranq': 1, 'Item Grenade Explosive': 0 },
    players: [{ name: 'a', isLocal: true, upgrades: { Strength: 2 } }],
  };

  it('maps team, health and items', () => {
    expect(memoryFromGame(live)).toEqual({ teamSize: 3, alive: 2, health: 'critical', items: ['strength', 'tranq'] });
  });

  it('keeps a manual edit until the game value changes', () => {
    const first = applyLive(defaultRound(), live, emptyMemo());
    expect(first.state.memory.alive).toBe(2);
    const edited = { ...first.state, memory: { ...first.state.memory, alive: 1 } };
    const same = applyLive(edited, live, first.memo);
    expect(same.state.memory.alive).toBe(1);
    const changed = applyLive(
      edited,
      {
        ...live,
        team: [
          { name: 'a', isLocal: true },
          { name: 'b', dead: true },
          { name: 'c', dead: true },
        ],
      },
      same.memo,
    );
    expect(changed.state.memory.alive).toBe(1);
    expect(changed.memo.lastMem?.alive).toBe(1);
  });
});
