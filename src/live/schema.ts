/**
 * GameState v1: what the optional companion mod sends (mod/src/Snapshot.cs).
 * Everything is optional on purpose: older/newer mod versions and feature
 * switches mean any field can be missing.
 */
export interface GameStateV1 {
  v: 1;
  mod?: string;
  phase?: 'level' | 'shop' | 'lobby' | 'arena' | 'menu';
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
  players?: LivePlayer[];
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
