import { MONSTERS, SHOP, shopItemById, upgradeById } from '../data';
import type { Monster } from '../data/types';

// ===================================================================
// Loadout builder
// ===================================================================

const STUN_GEAR = new Set(['tranq', 'stun']);
const DAMAGE_GEAR = new Set(['firearm', 'sledgehammer', 'grenade', 'mine']);

export interface Build {
  upgrades: Record<string, number>;
  items: string[];
}

export interface BuildSummary {
  costMinK: number;
  costMaxK: number;
  stats: { label: string; value: string }[];
  gear: string[];
  covered: Monster[];
  uncovered: Monster[];
  warnings: string[];
}

export function buildGear(b: Build): string[] {
  const g = new Set<string>();
  for (const id of b.items) {
    const it = shopItemById.get(id);
    if (it?.gear) g.add(it.gear);
  }
  for (const [id, n] of Object.entries(b.upgrades)) {
    const u = upgradeById.get(id);
    if (u?.gear && n > 0) g.add(u.gear);
  }
  return [...g];
}

export function summarizeBuild(b: Build): BuildSummary {
  let min = 0;
  let max = 0;
  const stats: BuildSummary['stats'] = [];
  for (const u of SHOP.upgrades) {
    const n = b.upgrades[u.id] ?? 0;
    if (!n) continue;
    min += u.price[0] * n;
    max += u.price[1] * n;
    if (u.stat) stats.push({ label: u.stat.label, value: `+${u.stat.per * n}${u.stat.unit}` });
    else stats.push({ label: u.name, value: n > 1 ? `×${n}` : '✓' });
  }
  for (const id of b.items) {
    const it = shopItemById.get(id);
    if (!it) continue;
    min += it.price[0];
    max += it.price[1];
  }
  const gear = buildGear(b);
  const big = MONSTERS.filter((m) => m.tier === 3);
  const covered = big.filter((m) => m.counter.items.some((g) => gear.includes(g)));
  const uncovered = big.filter((m) => !covered.includes(m));

  const warnings: string[] = [];
  if (!gear.some((g) => STUN_GEAR.has(g))) warnings.push('No stun tool. Pony can only be grabbed when stunned, and a stun is your panic button against Robe.');
  if (!gear.some((g) => DAMAGE_GEAR.has(g))) warnings.push('No real damage source. Big orb payouts (Clown, Trudge, Reaper) need guns, a sledgehammer or explosives.');
  if ((b.upgrades.health ?? 0) === 0) warnings.push('No Health upgrades. Many tier-3 hits do 100, which is a one-shot at base HP.');
  if ((b.upgrades.sprint ?? 0) > (b.upgrades.stamina ?? 0) + 1) warnings.push('Lots of Sprint Speed but little Stamina. Sprint drains more per upgrade.');
  if ((b.upgrades.range ?? 0) > 8) warnings.push('Range stops improving after 8 upgrades.');
  if ((b.upgrades['map-player-count'] ?? 0) > 1) warnings.push('Map Player Count doesn\'t stack. One is enough.');
  if (b.items.filter((id) => shopItemById.get(id)?.category === 'cart').length > 4) warnings.push('Max 4 carts (2 pocket + 2 big).');

  return { costMinK: min, costMaxK: max, stats, gear, covered, uncovered, warnings };
}

/** Compact share string: "u=health.2,stamina.3;i=tranq-gun,gun" */
export function encodeBuild(b: Build): string {
  const u = Object.entries(b.upgrades)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}.${n}`)
    .join(',');
  return `u=${u};i=${b.items.join(',')}`;
}

export function decodeBuild(s: string | null | undefined): Build {
  const b: Build = { upgrades: {}, items: [] };
  if (!s) return b;
  for (const part of s.split(';')) {
    const [k, v = ''] = part.split('=');
    if (k === 'u') {
      for (const pair of v.split(',').filter(Boolean)) {
        const [id, n] = pair.split('.');
        const num = Math.max(0, Math.min(20, Number(n) || 0));
        if (upgradeById.has(id) && num) b.upgrades[id] = num;
      }
    } else if (k === 'i') {
      b.items = [...new Set(v.split(',').filter((id) => shopItemById.has(id)))];
    }
  }
  return b;
}
