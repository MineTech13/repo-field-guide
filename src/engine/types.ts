import type { GameMap, Item, Monster, MonsterTag, Phase } from '../data/types';

export type Health = 'full' | 'hurt' | 'critical';

export interface Spotted {
  id: string;
  how: 'seen' | 'heard';
  killed: boolean;
}

/** Optional "round memory": everything here is optional and only refines advice. */
export interface Memory {
  teamSize: number | null;
  alive: number | null;
  health: Health | null;
  quotaPct: number | null;
  items: string[];
}

export interface RoundState {
  mapId: string | null;
  level: number;
  spotted: Spotted[];
  memory: Memory;
}

export type Severity = 'info' | 'warn' | 'danger';

export interface Bullet {
  severity: Severity;
  text: string;
  /** Monster id, 'map', 'combo:<id>' or 'memory'. */
  from: string;
}

export interface ComboHit {
  id: string;
  severity: Exclude<Severity, 'info'>;
  title: string;
  text: string;
}

export interface MonsterAdvice {
  monster: Monster;
  spotted: Spotted;
  /** Items from the memory panel that counter this monster. */
  usableItems: Item[];
  /** True when the team logged its items and none counter a tier-3 monster. */
  noAnswer: boolean;
}

export type ThreatLabel = 'Calm' | 'Tense' | 'Dangerous' | 'Critical';

export interface Advice {
  score: number;
  label: ThreatLabel;
  phase: Phase;
  map: GameMap | null;
  call: { title: string; text: string };
  watchOut: Bullet[];
  combos: ComboHit[];
  monsters: MonsterAdvice[];
  modifiers: Bullet[];
}

/** What rule functions get to look at. Only living (not killed) monsters count. */
export interface RuleContext {
  state: RoundState;
  phase: Phase;
  map: GameMap | null;
  active: Monster[];
  ids: Set<string>;
  tags: Set<MonsterTag>;
  has: (id: string) => boolean;
  hasTag: (tag: MonsterTag) => boolean;
  mapHas: (tag: GameMap['tags'][number]) => boolean;
}
