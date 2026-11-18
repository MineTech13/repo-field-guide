import { describe, expect, it } from 'vitest';
import { advise } from '../src/engine/advise';
import { phaseFor } from '../src/engine/rules/phase';
import type { RoundState } from '../src/engine/types';
import { defaultRound, nextLevel, sanitize, toggleSpotted } from '../src/state/round';

const round = (patch: Partial<RoundState> = {}, monsters: string[] = []): RoundState => {
  let s: RoundState = { ...defaultRound(), ...patch };
  for (const id of monsters) s = toggleSpotted(s, id);
  return s;
};

describe('phases', () => {
  it('buckets levels', () => {
    expect(phaseFor(1)).toBe('early');
    expect(phaseFor(3)).toBe('early');
    expect(phaseFor(4)).toBe('mid');
    expect(phaseFor(7)).toBe('mid');
    expect(phaseFor(8)).toBe('late');
    expect(phaseFor(40)).toBe('late');
  });
});

describe('advise', () => {
  it('handles an empty round', () => {
    const a = advise(defaultRound());
    expect(a.score).toBe(0);
    expect(a.label).toBe('Calm');
    expect(a.monsters).toHaveLength(0);
    expect(a.watchOut.some((b) => b.from === 'hint')).toBe(true);
    expect(a.call.title).toBe('Loot freely');
  });

  it('puts the Robe golden rule up front', () => {
    const a = advise(round({}, ['robe']));
    expect(a.watchOut[0].from).toBe('robe');
    expect(a.watchOut[0].severity).toBe('danger');
    expect(a.watchOut[0].text).toMatch(/LOOK/);
  });

  it('flags Huntsman + Banger noise combo', () => {
    const a = advise(round({}, ['huntsman', 'banger']));
    expect(a.combos.map((c) => c.id)).toContain('huntsman-noise');
    expect(a.watchOut[0].from).toBe('combo:huntsman-noise');
  });

  it('does not flag combos for killed monsters', () => {
    let s = round({}, ['huntsman', 'banger']);
    s = { ...s, spotted: s.spotted.map((x) => (x.id === 'banger' ? { ...x, killed: true } : x)) };
    expect(advise(s).combos.map((c) => c.id)).not.toContain('huntsman-noise');
  });

  it('flags displacers on lava maps', () => {
    const a = advise(round({ mapId: 'swiftbroom-academy' }, ['upscream']));
    expect(a.combos.map((c) => c.id)).toContain('displacers-near-edges');
  });

  it('scales with level phase and map hazards', () => {
    const early = advise(round({ mapId: 'museum-of-human-art', level: 1 }, ['clown']));
    const late = advise(round({ mapId: 'museum-of-human-art', level: 9 }, ['clown']));
    expect(late.score).toBeGreaterThan(early.score);
  });

  it('caps the score at 100', () => {
    const all = ['clown', 'robe', 'trudge', 'huntsman', 'loom', 'cleanup-crew', 'reaper', 'headman', 'pony'];
    expect(advise(round({ mapId: 'swiftbroom-academy', level: 15 }, all)).score).toBe(100);
  });

  it('says extract when quota met on a dangerous level', () => {
    const s = round({ level: 8, memory: { ...defaultRound().memory, quotaPct: 110 } }, ['clown', 'trudge', 'robe']);
    expect(advise(s).call.title).toBe('Extract now');
  });

  it('lists usable items and flags no answer for tier 3', () => {
    const s = round({ memory: { ...defaultRound().memory, items: ['tranq'] } }, ['upscream', 'trudge']);
    const a = advise(s);
    const ups = a.monsters.find((m) => m.monster.id === 'upscream')!;
    const tru = a.monsters.find((m) => m.monster.id === 'trudge')!;
    expect(ups.usableItems.map((i) => i.id)).toEqual(['tranq']);
    expect(tru.noAnswer).toBe(true);
  });

  it('warns a last survivor', () => {
    const s = round({ memory: { ...defaultRound().memory, teamSize: 4, alive: 1 } }, []);
    const a = advise(s);
    expect(a.watchOut[0].from).toBe('memory');
    expect(a.call.title).toBe('Survive first');
  });
});

describe('round state', () => {
  it('next level clears monsters and map', () => {
    const s = nextLevel(round({ mapId: 'headman-manor', level: 3 }, ['robe']));
    expect(s.level).toBe(4);
    expect(s.spotted).toHaveLength(0);
    expect(s.mapId).toBeNull();
  });

  it('sanitizes junk storage', () => {
    expect(sanitize('nope').level).toBe(1);
    const s = sanitize({ mapId: 'fake', level: -5, spotted: [{ id: 'robe' }, { id: 'robe' }, { id: 'ghost' }], memory: { items: [1, 'tranq'] } });
    expect(s.mapId).toBeNull();
    expect(s.level).toBe(1);
    expect(s.spotted.map((x) => x.id)).toEqual(['robe']);
    expect(s.memory.items).toEqual(['tranq']);
  });
});
