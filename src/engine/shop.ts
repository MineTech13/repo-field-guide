import { MONSTERS, SHOP, shopItemById, upgradeById } from '../data';
import type { Monster, Phase, ShopItem, TeamMode, Upgrade } from '../data/types';
import { phaseFor } from './rules/phase';
import { bandFor } from './spawns';

// ===================================================================
// Shop advisor
// ===================================================================

export interface ShopInput {
  /** Team surplus available, in $K. */
  budgetK: number;
  /** Keep this much ($K) unspent as a safety reserve. */
  reserveK: number;
  mode: TeamMode;
  /** The level you just finished (the shop sits between levels). */
  level: number;
  /** Upgrades the buying player already has. */
  owned: Record<string, number>;
  /** Shop items the team already owns (weapons/tools persist). */
  ownedItems: string[];
  /**
   * What's on the shelf: id → count. Empty = planning mode (assume anything can show up).
   * Prices on the shelf override the guide price.
   */
  shelf: Record<string, { count: number; priceK?: number }>;
  /** From the round helper: is anybody hurt? */
  hurt?: boolean;
}

export interface Pick {
  kind: 'upgrade' | 'item';
  id: string;
  name: string;
  emoji: string;
  qty: number;
  costK: number;
  reason: string;
}

export interface ShopAdvice {
  picks: Pick[];
  spentK: number;
  leftK: number;
  notes: string[];
  skipped: { name: string; reason: string }[];
  nextLevel: number;
  nextPhase: Phase;
}

const STUN_GEAR = new Set(['tranq', 'stun']);
const DAMAGE_GEAR = new Set(['firearm', 'sledgehammer', 'grenade', 'mine']);

/** Price to plan with: the shelf price if known, else the top of the guide range (conservative). */
const planPrice = (id: string, range: [number, number], input: ShopInput) => input.shelf[id]?.priceK ?? range[1];

export function upgradeScore(u: Upgrade, mode: TeamMode, owned: number): number {
  const base = u.priority[mode];
  if (base <= 0) return 0;
  const over = owned - u.diminishAfter + 1;
  const dim = over > 0 ? Math.pow(0.55, over) : 1;
  const cheapBonus = u.price[1] <= 3 ? 1.5 : 0;
  return base * dim + cheapBonus;
}

export function adviseShop(input: ShopInput): ShopAdvice {
  const nextLevel = input.level + 1;
  const nextPhase = phaseFor(nextLevel);
  const nowBand = bandFor(input.level);
  const nextBand = bandFor(nextLevel);
  const spike = nextBand.t3 > nowBand.t3 || nextBand.t2 > nowBand.t2 + 1;
  const planning = Object.keys(input.shelf).length === 0;
  const onShelf = (id: string) => planning || (input.shelf[id]?.count ?? 0) > 0;

  const owned = { ...input.owned };
  const ownedItems = new Set(input.ownedItems);
  const bought: Record<string, number> = {};
  const skipped: ShopAdvice['skipped'] = [];
  const notes: string[] = [];
  let budget = Math.max(0, input.budgetK - input.reserveK);

  const gearOwned = () => {
    const g = new Set<string>();
    for (const id of ownedItems) {
      const it = shopItemById.get(id);
      if (it?.gear) g.add(it.gear);
    }
    return g;
  };

  // --- notes about the coming level
  notes.push(
    `Next up: level ${nextLevel} (${nextPhase}) spawns about ${nextBand.t1}× tier-1, ${nextBand.t2}× tier-2 and ${nextBand.t3}× tier-3 monsters.`,
  );
  if (spike) notes.push('⚠ Monster count jumps next level. Prioritise survival (Health, a stun tool, healing) over luxury picks.');
  if (input.mode === 'solo') notes.push('Solo: Map Player Count and Death Head Battery are not sold. Strength matters more, because nobody helps you lift.');
  if (input.mode !== 'solo') notes.push('Upgrades only boost the player who uses them. Split them by role (carrier gets Strength, scout gets Health and Stamina).');

  const itemScore = (it: ShopItem): number => {
    if (ownedItems.has(it.id) && it.category !== 'health' && it.category !== 'explosive' && it.id !== 'energy-crystal') return 0;
    if (!it.phase.includes(nextPhase)) return 0;
    const gear = gearOwned();
    let s = it.rating * 0.85;
    if (it.gear && STUN_GEAR.has(it.gear) && ![...gear].some((g) => STUN_GEAR.has(g))) s += 3;
    if (it.gear && DAMAGE_GEAR.has(it.gear) && nextPhase !== 'early' && ![...gear].some((g) => DAMAGE_GEAR.has(g))) s += 2;
    if (it.gear && gear.has(it.gear) && it.category !== 'explosive' && it.category !== 'health') s -= 3; // already covered
    if (it.category === 'health') s += (input.hurt ? 3 : 0) + (spike ? 1.5 : 0) - 1.5;
    if (it.category === 'explosive' && spike) s += 1;
    if (it.category === 'cart' && [...ownedItems].some((id) => shopItemById.get(id)?.category === 'cart')) s -= 4;
    if (it.category === 'drone') s -= 1.5;
    if (it.id === 'energy-crystal' && ![...ownedItems].some((id) => ['ranged', 'melee'].includes(shopItemById.get(id)?.category ?? ''))) return 0;
    return Math.max(0, s);
  };

  const reasonForItem = (it: ShopItem) => {
    const gear = gearOwned();
    if (it.gear && STUN_GEAR.has(it.gear) && ![...gear].some((g) => STUN_GEAR.has(g)))
      return `You have no stun tool yet. A stun answers most tier-3 monsters. ${it.effect}`;
    if (it.gear && DAMAGE_GEAR.has(it.gear) && ![...gear].some((g) => DAMAGE_GEAR.has(g)))
      return `Adds real damage for the bigger monsters ahead. ${it.effect}`;
    if (it.category === 'health') return input.hurt ? `Your team is hurt. ${it.effect}` : `Cheap insurance before a harder level. ${it.effect}`;
    return it.effect;
  };

  // --- greedy: repeatedly buy the best-scoring affordable thing
  for (let guard = 0; guard < 20; guard++) {
    type Cand = { kind: 'upgrade' | 'item'; id: string; score: number; price: number };
    const cands: Cand[] = [];
    for (const u of SHOP.upgrades) {
      if (!onShelf(u.id)) continue;
      const have = owned[u.id] ?? 0;
      const boughtNow = bought[u.id] ?? 0;
      if (!planning && boughtNow >= (input.shelf[u.id]?.count ?? 0)) continue;
      if (planning && boughtNow >= 3) continue;
      if (u.coopOnly && input.mode === 'solo') continue;
      if (u.cap != null && have >= u.cap) continue;
      const score = upgradeScore(u, input.mode, have);
      if (score > 0) cands.push({ kind: 'upgrade', id: u.id, score, price: planPrice(u.id, u.price, input) });
    }
    for (const it of SHOP.items) {
      if (!onShelf(it.id)) continue;
      const boughtNow = bought[it.id] ?? 0;
      const maxQty = it.category === 'explosive' || it.category === 'health' ? (planning ? 2 : input.shelf[it.id]?.count ?? 0) : 1;
      if (boughtNow >= maxQty) continue;
      const score = itemScore(it) - boughtNow * 2;
      if (score > 0) cands.push({ kind: 'item', id: it.id, score, price: planPrice(it.id, it.price, input) });
    }
    cands.sort((a, b) => b.score - a.score || a.price - b.price);
    const pick = cands.find((c) => c.price <= budget && c.score >= 3);
    if (!pick) {
      const best = cands[0];
      if (best && best.price > budget) {
        const name = best.kind === 'upgrade' ? upgradeById.get(best.id)!.name : shopItemById.get(best.id)!.name;
        skipped.push({ name, reason: `Top pick, but costs ~$${best.price}K. Save up for it.` });
      }
      break;
    }
    budget -= pick.price;
    bought[pick.id] = (bought[pick.id] ?? 0) + 1;
    if (pick.kind === 'upgrade') owned[pick.id] = (owned[pick.id] ?? 0) + 1;
    else ownedItems.add(pick.id);
  }

  // --- collapse to picks (keep first-bought order by score)
  const picks: Pick[] = [];
  for (const [id, qty] of Object.entries(bought)) {
    const u = upgradeById.get(id);
    if (u) {
      picks.push({ kind: 'upgrade', id, name: u.name, emoji: u.emoji, qty, costK: planPrice(id, u.price, input) * qty, reason: u.why });
      continue;
    }
    const it = shopItemById.get(id)!;
    picks.push({ kind: 'item', id, name: it.name, emoji: it.emoji, qty, costK: planPrice(id, it.price, input) * qty, reason: reasonForItem(it) });
  }

  // things on the shelf worth flagging as skips
  for (const u of SHOP.upgrades) {
    if (!planning && !input.shelf[u.id]?.count) continue;
    if (u.coopOnly && input.mode === 'solo') continue;
    if (u.teamUnique && (input.owned[u.id] ?? 0) >= 1 && !planning) skipped.push({ name: u.name, reason: 'Your team already has it, and it doesn\'t stack.' });
  }

  const spentK = picks.reduce((a, p) => a + p.costK, 0);
  if (planning) notes.push('Planning mode: prices use the top of each guide range. Tick what\'s actually on the shelf for an exact list.');
  return { picks, spentK, leftK: Math.max(0, input.budgetK - spentK), notes, skipped, nextLevel, nextPhase };
}

// ===================================================================
// Loadout builder
// ===================================================================

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
