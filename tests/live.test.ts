import { describe, expect, it } from 'vitest';
import { applyLive, emptyMemo, matchMap, matchMonster } from '../src/live/apply';
import { decodeShareCode } from '../src/live/decode';
import type { GameStateV1 } from '../src/live/schema';
import { defaultRound } from '../src/state/round';

/** Encode like the mod does: base64url(raw DEFLATE(JSON)). */
async function encode(obj: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'RFG1:' + btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const level = (patch: Partial<GameStateV1> = {}): GameStateV1 => ({
  v: 1,
  phase: 'level',
  map: 'Headman Manor',
  levelsCompleted: 3,
  haul: { goal: 10000, current: 2500 },
  seen: [{ key: 'ENEMY.BEAMER', name: 'Clown', tier: 3, spottedYou: true }],
  ...patch,
});

describe('copy code', () => {
  it('round-trips a code made like the mod makes it', async () => {
    const state = level({ seen: [{ key: 'ENEMY.ROBE', name: 'Robe ✓' }] });
    expect(await decodeShareCode(await encode(state))).toEqual(state);
  });

  it('decodes the exact code the C# mod produced', async () => {
    // From mod/src/ShareCode.cs (see the cross-check in the companion's dev notes).
    const code =
      'RFG1:q1YqU7Iy1FEqyEgsTlWyUirOyC9Q0gFSqTlpSlbR1UqZJam5QHFPIKUQWpBelJiSqhCQk1iZWqTgmpdalF4JVF1QlJmc6q1kZVarQ5oGi9pYHaW8xFyQzYfn5B1en5wPVP1ozmSlWgA';
    const s = await decodeShareCode(code);
    expect(s.phase).toBe('shop');
    expect(s.shelf?.map((x) => x.priceK)).toEqual([6, 8]);
  });

  it('rejects junk with a friendly message', async () => {
    await expect(decodeShareCode('hello')).rejects.toThrow(/RFG1/);
    await expect(decodeShareCode('RFG1:@@@')).rejects.toThrow();
  });
});

describe('matching', () => {
  it('maps game names to ours', () => {
    expect(matchMap('Headman Manor')).toBe('headman-manor');
    expect(matchMap('Museum of Human Art')).toBe('museum-of-human-art');
    expect(matchMap('Some Modded Map')).toBeNull();
    expect(matchMonster({ key: 'ENEMY.SNATCHER' })).toBe('pony');
    expect(matchMonster({ name: 'Bombthrower' })).toBe('cleanup-crew');
    expect(matchMonster({ key: 'ENEMY.FREDDY', name: 'Freddy' })).toBeNull();
  });
});

describe('applyLive', () => {
  it('sets map, level, monsters and quota on a new level', () => {
    const r = applyLive(defaultRound(), level(), emptyMemo());
    expect(r.state.mapId).toBe('headman-manor');
    expect(r.state.level).toBe(4);
    expect(r.state.spotted).toEqual([{ id: 'clown', how: 'seen', killed: false }]);
    expect(r.state.memory.quotaPct).toBe(25);
  });

  it('does not re-add a monster the user removed', () => {
    const first = applyLive(defaultRound(), level(), emptyMemo());
    const removed = { ...first.state, spotted: [] };
    const second = applyLive(removed, level(), first.memo);
    expect(second.state.spotted).toEqual([]);
  });

  it('keeps manual map changes until the next level', () => {
    const first = applyLive(defaultRound(), level(), emptyMemo());
    const manual = { ...first.state, mapId: 'swiftbroom-academy' };
    expect(applyLive(manual, level(), first.memo).state.mapId).toBe('swiftbroom-academy');
    const next = applyLive(manual, level({ levelsCompleted: 4, map: 'McJannek Station' }), first.memo);
    expect(next.state.mapId).toBe('mcjannek-station');
    expect(next.state.level).toBe(5);
  });

  it('reports modded monsters as unknown and ignores non-level phases', () => {
    const r = applyLive(defaultRound(), level({ seen: [{ key: 'ENEMY.FREDDY', name: 'Freddy' }] }), emptyMemo());
    expect(r.unknown).toEqual(['Freddy']);
    const shop = applyLive(defaultRound(), { v: 1, phase: 'shop' }, emptyMemo());
    expect(shop.state).toEqual(defaultRound());
  });

  it('follows kills reported by the game', () => {
    const first = applyLive(defaultRound(), level(), emptyMemo());
    const killed = applyLive(first.state, level({ seen: [{ key: 'ENEMY.BEAMER', killed: true, respawnInSec: 120 }] }), first.memo);
    expect(killed.state.spotted[0].killed).toBe(true);
    expect(killed.respawn).toEqual({ clown: 120 });
  });
});

describe('follow the game', () => {
  it('switches pages only when the phase changes', async () => {
    const { routeForPhaseChange } = await import('../src/live/store');
    expect(routeForPhaseChange(null, 'shop')).toBeNull(); // first update after connecting: stay put
    expect(routeForPhaseChange('level', 'level')).toBeNull();
    expect(routeForPhaseChange('level', 'shop')).toBe('#/shop/advisor');
    expect(routeForPhaseChange('shop', 'level')).toBe('#/');
    expect(routeForPhaseChange('level', 'lobby')).toBeNull();
  });
});
