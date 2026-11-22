import { describe, expect, it } from 'vitest';
import { decodeBuild, encodeBuild, summarizeBuild } from '../src/engine/shop';
import { adviseShopV2, baseUpgradeScore, defaultPrefs, idForAsset, mapGameUpgrades, upgradePrice, haggleSaving, type AdvisorInput, type TeamMember } from '../src/engine/shopAdvisor';
import { bandFor, respawnTimeAt, spawnCheck } from '../src/engine/spawns';
import { shopItemById, upgradeById } from '../src/data';

describe('spawn table', () => {
  it('maps levels to bands', () => {
    expect(bandFor(1)).toMatchObject({ t1: 1, t2: 0, t3: 1 });
    expect(bandFor(4)).toMatchObject({ t1: 1, t2: 1, t3: 1 });
    expect(bandFor(7)).toMatchObject({ t1: 2, t2: 2, t3: 2 });
    expect(bandFor(9)).toMatchObject({ t1: 2, t2: 3, t3: 2 });
    expect(bandFor(10)).toMatchObject({ t1: 2, t2: 3, t3: 3 });
    expect(bandFor(19)).toMatchObject({ t1: 2, t2: 3, t3: 3 });
    expect(bandFor(25)).toMatchObject({ t1: 3, t2: 4, t3: 4 });
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
    expect(respawnTimeAt(55)).toBe('almost instant');
  });
});

describe('shop advisor', () => {
  const input = (patch: Partial<AdvisorInput> = {}): AdvisorInput => ({
    budgetK: 30,
    reserveK: 0,
    level: 1,
    teamSize: 2,
    owned: {},
    ownedItems: [],
    shelf: [],
    prefs: defaultPrefs(),
    ...patch,
  });

  it('uses the game price formula', () => {
    expect(upgradePrice(6, 1, 0)).toBe(6);
    expect(upgradePrice(6, 2, 0)).toBe(6); // 5.4 → 6
    expect(upgradePrice(10, 3, 0)).toBe(8); // −20%
    expect(upgradePrice(10, 1, 2)).toBe(20); // +50% × 2
    expect(upgradePrice(10, 6, 0)).toBe(5); // −50% at 6 players
  });

  it('never overspends and respects the reserve', () => {
    const a = adviseShopV2(input({ budgetK: 20, reserveK: 5 }));
    expect(a.spentK).toBeLessThanOrEqual(15);
    expect(a.picks.length).toBeGreaterThan(0);
    expect(a.planning).toBe(true);
  });

  it('buys the cheapest copy first and explains buying copies together', () => {
    const shelf = [
      { id: 'stamina', priceK: 8 },
      { id: 'stamina', priceK: 6 },
      { id: 'stamina', priceK: 6 },
    ];
    const a = adviseShopV2(input({ budgetK: 12, shelf }));
    const st = a.picks.find((p) => p.id === 'stamina')!;
    expect(st.prices).toEqual([6, 6]);
    expect(st.reasons.join(' ')).toMatch(/\+50%/);
  });

  it('only buys what is on the shelf', () => {
    const a = adviseShopV2(input({ budgetK: 100, shelf: [{ id: 'health', priceK: 5 }, { id: 'Item Femboy Rifle', priceK: 20 }] }));
    expect(a.picks.map((p) => p.id)).toEqual(['health']);
    expect(a.notes.join(' ')).toMatch(/from other mods/);
  });

  it('skips co-op only upgrades in solo', () => {
    const a = adviseShopV2(input({ teamSize: 1, budgetK: 200, shelf: [{ id: 'map-player-count', priceK: 9 }, { id: 'death-head-battery', priceK: 6 }] }));
    expect(a.picks).toHaveLength(0);
  });

  it('follows preferences: ban, pin and style', () => {
    const shelf = [
      { id: 'sprint', priceK: 6 },
      { id: 'strength', priceK: 6 },
    ];
    const carrier = adviseShopV2(input({ budgetK: 6, shelf, prefs: { ...defaultPrefs(), style: 'carrier' } }));
    expect(carrier.picks[0].id).toBe('strength');
    const scout = adviseShopV2(input({ budgetK: 6, shelf, prefs: { ...defaultPrefs(), style: 'scout' } }));
    expect(scout.picks[0].id).toBe('sprint');
    const banned = adviseShopV2(input({ budgetK: 6, shelf, prefs: { ...defaultPrefs(), style: 'carrier', banned: ['strength'] } }));
    expect(banned.picks.map((p) => p.id)).not.toContain('strength');
    expect(scout.picks[0].reasons.join(' ')).toMatch(/Scout style/);
  });

  it('pushes a stun tool when the team has none', () => {
    const a = adviseShopV2(input({ budgetK: 25, level: 3, shelf: [{ id: 'tranq-gun', priceK: 16 }, { id: 'sword', priceK: 19 }] }));
    expect(a.picks[0].id).toBe('tranq-gun');
  });

  it('suggests who on the team should take an upgrade', () => {
    const team: TeamMember[] = [
      { name: 'Me', isLocal: true, upgrades: { strength: 3 } },
      { name: 'Alex', isLocal: false, upgrades: {} },
    ];
    const a = adviseShopV2(input({ budgetK: 8, shelf: [{ id: 'strength', priceK: 7 }], team, prefs: { ...defaultPrefs(), style: 'carrier' } }));
    expect(a.picks[0].giveTo).toMatch(/^Alex \(has 0\) · you have 3/);
  });

  it('counts the basket as bought', () => {
    const shelf = [
      { id: 'stamina', priceK: 2 },
      { id: 'stamina', priceK: 2 },
      { id: 'tranq-gun', priceK: 16 },
    ];
    const a = adviseShopV2(input({ budgetK: 20, shelf, basket: [{ id: 'tranq-gun', priceK: 16 }], basketTotalK: 16 }));
    expect(a.afterBasketK).toBe(4);
    expect(a.picks.map((p) => p.id)).not.toContain('tranq-gun');
    expect(a.spentK).toBeLessThanOrEqual(4);
    expect(a.notes.join(' ')).toMatch(/basket/);
  });

  it('uses the team inventory: owned gear and unused upgrades', () => {
    const a = adviseShopV2(input({ budgetK: 40, level: 3, shelf: [{ id: 'tranq-gun', priceK: 16 }], inventory: { 'tranq-gun': 1, stamina: 2 } }));
    expect(a.picks.map((p) => p.id)).not.toContain('tranq-gun');
    expect(a.unusedUpgrades).toEqual([{ id: 'stamina', name: 'Stamina', count: 2 }]);
  });

  it('suggests what to show the shopkeeper', () => {
    expect(haggleSaving(3)).toEqual([3, 3]); // ≤ $5K becomes free
    expect(haggleSaving(8)).toEqual([5, 6]); // at least $5K off
    expect(haggleSaving(20)).toEqual([10, 14]); // 50–70%
    const shelf = [
      { id: 'stamina', priceK: 2 },
      { id: 'tranq-gun', priceK: 16 },
      { id: 'health', priceK: 9, rejected: true },
    ];
    const a = adviseShopV2(input({ budgetK: 40, level: 3, shelf, haggleAttemptsLeft: 2 }));
    expect(a.haggle?.best?.id).toBe('tranq-gun');
    expect(a.haggle?.attemptsLeft).toBe(2);
    expect(a.haggle?.freebies).toContain('Stamina');
    expect(adviseShopV2(input({ budgetK: 40, shelf, haggleAttemptsLeft: 0 })).haggle).toBeNull();
  });

  it('only suggests modded items you rated', () => {
    const shelf = [{ id: 'Item Femboy Rifle', priceK: 10 }];
    const extras = { 'Item Femboy Rifle': { name: 'Femboy Rifle', kind: 'item' as const, type: 'gun' } };
    expect(adviseShopV2(input({ budgetK: 40, shelf, extras })).picks).toHaveLength(0);
    const liked = adviseShopV2(input({ budgetK: 40, shelf, extras, prefs: { ...defaultPrefs(), nudge: { 'Item Femboy Rifle': 1 } } }));
    expect(liked.picks[0]).toMatchObject({ id: 'Item Femboy Rifle', name: 'Femboy Rifle' });
  });

  it('applies diminishing returns', () => {
    const h = upgradeById.get('health')!;
    expect(baseUpgradeScore(h, 'squad', 0)).toBeGreaterThan(baseUpgradeScore(h, 'squad', 4));
  });

  it('maps companion data to our ids', () => {
    expect(mapGameUpgrades({ Speed: 2, Launch: 1, Throw: 3 })).toEqual({ sprint: 2, 'tumble-launch': 1 });
    expect(idForAsset('Item Upgrade Player Energy')).toBe('stamina');
    expect(idForAsset('Item Gun Tranq')).toBe('tranq-gun');
    expect(idForAsset('Item Femboy Rifle')).toBeNull();
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
    expect(s.costMinK).toBe(upgradeById.get('health')!.price[0] * 2 + shopItemById.get('tranq-gun')!.price[0]);
    expect(s.stats.find((x) => x.label === 'Max HP')?.value).toBe('+40');
    expect(s.covered.some((m) => m.id === 'huntsman')).toBe(true);
    expect(s.warnings.some((w) => w.includes('No real damage'))).toBe(true);
  });
});
