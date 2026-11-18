import monstersJson from './monsters.json';
import mapsJson from './maps.json';
import itemsJson from './items.json';
import sourcesJson from './sources.json';
import shopJson from './shop.json';
import spawnsJson from './spawns.json';
import type { GameMap, Item, Monster, ShopData, Source, SpawnData } from './types';

export const MONSTERS = monstersJson as Monster[];
export const MAPS = mapsJson as GameMap[];
export const ITEMS = itemsJson as Item[];
export const SOURCES = sourcesJson as Record<string, Source>;
export const SHOP = shopJson as ShopData;
export const SPAWNS = spawnsJson as SpawnData;

export const monsterById = new Map(MONSTERS.map((m) => [m.id, m]));
export const mapById = new Map(MAPS.map((m) => [m.id, m]));
export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
export const upgradeById = new Map(SHOP.upgrades.map((u) => [u.id, u]));
export const shopItemById = new Map(SHOP.items.map((i) => [i.id, i]));

export const THREAT_ORDER = { low: 0, medium: 1, high: 2, lethal: 3 } as const;

export type { GameMap, Item, Monster, ShopData, ShopItem, Source, SpawnData, Upgrade } from './types';
