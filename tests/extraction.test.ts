import { describe, expect, it } from 'vitest';
import { planExtraction } from '../src/engine/extraction';
import { applyLive, emptyMemo, memoryFromGame } from '../src/live/apply';
import { defaultRound } from '../src/state/round';
import type { GameStateV1 } from '../src/live/schema';

describe('extraction planner', () => {
  const layout = {
    extraction: {
      goalPerPoint: 5000,
      points: [
        { at: [0, 0, 0] as [number, number, number], state: 'Idle' },
        { at: [50, 0, 0] as [number, number, number], state: 'Active', current: true },
        { at: [100, 0, 0] as [number, number, number], state: 'Complete' },
      ],
    },
    valuables: [
      { name: 'Small', value: 1000, at: [45, 0, 0] as [number, number, number] },
      { name: 'Big', value: 9000, at: [5, 0, 0] as [number, number, number] },
      { name: 'NearDone', value: 3000, at: [98, 0, 0] as [number, number, number] },
      { name: 'Already', value: 2000, at: [50, 0, 0] as [number, number, number], inHaul: true },
    ],
  };

  it('sends each item to its closest open extraction, biggest first', () => {
    const plan = planExtraction(layout);
    expect(plan.points[0].items.map((i) => i.name)).toEqual(['Big']);
    // The completed point is skipped, so its nearby item goes to the next closest open one.
    expect(plan.points[1].items.map((i) => i.name)).toEqual(['NearDone', 'Small']);
    expect(plan.points[2].items).toEqual([]);
    expect(plan.inHaul).toBe(2000);
    expect(plan.points[1].planned).toBe(4000);
  });

  it('counts height double (other floors are further than they look)', () => {
    const plan = planExtraction({
      extraction: { points: [{ at: [0, 8, 0] }, { at: [12, 0, 0] }] },
      valuables: [{ name: 'X', value: 1, at: [0, 0, 0] }],
    });
    expect(plan.points[1].items.length).toBe(1);
  });

  it('holds items when no extraction point has been found', () => {
    const plan = planExtraction({ valuables: [{ name: 'X', value: 5, at: [0, 0, 0] }] });
    expect(plan.unassigned.map((u) => u.name)).toEqual(['X']);
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
    const changed = applyLive(edited, { ...live, team: [{ name: 'a', isLocal: true }, { name: 'b', dead: true }, { name: 'c', dead: true }] }, same.memo);
    expect(changed.state.memory.alive).toBe(1);
    expect(changed.memo.lastMem?.alive).toBe(1);
  });
});
