/**
 * Data validation. Run with `npm run validate`. CI runs this on every PR so a
 * typo in monsters.json / maps.json / items.json can't break the site.
 */
import { describe, expect, it } from 'vitest';
import { ITEMS, MAPS, MONSTERS, SHOP, SOURCES, SPAWNS } from '../src/data';

const THREATS = ['low', 'medium', 'high', 'lethal'];
const DETECTIONS = ['sight', 'sound', 'light', 'proximity', 'provoked', 'gaze', 'random'];
const TAGS = ['passive', 'noisy', 'loot-breaker', 'displacer', 'grabber', 'group', 'ceiling', 'invisible', 'stay-quiet', 'look-away', 'forces-look', 'after-death'];
const MAP_TAGS = ['dark', 'pits', 'lava', 'open', 'narrow', 'vertical', 'water'];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const unique = (arr: string[]) => new Set(arr).size === arr.length;

describe('monsters.json', () => {
  it('has unique kebab-case ids', () => {
    expect(unique(MONSTERS.map((m) => m.id))).toBe(true);
    for (const m of MONSTERS) expect(m.id, m.id).toMatch(ID);
  });

  it.each(MONSTERS.map((m) => [m.id, m] as const))('%s is complete and valid', (_id, m) => {
    for (const key of ['name', 'emoji', 'hp', 'orb', 'golden', 'tells', 'behavior', 'damage'] as const) {
      expect(typeof m[key] === 'string' && m[key].trim().length > 0, `${m.id}.${key}`).toBe(true);
    }
    expect([1, 2, 3]).toContain(m.tier);
    expect(THREATS).toContain(m.threat);
    expect(['early-access', '0.3.0', '0.5.0']).toContain(m.addedIn);
    expect(m.detection.length).toBeGreaterThan(0);
    for (const d of m.detection) expect(DETECTIONS, `${m.id} detection ${d}`).toContain(d);
    for (const t of m.tags) expect(TAGS, `${m.id} tag ${t}`).toContain(t);
    expect(m.do.length + m.dont.length, `${m.id} needs do/dont`).toBeGreaterThan(0);
    expect(typeof m.counter.kill).toBe('string');
    for (const i of m.counter.items) expect(ITEMS.map((x) => x.id), `${m.id} item ${i}`).toContain(i);
    expect(m.sources.length, `${m.id} needs a source`).toBeGreaterThan(0);
    for (const s of m.sources) expect(Object.keys(SOURCES), `${m.id} source ${s}`).toContain(s);
    expect(typeof m.verified).toBe('boolean');
  });
});

describe('maps.json', () => {
  it('has unique ids', () => expect(unique(MAPS.map((m) => m.id))).toBe(true));

  it.each(MAPS.map((m) => [m.id, m] as const))('%s is complete and valid', (_id, m) => {
    expect(m.id).toMatch(ID);
    for (const t of m.tags) expect(MAP_TAGS).toContain(t);
    for (const p of ['early', 'mid', 'late'] as const) {
      expect(m.hazards[p].length, `${m.id} hazards.${p}`).toBeGreaterThan(0);
      expect(typeof m.hazardWeight[p]).toBe('number');
    }
    for (const s of m.sources) expect(Object.keys(SOURCES)).toContain(s);
  });
});

describe('shop.json', () => {
  const gearIds = ITEMS.map((i) => i.id);
  it('upgrades and items are valid', () => {
    const ids = [...SHOP.upgrades.map((u) => u.id), ...SHOP.items.map((i) => i.id)];
    expect(unique(ids)).toBe(true);
    for (const u of SHOP.upgrades) {
      expect(u.price[0], u.id).toBeLessThanOrEqual(u.price[1]);
      if (u.gear) expect(gearIds, u.id).toContain(u.gear);
      for (const m of ['solo', 'duo', 'squad'] as const) expect(typeof u.priority[m]).toBe('number');
    }
    for (const i of SHOP.items) {
      expect(i.price[0], i.id).toBeLessThanOrEqual(i.price[1]);
      if (i.gear) expect(gearIds, i.id).toContain(i.gear);
      expect(i.phase.length, i.id).toBeGreaterThan(0);
    }
  });
  it('secret shop stock and sources resolve', () => {
    for (const id of SHOP.secretShop.stock) expect(SHOP.items.map((i) => i.id)).toContain(id);
    for (const s of [...SHOP.sources, ...SHOP.secretShop.sources]) expect(Object.keys(SOURCES)).toContain(s);
  });
});

describe('spawns.json', () => {
  it('bands are contiguous from level 1 and open-ended', () => {
    expect(SPAWNS.bands[0].from).toBe(1);
    for (let i = 1; i < SPAWNS.bands.length; i++) expect(SPAWNS.bands[i].from).toBe((SPAWNS.bands[i - 1].to ?? 0) + 1);
    expect(SPAWNS.bands[SPAWNS.bands.length - 1].to).toBeNull();
  });
  it('group swap monsters exist', () => {
    for (const g of SPAWNS.groupSwap.groups) expect(MONSTERS.map((m) => m.id)).toContain(g.id);
    for (const s of SPAWNS.sources) expect(Object.keys(SOURCES)).toContain(s);
  });
});

describe('items.json', () => {
  it('has unique ids and valid targets', () => {
    expect(unique(ITEMS.map((i) => i.id))).toBe(true);
    const ids = MONSTERS.map((m) => m.id);
    for (const i of ITEMS) for (const g of i.goodAgainst) expect(ids, `${i.id} → ${g}`).toContain(g);
  });
});
