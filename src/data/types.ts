export type Threat = 'low' | 'medium' | 'high' | 'lethal';
export type Detection = 'sight' | 'sound' | 'light' | 'proximity' | 'provoked' | 'gaze' | 'random';
export type Phase = 'early' | 'mid' | 'late';

/**
 * Behaviour tags the advice engine uses for generic combo rules.
 * - passive:     harmless unless you provoke it
 * - noisy:       makes noise that attracts sound hunters
 * - loot-breaker: damages, steals or throws valuables
 * - displacer:   moves players (throw, pull, push, carry), dangerous near pits
 * - grabber:     pins a player, so a teammate has to free them
 * - group:       usually spawns in groups
 * - ceiling:     attacks from above
 * - invisible:   hard to see
 * - stay-quiet:  punishes noise
 * - look-away:   punishes looking at it
 * - forces-look: moves your camera or aim
 * - after-death: gets stronger when a player dies
 */
export type MonsterTag =
  | 'passive'
  | 'noisy'
  | 'loot-breaker'
  | 'displacer'
  | 'grabber'
  | 'group'
  | 'ceiling'
  | 'invisible'
  | 'stay-quiet'
  | 'look-away'
  | 'forces-look'
  | 'after-death';

export interface Monster {
  id: string;
  name: string;
  /** Alternate names that appear in guides or older versions (shown as "aka"). */
  aliases: string[];
  /** Short descriptive callouts players use in voice chat ("ceiling eye", "shotgun guy"). Searchable. */
  nicknames: string[];
  /** The game's internal key (EnemyParent.enemyNameLocalized), e.g. "ENEMY.BEAMER". Used by the companion mod. */
  gameKey: string;
  emoji: string;
  /** In-game star rating 1–3 (higher spawns as the "big" monster of a level). */
  tier: 1 | 2 | 3;
  threat: Threat;
  detection: Detection[];
  tags: MonsterTag[];
  hp: string;
  orb: string;
  addedIn: 'early-access' | '0.3.0' | '0.5.0';
  /** The single most important rule. Shown first. */
  golden: string;
  /** How you notice it is around. */
  tells: string;
  behavior: string;
  damage: string;
  do: string[];
  dont: string[];
  counter: {
    stun: boolean | null;
    kill: string;
    items: string[];
  };
  /** Disagreements between sources, version caveats. */
  notes?: string;
  verified: boolean;
  sources: string[];
}

export interface GameMap {
  id: string;
  name: string;
  emoji: string;
  summary: string;
  tags: ('dark' | 'pits' | 'lava' | 'open' | 'narrow' | 'vertical' | 'water')[];
  lighting: string;
  hiding: string;
  hazards: Record<Phase, string[]>;
  hazardWeight: Record<Phase, number>;
  tips: string[];
  sources: string[];
}

export interface Item {
  id: string;
  name: string;
  emoji: string;
  kind: 'weapon' | 'tool' | 'upgrade' | 'consumable';
  description: string;
  goodAgainst: string[];
}

export interface Source {
  name: string;
  url: string;
  note?: string;
}

// ---------- shop ----------
export type TeamMode = 'solo' | 'duo' | 'squad';

export interface Upgrade {
  id: string;
  name: string;
  emoji: string;
  /** Base price range in $K for one player, before the per-purchase increase (from the game data). */
  price: [number, number];
  /** Game item asset name, e.g. "Item Upgrade Player Energy" (what the companion reports). */
  asset: string;
  /** Most copies the shop can show at once (from the game data). */
  maxInShop: number;
  /** Sold in the secret shop. */
  secretShop?: boolean;
  effect: string;
  stat: { label: string; per: number; unit: string } | null;
  priority: Record<TeamMode, number>;
  diminishAfter: number;
  cap?: number;
  teamUnique?: boolean;
  coopOnly?: boolean;
  /** Links to a round-memory gear id (items.json) when owning it counts as gear. */
  gear: string | null;
  why: string;
}

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  category: 'ranged' | 'melee' | 'explosive' | 'health' | 'utility' | 'cart' | 'drone';
  /** Base price range in $K (from the game data). */
  price: [number, number];
  /** Game item asset name, e.g. "Item Upgrade Player Energy" (what the companion reports). */
  asset: string;
  /** Most copies the shop can show at once (from the game data). */
  maxInShop: number;
  /** Sold in the secret shop. */
  secretShop?: boolean;

  effect: string;
  gear: string | null;
  phase: Phase[];
  rating: number;
  unverified?: boolean;
}

export interface ShopTip {
  id: string;
  title: string;
  text: string;
  tag: 'trick' | 'team' | 'basics' | 'money' | 'loadout';
  verified: boolean;
}

export interface SecretLayout {
  id: string;
  name: string;
  emoji: string;
  how: string[];
  needs: string;
}

export interface ShopData {
  upgrades: Upgrade[];
  items: ShopItem[];
  tips: ShopTip[];
  secretShop: { intro: string; stock: string[]; layouts: SecretLayout[]; sources: string[] };
  sources: string[];
}

// ---------- spawns ----------
export interface SpawnBand {
  from: number;
  to: number | null;
  t1: number;
  t2: number;
  t3: number;
}

export interface SpawnData {
  bands: SpawnBand[];
  groupSwap: { chancePct: number; text: string; groups: { id: string; count: number }[] };
  respawn: { fromMin: number; toMin: number | null; time: string }[];
  rules: string[];
  notes: string;
  sources: string[];
}
