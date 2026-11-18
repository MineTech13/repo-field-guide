import { describe, expect, it } from 'vitest';
import { adviseShop, decodeBuild, encodeBuild, summarizeBuild, upgradeScore, type ShopInput } from '../src/engine/shop';
import { bandFor, respawnTimeAt, spawnCheck } from '../src/engine/spawns';
import { upgradeById } from '../src/data';

const base = (patch: Partial<ShopInput> = {}): ShopInput => ({
  budgetK: 30,
  reserveK: 0,
  mode: 'duo',
  level: 1,
  owned: {},
  ownedItems: [],
  shelf: {},
  ...patch,
});

describe('spawn table', () => {
  it('maps levels to bands', () => {
    expect(bandFor(1)).toMatchObject({ t1: 1, t2: 0, t3: 1 });
    expect(bandFor(4)).toMatchObject({ t1: 1, t2: 1, t3: 1 });
    expect(bandFor(7)).toMatchObject({ t1: 2, t2: 2, t3: 2 });
    expect(bandFor(10)).toMatchObject({ t1: 2, t2: 3, t3: 2 });
    expect(bandFor(25)).toMatchObject({ t1: 2, t2: 3, t3: 3 });
  });

  it('counts what is still unaccounted for', () => {
    const c = spawnCheck(4, [{ id: 'clown', how: 'seen', killed: false }]);
    expect(c.totalExpected).toBe(3);
    expect(c.missing).toBe(2);
    expect(c.tiers.find((t) => t.tier === 3)!.missing).toBe(0);
    expect(c.tiers.find((t) => t.tier === 2)!.candidates.length).toBeGreaterThan(5);
  });

  it('flags overflow (group swap or respawn)', () => {
    const c = spawnCheck(1, [
      { id: 'clown', how: 'seen', killed: false },
      { id: 'robe', how: 'seen', killed: false },
    ]);
    expect(c.overflow).toBe(true);
  });

  it('warns about the jump at level 6', () => {
    expect(spawnCheck(5, []).nextJump?.level).toBe(6);
    expect(spawnCheck(6, []).nextJump).toBeNull();
  });

  it('respawn speeds up over time', () => {
    expect(respawnTimeAt(5)).toBe('4–5 min');
    expect(respawnTimeAt(55)).toBe('~1 second');
  });
});

describe('shop advisor', () => {
  it('never overspends and respects the reserve', () => {
    const a = adviseShop(base({ budgetK: 20, reserveK: 5 }));
    expect(a.spentK).toBeLessThanOrEqual(15);
    expect(a.picks.length).toBeGreaterThan(0);
  });

  it('only buys what is on the shelf when the shelf is set', () => {
    const a = adviseShop(base({ budgetK: 100, shelf: { stamina: { count: 3, priceK: 2 }, health: { count: 1 } } }));
    const ids = a.picks.map((p) => p.id);
    expect(ids.every((id) => id === 'stamina' || id === 'health')).toBe(true);
    expect(a.picks.find((p) => p.id === 'stamina')?.qty).toBe(3);
  });

  it('skips co-op only upgrades in solo', () => {
    const a = adviseShop(base({ mode: 'solo', budgetK: 200, shelf: { 'map-player-count': { count: 1 }, 'death-head-battery': { count: 1 } } }));
    expect(a.picks).toHaveLength(0);
  });

  it('pushes a stun tool when the team has none', () => {
    const a = adviseShop(base({ budgetK: 25, level: 3, shelf: { 'tranq-gun': { count: 1 }, sword: { count: 1 } } }));
    expect(a.picks[0].id).toBe('tranq-gun');
  });

  it('applies diminishing returns', () => {
    const h = upgradeById.get('health')!;
    expect(upgradeScore(h, 'squad', 0)).toBeGreaterThan(upgradeScore(h, 'squad', 4));
  });
});

describe('builder', () => {
  it('round-trips share strings', () => {
    const b = { upgrades: { health: 2, stamina: 3 }, items: ['tranq-gun', 'gun'] };
    expect(decodeBuild(encodeBuild(b))).toEqual(b);
    expect(decodeBuild('u=fake.3,health.x;i=nope')).toEqual({ upgrades: {}, items: [] });
  });

  it('summarizes cost, stats and coverage', () => {
    const s = summarizeBuild({ upgrades: { health: 2 }, items: ['tranq-gun'] });
    expect(s.costMinK).toBe(4 * 2 + 18);
    expect(s.stats.find((x) => x.label === 'Max HP')?.value).toBe('+40');
    expect(s.covered.some((m) => m.id === 'huntsman')).toBe(true);
    expect(s.warnings.some((w) => w.includes('No real damage'))).toBe(true);
  });
});
