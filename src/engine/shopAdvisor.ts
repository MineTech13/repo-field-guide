import { SHOP, shopItemById, upgradeById } from '../data';
import type { Phase, ShopItem, TeamMode, Upgrade } from '../data/types';
import { phaseFor } from './rules/phase';
import { bandFor } from './spawns';

// ===================================================================
// Preferences
// ===================================================================

export type Style = 'balanced' | 'carrier' | 'scout' | 'fighter' | 'support';

export interface ShopPrefs {
  style: Style;
  /** Per upgrade/item: −2 (avoid) … +2 (favour). */
  nudge: Record<string, number>;
  /** Always suggest when affordable. */
  pinned: string[];
  /** Never suggest. */
  banned: string[];
  /** −2 (favour gear) … +2 (favour upgrades). */
  gearBias: number;
}

export const defaultPrefs = (): ShopPrefs => ({ style: 'balanced', nudge: {}, pinned: [], banned: [], gearBias: 0 });

export const STYLES: { id: Style; label: string; blurb: string }[] = [
  { id: 'balanced', label: 'Balanced', blurb: 'A bit of everything, following the guide.' },
  { id: 'carrier', label: 'Carrier', blurb: 'You haul the loot: strength, reach, carts.' },
  { id: 'scout', label: 'Scout', blurb: 'You run ahead: stamina, speed, jumps.' },
  { id: 'fighter', label: 'Fighter', blurb: 'You deal with monsters: health, stuns, weapons.' },
  { id: 'support', label: 'Support', blurb: 'You keep the team alive: revive, reach, map info.' },
];

/** Score bonus per style. Keys are upgrade/item ids, or "gear:<gear>" for weapon groups. */
const STYLE_BONUS: Record<Style, Record<string, number>> = {
  balanced: {},
  carrier: { strength: 3, range: 2, stamina: 1, 'pocket-cart': 2, cart: 1, 'feather-drone': 2, 'indestructible-drone': 2 },
  scout: { stamina: 2, sprint: 3, 'extra-jump': 2, 'tumble-launch': 2, 'tumble-wings': 1, 'valuable-tracker': 2, 'extraction-tracker': 1 },
  fighter: { health: 2, strength: 1, 'gear:tranq': 2, 'gear:stun': 2, 'gear:firearm': 2, 'gear:sledgehammer': 2, 'gear:grenade': 1, 'gear:mine': 1 },
  support: { range: 2, health: 1, 'map-player-count': 3, 'death-head-battery': 2, defibro: 4, 'health-medium': 1, 'health-large': 1 },
};

// ===================================================================
// Prices (the game's own formula, see ShopManager in the game code)
// ===================================================================

const mid = (p: [number, number]) => (p[0] + p[1]) / 2;

/** Upgrade: −10% per extra player (max 6), then +50% per upgrade of this type the team bought. */
export function upgradePrice(base: number, teamSize: number, teamBought: number): number {
  const n = Math.min(6, Math.max(1, teamSize));
  let v = base - base * 0.1 * (n - 1);
  v += v * 0.5 * teamBought;
  return Math.ceil(v);
}

/** Health pack: −10% per extra player, +5% per level completed (max 15). Crystal: +20% per level completed (max 15). */
export function itemPrice(item: ShopItem, base: number, teamSize: number, levelsCompleted: number): number {
  const lc = Math.min(15, Math.max(0, levelsCompleted));
  if (item.category === 'health') {
    const n = Math.min(6, Math.max(1, teamSize));
    let v = base - base * 0.1 * (n - 1);
    v += v * 0.05 * lc;
    return Math.ceil(v);
  }
  if (item.id === 'energy-crystal') return Math.ceil(base + base * 0.2 * lc);
  return Math.ceil(base);
}

// ===================================================================
// Advisor
// ===================================================================

export interface ShelfCopy {
  /** Our id, or the game asset name for items the guide doesn't know (other mods). */
  id: string;
  priceK: number;
  fromGame?: boolean;
  /** Shopkeeper already gave a discount on this copy / turned it down. */
  discounted?: boolean;
  rejected?: boolean;
}

/** Items the guide doesn't know (other mods), described by the game. */
export interface ExtraItem {
  name: string;
  kind: 'upgrade' | 'item';
  type?: string;
}

/** Shopkeeper haggling: 3 tries per visit, 1 in 3 is liked → 50–70% off, at least $5K off. */
export const HAGGLE = { attempts: 3, chance: 1 / 3, min: 0.5, max: 0.7, minOffK: 5 } as const;

export function haggleSaving(priceK: number): [number, number] {
  const lo = Math.min(priceK, Math.max(Math.ceil(priceK * HAGGLE.min), HAGGLE.minOffK));
  const hi = Math.min(priceK, Math.max(Math.ceil(priceK * HAGGLE.max), HAGGLE.minOffK));
  return [lo, hi];
}

export interface TeamMember {
  name: string;
  isLocal: boolean;
  /** Upgrade counts by our upgrade id. */
  upgrades: Record<string, number>;
}

export interface AdvisorInput {
  budgetK: number;
  reserveK: number;
  /** The level just cleared (the shop sits between levels). */
  level: number;
  teamSize: number;
  /** Your upgrades, by upgrade id. */
  owned: Record<string, number>;
  /** Team-wide purchases per upgrade id (drives the +50% step). Defaults to the team's upgrades, or yours. */
  teamBought?: Record<string, number>;
  /** Weapons/tools the team already has (kept between levels). */
  ownedItems: string[];
  /** What's on the shelf, one entry per copy. Empty = planning mode. */
  shelf: ShelfCopy[];
  team?: TeamMember[];
  hurt?: boolean;
  prefs: ShopPrefs;
  /** Copies already in the checkout area (counted as bought). */
  basket?: ShelfCopy[];
  basketTotalK?: number;
  /** Team inventory by our id or asset: owned items + bought-but-unused upgrades. */
  inventory?: Record<string, number>;
  /** Haggling attempts left this visit (from the companion). */
  haggleAttemptsLeft?: number;
  /** Names/kinds for ids the guide doesn't know (modded items). */
  extras?: Record<string, ExtraItem>;
}

export interface AdvicePick {
  kind: 'upgrade' | 'item';
  id: string;
  name: string;
  emoji: string;
  qty: number;
  costK: number;
  prices: number[];
  reasons: string[];
  /** Team split hint for upgrades. */
  giveTo?: string;
}

export interface ShopAdviceV2 {
  picks: AdvicePick[];
  spentK: number;
  leftK: number;
  notes: string[];
  skipped: { name: string; reason: string }[];
  nextLevel: number;
  nextPhase: Phase;
  planning: boolean;
  /** Money left after paying for the basket. */
  afterBasketK: number;
  basket: { id: string; name: string; priceK: number }[];
  unusedUpgrades: { id: string; name: string; count: number }[];
  haggle: {
    attemptsLeft: number | null;
    /** Best copy to show the shopkeeper (most expensive planned buy). */
    best: { id: string; name: string; priceK: number; save: [number, number] } | null;
    /** Planned buys of $5K or less: free if he likes them. */
    freebies: string[];
  } | null;
}

const STUN_GEAR = new Set(['tranq', 'stun']);
const DAMAGE_GEAR = new Set(['firearm', 'sledgehammer', 'grenade', 'mine']);
const CONSUMABLE = (it: ShopItem) => it.category === 'health' || it.category === 'explosive' || it.id === 'energy-crystal';

export const modeFor = (teamSize: number): TeamMode => (teamSize <= 1 ? 'solo' : teamSize === 2 ? 'duo' : 'squad');

/** Guide priority for an upgrade with diminishing returns (no preferences applied). */
export function baseUpgradeScore(u: Upgrade, mode: TeamMode, owned: number): number {
  const base = u.priority[mode];
  if (base <= 0) return 0;
  const over = owned - u.diminishAfter + 1;
  const dim = over > 0 ? Math.pow(0.55, over) : 1;
  const cheapBonus = u.price[1] <= 3 ? 1.5 : 0;
  return base * dim + cheapBonus;
}

interface Scored {
  score: number;
  reasons: string[];
}

function prefScore(id: string, gear: string | null, kind: 'upgrade' | 'item', prefs: ShopPrefs, name: string): Scored {
  let score = 0;
  const reasons: string[] = [];
  const styleBonus = (STYLE_BONUS[prefs.style][id] ?? 0) + (gear ? STYLE_BONUS[prefs.style][`gear:${gear}`] ?? 0 : 0);
  if (styleBonus > 0) {
    score += styleBonus;
    reasons.push(`fits your ${STYLES.find((s) => s.id === prefs.style)!.label} style`);
  }
  const n = prefs.nudge[id] ?? 0;
  if (n !== 0) {
    score += n * 2;
    reasons.push(n > 0 ? `you favour ${name}` : `you rate ${name} lower`);
  }
  if (prefs.pinned.includes(id)) {
    score += 6;
    reasons.push('pinned by you');
  }
  if (prefs.gearBias !== 0) score += (kind === 'upgrade' ? 1 : -1) * prefs.gearBias * 0.8;
  return { score, reasons };
}

export function adviseShopV2(input: AdvisorInput): ShopAdviceV2 {
  const { prefs } = input;
  const mode = modeFor(input.teamSize);
  const nextLevel = input.level + 1;
  const nextPhase = phaseFor(nextLevel);
  const nowBand = bandFor(input.level);
  const nextBand = bandFor(nextLevel);
  const spike = nextBand.t3 > nowBand.t3 || nextBand.t2 > nowBand.t2;
  const planning = input.shelf.length === 0;
  const levelsCompleted = input.level; // the shop comes after clearing `level`

  const owned = { ...input.owned };
  const teamBought: Record<string, number> = { ...(input.teamBought ?? teamTotals(input.team) ?? input.owned) };
  const ownedItems = new Set(input.ownedItems);
  const bought: Record<string, number[]> = {};
  const extraReasons: Record<string, string[]> = {};
  const skipped: ShopAdviceV2['skipped'] = [];
  const notes: string[] = [];
  const extras = input.extras ?? {};
  const known = (id: string) => upgradeById.has(id) || shopItemById.has(id);
  const nameOf = (id: string) => upgradeById.get(id)?.name ?? shopItemById.get(id)?.name ?? extras[id]?.name ?? id;

  // Team inventory: owned gear counts as owned; bought-but-unused upgrades were already paid for,
  // so they count toward the +50% price step.
  const unusedUpgrades: ShopAdviceV2['unusedUpgrades'] = [];
  for (const [id, count] of Object.entries(input.inventory ?? {})) {
    if (count <= 0) continue;
    if (upgradeById.has(id)) {
      unusedUpgrades.push({ id, name: nameOf(id), count });
      if (!input.teamBought) teamBought[id] = (teamBought[id] ?? 0) + count;
    } else ownedItems.add(id);
  }

  // Copies available: from the shelf (fixed prices), or estimated in planning mode.
  const shelfLeft = new Map<string, ShelfCopy[]>();
  for (const c of input.shelf) shelfLeft.set(c.id, [...(shelfLeft.get(c.id) ?? []), c].sort((a, b) => a.priceK - b.priceK));

  // The basket is as good as bought: pay for it, take those copies off the shelf.
  const basket = (input.basket ?? []).map((c) => ({ id: c.id, name: nameOf(c.id), priceK: c.priceK }));
  const basketTotal = input.basketTotalK ?? basket.reduce((a, c) => a + c.priceK, 0);
  for (const c of basket) {
    const left = shelfLeft.get(c.id);
    const i = left?.findIndex((x) => x.priceK === c.priceK) ?? -1;
    if (left && i >= 0) left.splice(i, 1);
    if (upgradeById.has(c.id)) owned[c.id] = (owned[c.id] ?? 0) + 1;
    else ownedItems.add(c.id);
  }
  const afterBasketK = Math.max(0, input.budgetK - basketTotal);
  let budget = Math.max(0, afterBasketK - input.reserveK);
  if (basket.length) notes.push(`Your basket ($${basketTotal}K) is counted as bought: $${afterBasketK}K left to spend.`);
  if (unusedUpgrades.length)
    notes.push(
      `Unused upgrades in the truck: ${unusedUpgrades.map((u) => `${u.name} ×${u.count}`).join(', ')}. Until someone uses them they keep that upgrade off the shelf.`,
    );

  const gearOwned = () => {
    const g = new Set<string>();
    for (const id of ownedItems) {
      const it = shopItemById.get(id);
      if (it?.gear) g.add(it.gear);
    }
    return g;
  };

  notes.push(`Next up: level ${nextLevel} spawns about ${nextBand.t1}× tier-1, ${nextBand.t2}× tier-2 and ${nextBand.t3}× tier-3 monsters.`);
  if (spike) notes.push('⚠ More monsters next level. Survival first: Health, a stun tool, healing.');
  if (mode === 'solo') notes.push('Solo: Map Player Count and Death Head Battery are never in the shop.');
  else notes.push('Upgrades only help whoever uses them, and the +50% price step counts the whole team’s purchases.');
  if (planning)
    notes.push(
      `Planning mode: prices are estimates using the game’s formula (team of ${input.teamSize}, level ${levelsCompleted} cleared). Enter or import the shelf for exact prices.`,
    );

  const scoreUpgrade = (u: Upgrade): Scored => {
    const have = owned[u.id] ?? 0;
    const base = baseUpgradeScore(u, mode, have);
    if (base <= 0 && !prefs.pinned.includes(u.id)) return { score: 0, reasons: [] };
    const p = prefScore(u.id, u.gear, 'upgrade', prefs, u.name);
    return { score: base + p.score, reasons: p.reasons };
  };

  const scoreItem = (it: ShopItem): Scored => {
    if (ownedItems.has(it.id) && !CONSUMABLE(it)) return { score: 0, reasons: [] };
    if (!it.phase.includes(nextPhase) && !prefs.pinned.includes(it.id)) return { score: 0, reasons: [] };
    const gear = gearOwned();
    const reasons: string[] = [];
    let s = it.rating * 0.85;
    if (it.gear && STUN_GEAR.has(it.gear) && ![...gear].some((g) => STUN_GEAR.has(g))) {
      s += 3;
      reasons.push('you have no stun tool yet');
    }
    if (it.gear && DAMAGE_GEAR.has(it.gear) && nextPhase !== 'early' && ![...gear].some((g) => DAMAGE_GEAR.has(g))) {
      s += 2;
      reasons.push('adds real damage for bigger monsters');
    }
    if (it.gear && gear.has(it.gear) && !CONSUMABLE(it)) s -= 3;
    if (it.category === 'health') {
      s += (input.hurt ? 3 : 0) + (spike ? 1.5 : 0) - 1.5;
      if (input.hurt) reasons.push('your team is hurt');
    }
    if (it.category === 'explosive' && spike) s += 1;
    if (it.category === 'cart' && [...ownedItems].some((id) => shopItemById.get(id)?.category === 'cart')) s -= 4;
    if (it.category === 'drone') s -= 1.5;
    if (it.id === 'defibro' && mode === 'solo') s -= 8;
    if (it.id === 'energy-crystal' && ![...ownedItems].some((id) => ['ranged', 'melee'].includes(shopItemById.get(id)?.category ?? '')))
      return { score: 0, reasons: [] };
    const p = prefScore(it.id, it.gear, 'item', prefs, it.name);
    return { score: Math.max(0, s + p.score), reasons: [...reasons, ...p.reasons] };
  };

  const priceOf = (id: string): number | null => {
    const left = shelfLeft.get(id);
    if (!planning) return left && left.length ? left[0].priceK : null;
    const u = upgradeById.get(id);
    const n = bought[id]?.length ?? 0;
    if (u) return n >= u.maxInShop ? null : upgradePrice(mid(u.price), input.teamSize, teamBought[id] ?? 0);
    const it = shopItemById.get(id)!;
    const max = CONSUMABLE(it) ? Math.min(2, it.maxInShop) : 1;
    return n >= max ? null : itemPrice(it, mid(it.price), input.teamSize, levelsCompleted);
  };

  for (let guard = 0; guard < 40; guard++) {
    type Cand = { kind: 'upgrade' | 'item'; id: string; score: number; reasons: string[]; price: number };
    const cands: Cand[] = [];
    for (const u of SHOP.upgrades) {
      if (prefs.banned.includes(u.id)) continue;
      if (u.coopOnly && mode === 'solo') continue;
      if (u.cap != null && (owned[u.id] ?? 0) >= u.cap) continue;
      if (u.teamUnique && (teamBought[u.id] ?? 0) >= 1) continue;
      const price = priceOf(u.id);
      if (price == null) continue;
      const s = scoreUpgrade(u);
      if (s.score > 0) cands.push({ kind: 'upgrade', id: u.id, price, ...s });
    }
    for (const it of SHOP.items) {
      if (prefs.banned.includes(it.id)) continue;
      const price = priceOf(it.id);
      if (price == null) continue;
      const s = scoreItem(it);
      const repeat = (bought[it.id]?.length ?? 0) * 2;
      if (s.score - repeat > 0) cands.push({ kind: 'item', id: it.id, price, score: s.score - repeat, reasons: s.reasons });
    }
    // Items from other mods: the guide can't judge them, so they start just below the
    // suggestion threshold and only come up when you rate them up or pin them.
    if (!planning) {
      for (const [id, copies] of shelfLeft) {
        if (known(id) || !copies.length || prefs.banned.includes(id)) continue;
        const ex = extras[id];
        const kind = ex?.kind ?? 'item';
        const p = prefScore(id, null, kind, prefs, nameOf(id));
        const repeat = (bought[id]?.length ?? 0) * 2;
        const score = 2.5 + p.score - repeat;
        if (score > 0) cands.push({ kind, id, price: copies[0].priceK, score, reasons: ['from another mod, rated by you', ...p.reasons] });
      }
    }
    // Small price sensitivity so equal-value picks favour the cheaper one.
    cands.sort((a, b) => b.score - b.price * 0.05 - (a.score - a.price * 0.05) || a.price - b.price);
    const pick = cands.find((c) => c.price <= budget && (c.score >= 3 || prefs.pinned.includes(c.id)));
    if (!pick) {
      const best = cands.find((c) => c.score >= 3);
      if (best && best.price > budget) skipped.push({ name: nameOf(best.id), reason: `Worth it, but costs ~$${best.price}K. Save up for it.` });
      break;
    }
    budget -= pick.price;
    (bought[pick.id] ??= []).push(pick.price);
    extraReasons[pick.id] = pick.reasons;
    if (!planning) shelfLeft.get(pick.id)?.shift();
    if (pick.kind === 'upgrade') {
      owned[pick.id] = (owned[pick.id] ?? 0) + 1;
      // In planning mode the next copy is priced after this purchase; shelf copies keep their stocked price.
      if (planning) teamBought[pick.id] = (teamBought[pick.id] ?? 0) + 1;
    } else ownedItems.add(pick.id);
  }

  const picks: AdvicePick[] = Object.entries(bought).map(([id, prices]) => {
    const u = upgradeById.get(id);
    const it = shopItemById.get(id);
    const reasons = [...new Set(extraReasons[id] ?? [])];
    if (u && !planning && prices.length > 1)
      reasons.unshift(`all ${prices.length} copies are priced now; bought one per visit, each next one would cost +50%`);
    const base = u ? u.why : it ? it.effect : `${extras[id]?.type ?? 'item'} from another mod`;
    return {
      kind: u || extras[id]?.kind === 'upgrade' ? 'upgrade' : 'item',
      id,
      name: nameOf(id),
      emoji: (u ?? it)?.emoji ?? '🧩',
      qty: prices.length,
      costK: prices.reduce((a, b) => a + b, 0),
      prices,
      reasons: [base, ...reasons],
      giveTo: u ? giveTo(id, input.team) : undefined,
    };
  });

  if (!planning) {
    const unknownIds = [...new Set(input.shelf.filter((c) => !known(c.id)).map((c) => c.id))];
    if (unknownIds.length)
      notes.push(
        `${unknownIds.map(nameOf).join(', ')} ${unknownIds.length === 1 ? 'is' : 'are'} from other mods. The guide can’t judge ${unknownIds.length === 1 ? 'it' : 'them'}, so ${unknownIds.length === 1 ? 'it’s' : 'they’re'} only suggested if you rate ${unknownIds.length === 1 ? 'it' : 'them'} up or pin ${unknownIds.length === 1 ? 'it' : 'them'}.`,
      );
  }

  // Shopkeeper haggling: show him the most expensive planned buy (biggest saving);
  // cheap planned buys (≤ $5K) would become free.
  let haggle: ShopAdviceV2['haggle'] = null;
  if (!planning && input.haggleAttemptsLeft !== 0) {
    const candidates = input.shelf.filter((c) => bought[c.id] && !c.discounted && !c.rejected);
    const best = [...candidates].sort((a, b) => b.priceK - a.priceK)[0];
    haggle = {
      attemptsLeft: input.haggleAttemptsLeft ?? null,
      best: best ? { id: best.id, name: nameOf(best.id), priceK: best.priceK, save: haggleSaving(best.priceK) } : null,
      freebies: [...new Set(candidates.filter((c) => c.priceK <= HAGGLE.minOffK && c !== best).map((c) => nameOf(c.id)))],
    };
  }

  const spentK = picks.reduce((a, p) => a + p.costK, 0);
  return {
    picks,
    spentK,
    leftK: Math.max(0, afterBasketK - spentK),
    notes,
    skipped,
    nextLevel,
    nextPhase,
    planning,
    afterBasketK,
    basket,
    unusedUpgrades,
    haggle,
  };
}

function teamTotals(team: TeamMember[] | undefined): Record<string, number> | null {
  if (!team || team.length === 0) return null;
  const t: Record<string, number> = {};
  for (const m of team) for (const [id, n] of Object.entries(m.upgrades)) t[id] = (t[id] ?? 0) + n;
  return t;
}

/** Suggest who should take an upgrade: whoever has the fewest of it (you on a tie). */
function giveTo(id: string, team: TeamMember[] | undefined): string | undefined {
  if (!team || team.length < 2) return undefined;
  const sorted = [...team].sort((a, b) => (a.upgrades[id] ?? 0) - (b.upgrades[id] ?? 0) || Number(b.isLocal) - Number(a.isLocal));
  const best = sorted[0];
  const you = team.find((m) => m.isLocal);
  const who = best.isLocal ? 'you' : best.name;
  const yours = you ? ` · you have ${you.upgrades[id] ?? 0}` : '';
  return `${who} (has ${best.upgrades[id] ?? 0})${best.isLocal ? '' : yours}`;
}

/** Map the companion's StatsManager upgrade names to our upgrade ids. */
export const GAME_UPGRADE_IDS: Record<string, string> = {
  Stamina: 'stamina',
  Health: 'health',
  Strength: 'strength',
  Range: 'range',
  Speed: 'sprint',
  Launch: 'tumble-launch',
  CrouchRest: 'crouch-rest',
  ExtraJump: 'extra-jump',
  TumbleWings: 'tumble-wings',
  TumbleClimb: 'tumble-climb',
  MapPlayerCount: 'map-player-count',
  DeathHeadBattery: 'death-head-battery',
};

export function mapGameUpgrades(raw: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(raw ?? {})) {
    const id = GAME_UPGRADE_IDS[k];
    if (id && n > 0) out[id] = n;
  }
  return out;
}

/** Map a shelf item's game asset name to our id (null for modded items). */
export function idForAsset(asset: string): string | null {
  return SHOP.upgrades.find((u) => u.asset === asset)?.id ?? SHOP.items.find((i) => i.asset === asset)?.id ?? null;
}
