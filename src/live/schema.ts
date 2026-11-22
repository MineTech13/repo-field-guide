/**
 * GameState v1: what the optional companion mod sends (mod/src/Snapshot.cs).
 * Everything is optional on purpose: older/newer mod versions and feature
 * switches mean any field can be missing.
 */
export interface GameStateV1 {
  v: 1;
  mod?: string;
  /** lobby = the truck between levels; lobbyMenu = multiplayer lobby, waiting for players. */
  phase?: 'level' | 'shop' | 'lobby' | 'lobbyMenu' | 'mainMenu' | 'tutorial' | 'arena' | 'menu';
  /** Players currently in the game. */
  playerCount?: number;
  updatedAt?: string;
  /** Level.NarrativeName, e.g. "Headman Manor". */
  map?: string | null;
  mapAsset?: string | null;
  levelsCompleted?: number;
  haul?: { goal?: number; current?: number; extractionPoints?: number; extractionPointsCompleted?: number };
  /** Run currency in $K. */
  surplusK?: number;
  seen?: LiveEncounter[];
  /** Only while in the shop: one entry per physical copy. */
  shelf?: LiveShelfItem[];
  /** Only in the shop: copies in the checkout area, with the running total. */
  basket?: { item: string; priceK: number }[];
  basketTotalK?: number;
  /** Only in the shop: haggling attempts (3 per visit). */
  shopkeeper?: { attemptsUsed: number; attemptsLeft: number };
  /** Only in the shop: every item the game knows, incl. other mods' items. */
  catalog?: LiveCatalogItem[];
  /** Team inventory by item asset: owned items and bought-but-unused upgrades. */
  owned?: Record<string, number>;
  players?: LivePlayer[];
  /** Only in a level: your own status. */
  me?: { dead?: boolean; health?: number; maxHealth?: number };
  /** Only in a level: everyone in the game. Teammates count as dead only once their head was found. */
  team?: LiveTeammate[];
  /** Only in a level: what the in-game map would show you. Positions are [x, y, z] in metres (y = up). */
  layout?: LiveLayout;
}

export type Vec3 = [number, number, number];

export interface LiveTeammate {
  name: string;
  isLocal?: boolean;
  dead?: boolean;
  head?: Vec3;
  headIn?: 'truck' | 'extraction';
}

export interface LiveLayout {
  me?: Vec3;
  /** Camera heading in degrees. */
  yaw?: number;
  /** Explored rooms as boxes [cx, cy, cz, sx, sy, sz]. */
  rooms?: [number, number, number, number, number, number][];
  extraction?: {
    /** Each extraction point's goal in $ (the level quota split evenly). */
    goalPerPoint?: number;
    total?: number;
    completed?: number;
    /** Only points that have been found. */
    points?: { at: Vec3; state?: string; current?: boolean }[];
  };
  /** Only discovered valuables. Value in $. */
  valuables?: { name: string; value: number; at: Vec3; size?: string; inHaul?: boolean }[];
  /** Where you last saw each monster. */
  monsters?: { key?: string | null; name?: string; at: Vec3; agoSec?: number; killed?: boolean }[];
}

export interface LiveCatalogItem {
  item: string;
  name?: string;
  type?: string;
  /** Base price range in $K. */
  priceK?: [number, number];
  maxInShop?: number;
  coopOnly?: boolean;
}

export interface LiveEncounter {
  /** Internal key, e.g. "ENEMY.BEAMER" (matches Monster.gameKey). */
  key?: string | null;
  name?: string;
  tier?: number;
  firstSeenAt?: number;
  onScreen?: boolean;
  spottedYou?: boolean;
  killed?: boolean;
  /** Seconds until respawn, only while despawned. */
  respawnInSec?: number;
}

export interface LiveShelfItem {
  /** Item asset name, e.g. "Item Upgrade Player Energy". */
  item: string;
  name?: string;
  type?: string;
  priceK: number;
  /** Shopkeeper reaction to this copy. */
  haggle?: 'Discounted' | 'Rejected';
  shown?: number;
}

export interface LivePlayer {
  name: string;
  isLocal?: boolean;
  /** e.g. { Health: 2, Stamina: 3 } (StatsManager.playerUpgradeX without the prefix). */
  upgrades?: Record<string, number>;
}

export function isGameState(x: unknown): x is GameStateV1 {
  return !!x && typeof x === 'object' && (x as { v?: unknown }).v === 1;
}
